import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  agentSpecSchema,
  defaultAgentSpec,
  normalizeAgentSpec,
  type AgentSpec,
} from "@/lib/agent-spec";
import type { RuntimeInputs, SlotInput } from "@/lib/connectors";
import { readTokens } from "@/lib/gmail-tokens";
import {
  agentSlug,
  generateAgentFiles,
  planConnectors,
} from "@/lib/generate-app";

// Local-dev only: this route runs `docker` on the host. Do NOT expose it
// publicly. Inputs are spawned as arg arrays (never a shell string) so
// user-provided values can't inject commands.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function runStep(
  cmd: string,
  args: string[],
  onLine: (line: string) => void,
  cwd?: string
): Promise<{ code: number; out: string }> {
  return new Promise((resolve, reject) => {
    // Ensure common CLI install dirs (e.g. the Railway CLI) are on PATH.
    const env = {
      ...process.env,
      PATH: `${process.env.PATH ?? ""}:/opt/homebrew/bin:/usr/local/bin`,
    };
    const child = spawn(cmd, args, { cwd, env });
    let out = "";
    const handle = (buf: Buffer) => {
      const text = buf.toString();
      out += text;
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) onLine(line.trimEnd());
      }
    };
    child.stdout.on("data", handle);
    child.stderr.on("data", handle);
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 0, out }));
  });
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

async function writeFiles(dir: string, files: Record<string, string>) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  for (const [rel, contents] of Object.entries(files)) {
    const full = path.join(dir, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, contents, "utf8");
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const normalized = normalizeAgentSpec(body.spec, defaultAgentSpec);
    const parsed = agentSpecSchema.safeParse(normalized);

    if (!parsed.success) {
      const details = parsed.error.issues
        .slice(0, 3)
        .map((issue) => issue.message)
        .join("; ");
      return Response.json(
        {
          error: details
            ? `Invalid agent spec: ${details}`
            : "Invalid agent spec.",
        },
        { status: 400 }
      );
    }

    const spec: AgentSpec = parsed.data;
    // Runtime inputs from the request body are still accepted for programmatic
    // use, but spec.envVars and server env vars are the authoritative sources.
    const inputs: RuntimeInputs = body.runtime ?? {};
    const target: "local" | "railway" =
      body.target === "railway" ? "railway" : "local";
    const slug = agentSlug(spec.name);
    const plan = planConnectors(spec);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (obj: unknown) =>
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        const log = (line: string) => emit({ type: "log", line });

        try {
          // 1. Generate the bundle (target-aware).
          log("Generating agent project…");
          const files = await generateAgentFiles(spec, plan, target);
          const outDir = path.join(process.cwd(), "deploy-output", slug);
          await writeFiles(outDir, files);
          log(`Wrote ${Object.keys(files).length} files to deploy-output/${slug}/`);

          // 2. Runtime config (shared). Local mounts file_search folders; cloud
          //    targets can't, so we note it instead.
          const fileMounts: string[] = [];
          const agentConfig: {
            slots: Record<string, SlotInput>;
            searchApiKey?: string;
            voice?: { voiceId: string; ttsModel?: string; sttModel?: string };
          } = {
            slots: {},
            // Env var is the authoritative source; body input is a fallback.
            searchApiKey:
              process.env.TAVILY_API_KEY ||
              process.env.SEARCH_API_KEY ||
              inputs.searchApiKey,
          };

          // spec.envVars holds secrets collected by the builder during the chat
          // (via setEnvVar). They are the primary secret source — server env
          // vars are a global fallback for advanced users.
          const envVars = spec.envVars ?? {};

          // ElevenLabs voice (optional): voiceId/models come from the deploy
          // form; the key from spec.envVars / server env / form input.
          const voice = inputs.voice;
          const elKey =
            envVars.ELEVENLABS_API_KEY ||
            process.env.ELEVENLABS_API_KEY ||
            voice?.apiKey;
          if (voice?.enabled && voice.voiceId && elKey) {
            agentConfig.voice = {
              voiceId: voice.voiceId,
              ttsModel: voice.ttsModel,
              sttModel: voice.sttModel,
            };
          } else if (voice?.enabled && !elKey) {
            log("WARNING: Voice enabled but no ElevenLabs API key provided.");
          } else if (voice?.enabled && !voice.voiceId) {
            log("WARNING: Voice enabled but no voice ID selected.");
          }

          let needsGmail = false;
          for (const c of plan) {
            const rt = inputs.slots?.[c.slot] ?? {};
            if (c.type === "file_search") {
              // spec path (set by builder) > env fallback > body input
              const hostPath = c.path || process.env.FILE_SEARCH_PATH || rt.path;
              if (hostPath && target === "local") {
                fileMounts.push(
                  "-v",
                  `${path.resolve(hostPath)}:/data/${c.slot}:ro`
                );
              } else if (!hostPath) {
                log(
                  `WARNING: file_search tool "${c.name}" has no folder path — the agent will find nothing.`
                );
              } else if (target !== "local") {
                log(
                  `NOTE: file_search "${c.name}" mounts a local folder and won't work on cloud targets.`
                );
              }
              agentConfig.slots[c.slot] = {
                glob: c.glob || process.env.FILE_SEARCH_GLOB || rt.glob,
              };
            } else if (c.type === "http_api" || c.type === "http_request") {
              // baseUrl: spec tool > env fallback
              // authHeader: spec envVars (set via setEnvVar during build) > env fallback
              const baseUrl = c.baseUrl || process.env.HTTP_BASE_URL || rt.baseUrl;
              const authHeader =
                envVars.HTTP_AUTH_HEADER ||
                process.env.HTTP_AUTH_HEADER ||
                rt.authHeader;
              agentConfig.slots[c.slot] = { baseUrl, authHeader };
              if (baseUrl) log(`HTTP tool "${c.name}" → ${baseUrl}`);
            } else if (c.type === "db_query") {
              const dbUrl =
                envVars.DATABASE_URL ||
                process.env.DATABASE_URL ||
                rt.dbUrl;
              agentConfig.slots[c.slot] = { dbUrl };
            } else if (c.type === "slack_send") {
              const webhookUrl =
                envVars.SLACK_WEBHOOK_URL ||
                process.env.SLACK_WEBHOOK_URL ||
                rt.webhookUrl;
              agentConfig.slots[c.slot] = { webhookUrl };
            } else if (
              c.type === "gmail_read_inbox" ||
              c.type === "gmail_send_digest"
            ) {
              needsGmail = true;
            }
          }

          let gmailEnv: Record<string, string> | null = null;
          if (needsGmail) {
            const tokens = await readTokens().catch(() => null);
            const clientId =
              spec.envVars?.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
            const clientSecret =
              spec.envVars?.GOOGLE_CLIENT_SECRET ||
              process.env.GOOGLE_CLIENT_SECRET;
            if (tokens && clientId && clientSecret) {
              gmailEnv = {
                GMAIL_TOKENS: JSON.stringify(tokens),
                GOOGLE_CLIENT_ID: clientId,
                GOOGLE_CLIENT_SECRET: clientSecret,
              };
            } else {
              log(
                "WARNING: Gmail tool present but no stored OAuth tokens/credentials found — connect Gmail in the builder, then redeploy."
              );
            }
          }

          // 3a. Railway.
          if (target === "railway") {
            const railwayToken = process.env.RAILWAY_TOKEN;
            const service = process.env.RAILWAY_SERVICE;

            // One-click path: a default project token + service are configured,
            // so we deploy on the user's behalf (no CLI/token from the user).
            if (railwayToken && service) {
              // Set the service variables the agent needs at runtime.
              const setArgs = ["variables", "--service", service];
              if (process.env.DEEPSEEK_API_KEY)
                setArgs.push("--set", `DEEPSEEK_API_KEY=${process.env.DEEPSEEK_API_KEY}`);
              setArgs.push("--set", `AGENT_CONFIG=${JSON.stringify(agentConfig)}`);
              if (agentConfig.voice && elKey)
                setArgs.push("--set", `ELEVENLABS_API_KEY=${elKey}`);
              if (gmailEnv)
                for (const [k, v] of Object.entries(gmailEnv))
                  setArgs.push("--set", `${k}=${v}`);

              log("Configuring Railway service variables…");
              await runStep("railway", setArgs, () => {}, outDir);

              log("Uploading + building on Railway (this can take a few minutes)…");
              const up = await runStep(
                "railway",
                ["up", "--ci", "--service", service],
                (l) => log(l),
                outDir
              );
              if (up.code !== 0) {
                throw new Error(`Railway deploy failed (exit ${up.code}).`);
              }

              log("Fetching public URL…");
              const dom = await runStep(
                "railway",
                ["domain", "--service", service],
                () => {},
                outDir
              );
              const match = dom.out.match(
                /https?:\/\/[^\s]+\.up\.railway\.app/
              );
              const url = match ? match[0] : null;
              log(url ? `Deployed to Railway: ${url}` : "Deployed (domain pending).");
              emit({ type: "done", url, target: "railway" });
              return;
            }

            // Fallback: no default token — prepare the bundle + manual instructions.
            const env: Record<string, string> = {
              DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY
                ? "(copy from server)"
                : "(required)",
              AGENT_CONFIG: JSON.stringify(agentConfig),
            };
            if (agentConfig.searchApiKey) env.TAVILY_API_KEY = "(set in Railway)";
            if (agentConfig.voice && elKey)
              env.ELEVENLABS_API_KEY = "(set in Railway)";
            if (gmailEnv) Object.assign(env, gmailEnv);
            log("Railway bundle ready (it builds the Dockerfile).");
            log(
              "Set RAILWAY_TOKEN + RAILWAY_SERVICE on the server for one-click deploys, or run the command below manually."
            );
            emit({
              type: "prepared",
              target: "railway",
              dir: `deploy-output/${slug}`,
              command: `cd deploy-output/${slug} && railway up`,
              env,
            });
            emit({ type: "done", prepared: true });
            return;
          }

          // 3b. Local Docker: build + run.
          const docker = await runStep(
            "docker",
            ["version", "--format", "{{.Server.Version}}"],
            () => {}
          ).catch(() => ({ code: 1, out: "docker not found" }));
          if (docker.code !== 0) {
            throw new Error(
              "Docker is not available. Install Docker and make sure the daemon is running."
            );
          }
          log(`Docker ${docker.out.trim()} detected.`);
          if (!process.env.DEEPSEEK_API_KEY) {
            log(
              "WARNING: DEEPSEEK_API_KEY is not set on the server — the deployed agent will not be able to answer."
            );
          }

          const image = `agent-${slug}`;
          log(`Building image ${image} (first build installs deps; may take a minute)…`);
          const build = await runStep("docker", ["build", "-t", image, outDir], log);
          if (build.code !== 0) {
            throw new Error(`docker build failed (exit ${build.code}).`);
          }

          const container = `agent-${slug}`;
          await runStep("docker", ["rm", "-f", container], () => {}).catch(
            () => undefined
          );

          const port = await freePort();
          const args = ["run", "-d", "--name", container, "-p", `${port}:8080`];
          if (process.env.DEEPSEEK_API_KEY) {
            args.push("-e", `DEEPSEEK_API_KEY=${process.env.DEEPSEEK_API_KEY}`);
          }
          args.push(...fileMounts);
          args.push("-e", `AGENT_CONFIG=${JSON.stringify(agentConfig)}`);
          if (agentConfig.voice && elKey) {
            args.push("-e", `ELEVENLABS_API_KEY=${elKey}`);
          }
          if (gmailEnv) {
            for (const [k, v] of Object.entries(gmailEnv)) {
              args.push("-e", `${k}=${v}`);
            }
            log("Injected Gmail OAuth tokens from the builder's connected account.");
          }
          args.push(image);

          log(`Starting container on port ${port}…`);
          const run = await runStep("docker", args, (l) => log(l));
          if (run.code !== 0) {
            throw new Error(`docker run failed (exit ${run.code}).`);
          }

          const url = `http://localhost:${port}`;
          log(`Deployed. Agent is live at ${url}`);
          emit({ type: "done", url, container, port });
        } catch (e) {
          emit({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Deploy route error:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Deploy failed before the build could start.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { code, out } = await runStep(
      "docker",
      [
        "ps",
        "--filter",
        "name=agent-",
        "--format",
        "{{.Names}}|{{.Ports}}|{{.Status}}",
      ],
      () => {}
    );
    if (code !== 0) return Response.json({ deployments: [] });
    const deployments = out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, ports = "", status = ""] = line.split("|");
        const match = ports.match(/0\.0\.0\.0:(\d+)->8080/);
        const port = match ? Number(match[1]) : null;
        return {
          name,
          status,
          port,
          url: port ? `http://localhost:${port}` : null,
        };
      });
    return Response.json({ deployments });
  } catch {
    return Response.json({ deployments: [] });
  }
}

export async function DELETE(req: Request) {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  if (!/^agent-[a-z0-9-]+$/.test(name)) {
    return Response.json({ error: "Invalid container name." }, { status: 400 });
  }
  const { code } = await runStep("docker", ["rm", "-f", name], () => {});
  return Response.json({ ok: code === 0 });
}
