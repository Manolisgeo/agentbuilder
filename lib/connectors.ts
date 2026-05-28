import type { AgentSpec } from "./agent-spec";

// Pure, client-safe connector planning (no node:* imports) so both the deploy
// UI and the server-side generator can share it.

export type DbEngine = "postgres" | "mysql" | "sqlite";
export type RuntimeNeed =
  | "path"
  | "glob"
  | "baseUrl"
  | "authHeader"
  | "dbUrl"
  | "webhookUrl";

// Tool types the local-Docker runtime can actually execute. `http_request` is
// the builder's name for a generic HTTP call (same runtime as `http_api`).
// Gmail tools reuse the OAuth tokens the builder already stored, injected at
// deploy time. Remaining builder types (gmail_summarizer, custom) have no
// container runtime yet, so they are skipped when planning a deploy.
export const DEPLOY_TOOL_TYPES = [
  "web_search",
  "file_search",
  "http_api",
  "http_request",
  "db_query",
  "slack_send",
  "gmail_read_inbox",
  "gmail_send_digest",
] as const;

// One entry per deployable tool. `slot` is a stable, filesystem/env-safe id
// (t0, t1, …) used for volume mounts (/data/<slot>) and AGENT_CONFIG keys, so
// we never have to sanitize arbitrary tool ids. `needs` tells the deploy form
// which runtime values to collect for this tool.
export interface ConnectorSlot {
  slot: string;
  toolId: string;
  name: string;
  type: string;
  engine?: DbEngine;
  path?: string;
  glob?: string;
  baseUrl?: string;
  needs: RuntimeNeed[];
}

export function planConnectors(spec: AgentSpec): ConnectorSlot[] {
  const deployable = new Set<string>(DEPLOY_TOOL_TYPES);
  const counts: Record<string, number> = {};
  const slots: ConnectorSlot[] = [];
  spec.tools.forEach((tool, index) => {
    if (!deployable.has(tool.type)) return;
    const n = (counts[tool.type] = (counts[tool.type] ?? 0) + 1);
    const name = n === 1 ? tool.type : `${tool.type}_${n}`;
    const base: ConnectorSlot = {
      slot: `t${index}`,
      toolId: tool.id,
      name,
      type: tool.type,
      needs: [],
    };
    if (tool.type === "file_search") {
      base.path = tool.path;
      base.glob = tool.glob;
      base.needs = ["path"];
    } else if (tool.type === "http_api" || tool.type === "http_request") {
      base.baseUrl = tool.baseUrl;
      base.needs = ["baseUrl", "authHeader"];
    } else if (tool.type === "db_query") {
      base.engine = tool.engine as DbEngine | undefined;
      base.needs = ["dbUrl"];
    } else if (tool.type === "slack_send") {
      base.needs = ["webhookUrl"];
    }
    // gmail_read_inbox / gmail_send_digest need no form input — the deploy
    // route injects the builder's stored Google OAuth tokens automatically.
    slots.push(base);
  });
  return slots;
}

export function agentSlug(name: string): string {
  return (
    name
      .replace(/[^a-z0-9-_]+/gi, "-")
      .toLowerCase()
      .replace(/^-+|-+$/g, "") || "agent"
  );
}

// Runtime values collected by the deploy form (locations + secrets), keyed by
// connector slot. Secrets are passed to the container as env at deploy time and
// never stored in the spec.
export interface SlotInput {
  path?: string;
  glob?: string;
  baseUrl?: string;
  authHeader?: string;
  dbUrl?: string;
  webhookUrl?: string;
}
// ElevenLabs voice config on the agent spec. The API key is read from
// ELEVENLABS_API_KEY at deploy time; voiceId/models are stored on the spec.
export interface VoiceInput {
  enabled?: boolean;
  apiKey?: string;
  voiceId?: string;
  ttsModel?: string;
  sttModel?: string;
}
export interface RuntimeInputs {
  slots?: Record<string, SlotInput>;
  searchApiKey?: string;
  voice?: VoiceInput;
}

export const DEFAULT_TTS_MODEL = "eleven_turbo_v2_5";
export const DEFAULT_STT_MODEL = "scribe_v2";

export const NEED_LABELS: Record<RuntimeNeed, string> = {
  path: "Folder path (on this machine)",
  glob: "File pattern (optional)",
  baseUrl: "API base URL",
  authHeader: "Authorization header (optional)",
  dbUrl: "Database connection URL",
  webhookUrl: "Slack incoming webhook URL",
};

export function needIsSecret(need: RuntimeNeed): boolean {
  return need === "authHeader" || need === "dbUrl" || need === "webhookUrl";
}
