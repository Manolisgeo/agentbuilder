import { promises as fs } from "node:fs";
import path from "node:path";
import type { AgentSpec } from "./agent-spec";
import { agentSlug, type ConnectorSlot } from "./connectors";
import { getAgentFrontendHtml } from "./frontend-codegen";
import { FRONTEND_PLACEHOLDER_HTML, injectChatRuntime } from "./frontend-runtime";

export { agentSlug, planConnectors, type ConnectorSlot } from "./connectors";

const TEMPLATE_DIR = path.join(process.cwd(), "lib", "runtime-template");

const TOOL_DESCRIPTIONS: Record<string, string> = {
  file_search: "search the user's connected files",
  http_api: "call a connected HTTP API",
  http_request: "make an HTTP request to a connected API",
  db_query: "run read-only SQL against a connected database",
  web_search: "search the web",
  slack_send: "send a message to Slack",
  gmail_read_inbox: "read unread emails from the connected Gmail inbox",
  gmail_send_digest: "send an email digest from the connected Gmail account",
};

function buildSystemPrompt(spec: AgentSpec, plan: ConnectorSlot[]): string {
  const lines: string[] = [`You are ${spec.name}.`];
  if (spec.persona.role) lines.push(`Your role: ${spec.persona.role}.`);
  if (spec.persona.tone) lines.push(`Your tone: ${spec.persona.tone}.`);
  if (spec.instructions) lines.push("", "Instructions:", spec.instructions);
  if (plan.length > 0) {
    lines.push(
      "",
      "You have the following tools available — use them whenever they can help answer the user:"
    );
    for (const c of plan) {
      lines.push(`- ${c.name}: ${TOOL_DESCRIPTIONS[c.type] ?? "a connected tool"}`);
    }
  }
  return lines.join("\n");
}

async function parentDepVersion(name: string, fallback: string): Promise<string> {
  try {
    const pkg = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "package.json"), "utf8")
    );
    return pkg.dependencies?.[name] ?? fallback;
  } catch {
    return fallback;
  }
}

async function buildPackageJson(spec: AgentSpec, plan: ConnectorSlot[]) {
  const dependencies: Record<string, string> = {
    ai: await parentDepVersion("ai", "^6.0.191"),
    "@ai-sdk/openai": await parentDepVersion("@ai-sdk/openai", "^3.0.66"),
  };
  const engines = new Set(
    plan.filter((c) => c.type === "db_query").map((c) => c.engine)
  );
  if (engines.has("postgres")) dependencies.pg = "^8.13.0";
  if (engines.has("mysql")) dependencies.mysql2 = "^3.11.0";
  if (engines.has("sqlite")) dependencies["better-sqlite3"] = "^11.3.0";

  const hasGmail = plan.some(
    (c) => c.type === "gmail_read_inbox" || c.type === "gmail_send_digest"
  );
  if (hasGmail) dependencies.googleapis = "^144.0.0";

  return {
    name: `${agentSlug(spec.name)}-agent`,
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: { start: "node server.mjs" },
    dependencies,
  };
}

export type DeployTarget = "local" | "railway";

export async function generateAgentFiles(
  spec: AgentSpec,
  plan: ConnectorSlot[],
  target: DeployTarget = "local"
): Promise<Record<string, string>> {
  const [serverMjs, dockerfile, dockerignore] = await Promise.all([
    fs.readFile(path.join(TEMPLATE_DIR, "server.mjs"), "utf8"),
    fs.readFile(path.join(TEMPLATE_DIR, "Dockerfile"), "utf8"),
    fs.readFile(path.join(TEMPLATE_DIR, "dockerignore"), "utf8"),
  ]);

  const savedHtml = getAgentFrontendHtml(spec);
  const indexHtml = savedHtml
    ? injectChatRuntime(savedHtml)
    : injectChatRuntime(FRONTEND_PLACEHOLDER_HTML);

  const config = {
    name: spec.name,
    systemPrompt: buildSystemPrompt(spec, plan),
    tools: plan.map((c) => ({
      slot: c.slot,
      name: c.name,
      type: c.type,
      ...(c.engine ? { engine: c.engine } : {}),
    })),
  };

  const files: Record<string, string> = {
    "server.mjs": serverMjs,
    "public/index.html": indexHtml,
    Dockerfile: dockerfile,
    ".dockerignore": dockerignore,
    "agent.config.json": JSON.stringify(config, null, 2),
    "agent.json": JSON.stringify(spec, null, 2),
    "package.json": JSON.stringify(await buildPackageJson(spec, plan), null, 2),
  };

  // Railway builds the Dockerfile directly; this makes the target explicit.
  if (target === "railway") {
    files["railway.json"] = JSON.stringify(
      {
        $schema: "https://railway.app/railway.schema.json",
        build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
        deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 3 },
      },
      null,
      2
    );
  }

  return files;
}
