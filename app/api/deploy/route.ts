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
  onLine: (line: string) => void
): Promise<{ code: number; out: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
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
    const inputs: RuntimeInputs = body.runtime ?? {};
    const slug = agentSlug(spec.name);
    const plan = planConnectors(spec);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (obj: unknown) =>
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        const log = (line: string) => emit({ type: "log", line });

        try {
          // 0. Docker must be installed and the daemon running.
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

          // 1. Generate the project.
          log("Generating agent project…");
          const files = await generateAgentFiles(spec, plan);
          const outDir = path.join(process.cwd(), "deploy-output", slug);
          await writeFiles(outDir, files);
          log(`Wrote ${Object.keys(files).length} files to deploy-output/${slug}/`);

          // 2. Build the image.
          const image = `agent-${slug}`;
          log(`Building image ${image} (first build installs deps; may take a minute)…`);
          const build = await runStep("docker", ["build", "-t", image, outDir], log);
          if (build.code !== 0) {
            throw new Error(`docker build failed (exit ${build.code}).`);
          }

          // 3. Replace any previous container for this agent.
          const container = `agent-${slug}`;
          await runStep("docker", ["rm", "-f", container], () => {}).catch(
            () => undefined
          );

          // 4. Assemble run args + runtime config (secrets via env, files via mounts).
          const port = await freePort();
          const args = ["run", "-d", "--name", container, "-p", `${port}:8080`];
          if (process.env.DEEPSEEK_API_KEY) {
            args.push("-e", `DEEPSEEK_API_KEY=${process.env.DEEPSEEK_API_KEY}`);
          }
          const agentConfig: {
            slots: Record<string, SlotInput>;
            searchApiKey?: string;
          } = {
            slots: {},
            searchApiKey: inputs.searchApiKey || process.env.SEARCH_API_KEY,
          };
          for (const c of plan) {
            const rt = inputs.slots?.[c.slot] ?? {};
            if (c.type === "file_search") {
              const hostPath = rt.path || c.path;
              if (hostPath) {
                args.push("-v", `${path.resolve(hostPath)}:/data/${c.slot}:ro`);
              } else {
                log(
                  `WARNING: file_search tool "${c.name}" has no folder path — it will find nothing.`
                );
              }
              agentConfig.slots[c.slot] = { glob: rt.glob || c.glob };
            } else if (c.type === "http_api") {
              agentConfig.slots[c.slot] = {
                baseUrl: rt.baseUrl || c.baseUrl,
                authHeader: rt.authHeader,
              };
            } else if (c.type === "db_query") {
              agentConfig.slots[c.slot] = { dbUrl: rt.dbUrl };
            }
          }
          args.push("-e", `AGENT_CONFIG=${JSON.stringify(agentConfig)}`, image);

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
