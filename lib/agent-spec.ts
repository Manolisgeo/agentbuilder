import { z } from "zod";
import {
  agentDeploymentSchema,
  agentUiSchema,
  defaultAgentDeployment,
  defaultAgentUi,
  type AgentDeployment,
  type AgentUi,
} from "@/lib/agent-ui";
import { normalizeSttModel, normalizeTtsModel } from "@/lib/voice-models";

export const TOOL_TYPES = [
  "web_search",
  "gmail_read_inbox",
  "gmail_summarizer",
  "gmail_send_digest",
  "slack_send",
  "http_request",
  "custom",
  // local-Docker deploy connectors
  "file_search",
  "http_api",
  "db_query",
  "fb_marketplace_search",
] as const;

export type ToolType = (typeof TOOL_TYPES)[number];

export const toolSchema = z.object({
  id: z.string(),
  name: z.string(),
  // accepts known types and any future custom strings
  type: z.union([z.enum(TOOL_TYPES), z.string()]),
  // optional connector config consumed by the local-Docker deploy
  path: z.string().optional(),
  glob: z.string().optional(),
  baseUrl: z.string().optional(),
  engine: z.enum(["postgres", "mysql", "sqlite"]).optional(),
});

export const swarmMemoryKeySchema = z.object({
  key: z.string(),
  type: z.enum(["string", "object", "array"]),
  description: z.string(),
});

export const swarmAgentSchema = z.object({
  id: z.string(),
  role: z.string(),
  instructions: z.string(),
  dependsOn: z.array(z.string()),
  memory: z
    .object({
      reads: z.array(z.string()).default([]),
      writes: z.array(z.string()).default([]),
    })
    .optional(),
});

// ElevenLabs voice IDs are 20-character alphanumeric strings. Anything else
// (LLM hallucinations, free text, paid-tier preset IDs the free plan can't
// access) is dropped so the server-side resolver picks a working voice from
// the user's account.
const ELEVENLABS_VOICE_ID_RE = /^[A-Za-z0-9]{20}$/;

// Inner object kept exported for partial-schema reuse (patch schema). Use
// agentVoiceSchema externally — it applies the normalization transform.
export const agentVoiceShape = z.object({
  enabled: z.boolean().default(true),
  voiceId: z.string().optional(),
  ttsModel: z.string().optional(),
  sttModel: z.string().optional(),
});

export const agentVoiceSchema = agentVoiceShape.transform(
  (voice): {
    enabled: boolean;
    voiceId: string | undefined;
    ttsModel: string;
    sttModel: string;
  } => ({
    enabled: voice.enabled,
    voiceId:
      typeof voice.voiceId === "string" &&
      ELEVENLABS_VOICE_ID_RE.test(voice.voiceId.trim())
        ? voice.voiceId.trim()
        : undefined,
    ttsModel: normalizeTtsModel(voice.ttsModel),
    sttModel: normalizeSttModel(voice.sttModel),
  })
);

export const agentSpecSchema = z.object({
  name: z.string(),
  persona: z.object({
    role: z.string(),
    tone: z.string(),
  }),
  instructions: z.string(),
  tools: z.array(toolSchema),
  agents: z.array(swarmAgentSchema).optional(),
  swarmMemory: z.array(swarmMemoryKeySchema).optional(),
  envVars: z.record(z.string(), z.string()).optional(),
  voice: agentVoiceSchema.optional(),
  ui: agentUiSchema.optional(),
  deployment: agentDeploymentSchema.optional(),
});

export const agentSpecPatchSchema = agentSpecSchema.partial().extend({
  persona: z
    .object({
      role: z.string().optional(),
      tone: z.string().optional(),
    })
    .optional(),
  agents: z
    .array(
      swarmAgentSchema.partial().extend({
        id: z.string(),
        dependsOn: z.array(z.string()).optional(),
      })
    )
    .optional(),
  swarmMemory: z.array(swarmMemoryKeySchema).optional(),
  envVars: z.record(z.string(), z.string()).optional(),
  voice: agentVoiceShape.partial().optional(),
  ui: agentUiSchema.partial().extend({
    theme: agentUiSchema.shape.theme.partial().optional(),
  }).optional(),
  deployment: agentDeploymentSchema.partial().optional(),
});

export type AgentSpec = z.infer<typeof agentSpecSchema>;
export type AgentSpecPatch = z.infer<typeof agentSpecPatchSchema>;
export type AgentVoice = z.infer<typeof agentVoiceSchema>;
export type SwarmAgent = z.infer<typeof swarmAgentSchema>;
export type SwarmMemoryKey = z.infer<typeof swarmMemoryKeySchema>;

export type { AgentUi, AgentDeployment };

export const defaultAgentSpec: AgentSpec = {
  name: "Untitled Agent",
  persona: { role: "", tone: "" },
  instructions: "",
  tools: [],
  ui: defaultAgentUi,
  deployment: defaultAgentDeployment,
};

export const MAX_SWARM_AGENTS = 4;

const UI_TEMPLATES = ["chat", "widget", "landing", "voice"] as const;
const UI_LAYOUTS = ["sidebar", "fullscreen", "embedded"] as const;
const UI_MODES = ["light", "dark", "auto"] as const;
const UI_FONTS = ["sans", "serif", "mono"] as const;
const UI_RADII = ["none", "md", "full"] as const;
const DEPLOYMENT_PLATFORMS = ["html", "typescript", "python", "react"] as const;
const DEPLOYMENT_LANGUAGES = [
  "typescript",
  "python",
  "html",
  "css",
  "javascript",
  "tsx",
] as const;

function pickEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  if (typeof value !== "string") return fallback;
  const normalized = value.toLowerCase().trim().replace(/[\s-]+/g, "_");
  const exact = allowed.find((item) => item === normalized);
  if (exact) return exact;
  const fuzzy = allowed.find(
    (item) => normalized.includes(item) || item.includes(normalized)
  );
  return fuzzy ?? fallback;
}

function coerceTools(tools: unknown, fallback: AgentSpec["tools"]): AgentSpec["tools"] {
  if (!Array.isArray(tools)) return fallback;
  return tools
    .filter((tool): tool is Record<string, unknown> => typeof tool === "object" && tool !== null)
    .map((tool, index) => ({
      id: typeof tool.id === "string" && tool.id.length > 0 ? tool.id : `tool-${index + 1}`,
      name: typeof tool.name === "string" && tool.name.length > 0 ? tool.name : "Tool",
      type: typeof tool.type === "string" && tool.type.length > 0 ? tool.type : "web_search",
      ...(typeof tool.path === "string" ? { path: tool.path } : {}),
      ...(typeof tool.glob === "string" ? { glob: tool.glob } : {}),
      ...(typeof tool.baseUrl === "string" ? { baseUrl: tool.baseUrl } : {}),
      ...(tool.engine === "postgres" || tool.engine === "mysql" || tool.engine === "sqlite"
        ? { engine: tool.engine }
        : {}),
    }));
}

function coerceAgents(agents: unknown): AgentSpec["agents"] {
  if (!Array.isArray(agents)) return undefined;
  return agents
    .filter((agent): agent is Record<string, unknown> => typeof agent === "object" && agent !== null)
    .map((agent, index) => ({
      id: typeof agent.id === "string" && agent.id.length > 0 ? agent.id : `agent-${index + 1}`,
      role: typeof agent.role === "string" && agent.role.length > 0 ? agent.role : "Sub-agent",
      instructions: typeof agent.instructions === "string" ? agent.instructions : "",
      dependsOn: Array.isArray(agent.dependsOn) ? agent.dependsOn.map(String) : [],
      ...(typeof agent.memory === "object" && agent.memory !== null
        ? {
            memory: {
              reads: Array.isArray((agent.memory as Record<string, unknown>).reads)
                ? (agent.memory as { reads: unknown[] }).reads.map(String)
                : [],
              writes: Array.isArray((agent.memory as Record<string, unknown>).writes)
                ? (agent.memory as { writes: unknown[] }).writes.map(String)
                : [],
            },
          }
        : {}),
    }));
}

function coerceUi(ui: unknown, fallback: AgentUi): AgentUi {
  if (typeof ui !== "object" || ui === null) return fallback;
  const raw = ui as Record<string, unknown>;
  const themeRaw =
    typeof raw.theme === "object" && raw.theme !== null
      ? (raw.theme as Record<string, unknown>)
      : {};

  return {
    template: pickEnum(raw.template, UI_TEMPLATES, fallback.template),
    layout: pickEnum(raw.layout, UI_LAYOUTS, fallback.layout),
    welcomeMessage:
      typeof raw.welcomeMessage === "string" ? raw.welcomeMessage : fallback.welcomeMessage,
    starterPrompts: Array.isArray(raw.starterPrompts)
      ? raw.starterPrompts.map(String)
      : fallback.starterPrompts,
    theme: {
      primaryColor:
        typeof themeRaw.primaryColor === "string"
          ? themeRaw.primaryColor
          : fallback.theme.primaryColor,
      accentColor:
        typeof themeRaw.accentColor === "string"
          ? themeRaw.accentColor
          : fallback.theme.accentColor,
      backgroundColor:
        typeof themeRaw.backgroundColor === "string"
          ? themeRaw.backgroundColor
          : fallback.theme.backgroundColor,
      fontFamily: pickEnum(themeRaw.fontFamily, UI_FONTS, fallback.theme.fontFamily),
      borderRadius: pickEnum(themeRaw.borderRadius, UI_RADII, fallback.theme.borderRadius),
      mode: pickEnum(themeRaw.mode, UI_MODES, fallback.theme.mode),
    },
  };
}

function coerceDeployment(
  deployment: unknown,
  fallback: AgentDeployment
): AgentDeployment {
  if (typeof deployment !== "object" || deployment === null) return fallback;
  const raw = deployment as Record<string, unknown>;
  const files = Array.isArray(raw.files)
    ? raw.files
        .filter((file): file is Record<string, unknown> => typeof file === "object" && file !== null)
        .map((file) => {
          const path = typeof file.path === "string" ? file.path : "index.html";
          return {
            path,
            language: pickEnum(
              file.language,
              DEPLOYMENT_LANGUAGES,
              path.endsWith(".tsx") ? "tsx" : path.endsWith(".html") ? "html" : "typescript"
            ),
            content: typeof file.content === "string" ? file.content : "",
          };
        })
    : fallback.files;

  return {
    platform: pickEnum(raw.platform, DEPLOYMENT_PLATFORMS, fallback.platform),
    files,
    ...(typeof raw.frontendGenerated === "boolean"
      ? { frontendGenerated: raw.frontendGenerated }
      : fallback.frontendGenerated !== undefined
        ? { frontendGenerated: fallback.frontendGenerated }
        : {}),
    ...(typeof raw.lastFrontendInstruction === "string"
      ? { lastFrontendInstruction: raw.lastFrontendInstruction }
      : fallback.lastFrontendInstruction
        ? { lastFrontendInstruction: fallback.lastFrontendInstruction }
        : {}),
  };
}

/** Lenient parse for streamed/partial specs so the canvas never resets to empty. */
export function normalizeAgentSpec(
  input: unknown,
  fallback: AgentSpec = defaultAgentSpec
): AgentSpec {
  const parsed = agentSpecSchema.safeParse(input);
  if (parsed.success) return parsed.data;

  if (!input || typeof input !== "object") return fallback;

  const raw = input as Record<string, unknown>;
  const coerced = {
    name: typeof raw.name === "string" ? raw.name : fallback.name,
    persona: {
      role:
        typeof (raw.persona as Record<string, unknown> | undefined)?.role === "string"
          ? (raw.persona as { role: string }).role
          : fallback.persona.role,
      tone:
        typeof (raw.persona as Record<string, unknown> | undefined)?.tone === "string"
          ? (raw.persona as { tone: string }).tone
          : fallback.persona.tone,
    },
    instructions:
      typeof raw.instructions === "string" ? raw.instructions : fallback.instructions,
    tools: coerceTools(raw.tools, fallback.tools),
    ...(raw.agents !== undefined
      ? { agents: coerceAgents(raw.agents) }
      : fallback.agents
        ? { agents: fallback.agents }
        : {}),
    ...(Array.isArray(raw.swarmMemory)
      ? { swarmMemory: raw.swarmMemory }
      : fallback.swarmMemory
        ? { swarmMemory: fallback.swarmMemory }
        : {}),
    ...(raw.envVars && typeof raw.envVars === "object" && !Array.isArray(raw.envVars)
      ? { envVars: raw.envVars as Record<string, string> }
      : fallback.envVars
        ? { envVars: fallback.envVars }
        : {}),
    ...(typeof raw.voice === "object" && raw.voice !== null
      ? { voice: raw.voice }
      : fallback.voice
        ? { voice: fallback.voice }
        : {}),
    ui: coerceUi(raw.ui, fallback.ui ?? defaultAgentUi),
    deployment: coerceDeployment(raw.deployment, fallback.deployment ?? defaultAgentDeployment),
  };

  const result = agentSpecSchema.safeParse(coerced);
  return result.success ? result.data : fallback;
}

export function mergeAgentSpec(
  current: AgentSpec,
  patch: AgentSpecPatch
): AgentSpec {
  let mergedMemory = current.swarmMemory;
  if (patch.swarmMemory) {
    const existingByKey = new Map(
      (current.swarmMemory ?? []).map((k) => [k.key, k])
    );
    for (const key of patch.swarmMemory) {
      existingByKey.set(key.key, key);
    }
    mergedMemory = Array.from(existingByKey.values());
  }

  const currentUi = current.ui ?? defaultAgentUi;
  const patchUi = patch.ui;
  const mergedUi = patchUi
    ? {
        template: patchUi.template ?? currentUi.template,
        layout: patchUi.layout ?? currentUi.layout,
        welcomeMessage: patchUi.welcomeMessage ?? currentUi.welcomeMessage,
        starterPrompts: patchUi.starterPrompts ?? currentUi.starterPrompts,
        theme: {
          ...currentUi.theme,
          ...patchUi.theme,
        },
      }
    : currentUi;

  const currentDeployment = current.deployment ?? defaultAgentDeployment;
  const patchDeployment = patch.deployment;
  const mergedDeployment = patchDeployment
    ? {
        platform: patchDeployment.platform ?? currentDeployment.platform,
        files: patchDeployment.files ?? currentDeployment.files,
        frontendGenerated:
          patchDeployment.frontendGenerated ?? currentDeployment.frontendGenerated,
        lastFrontendInstruction:
          patchDeployment.lastFrontendInstruction ??
          currentDeployment.lastFrontendInstruction,
      }
    : currentDeployment;

  const currentVoice = current.voice;
  const patchVoice = patch.voice;
  // Re-parse through the schema so normalize transform applies again — any
  // bad model name in the patch gets whitelisted away before merging.
  const mergedVoice = patchVoice
    ? agentVoiceSchema.parse({
        enabled: patchVoice.enabled ?? currentVoice?.enabled ?? true,
        voiceId: patchVoice.voiceId ?? currentVoice?.voiceId,
        ttsModel: patchVoice.ttsModel ?? currentVoice?.ttsModel,
        sttModel: patchVoice.sttModel ?? currentVoice?.sttModel,
      })
    : currentVoice;

  const merged: AgentSpec = {
    name: patch.name ?? current.name,
    persona: {
      role: patch.persona?.role ?? current.persona.role,
      tone: patch.persona?.tone ?? current.persona.tone,
    },
    instructions: patch.instructions ?? current.instructions,
    tools: patch.tools ?? current.tools,
    agents: patch.agents
      ? (patch.agents as AgentSpec["agents"])
      : current.agents,
    swarmMemory: mergedMemory,
    envVars: patch.envVars
      ? { ...(current.envVars ?? {}), ...patch.envVars }
      : current.envVars,
    ...(mergedVoice ? { voice: mergedVoice } : {}),
    ui: mergedUi,
    deployment: mergedDeployment,
  };

  const result = agentSpecSchema.safeParse(merged);
  if (result.success) return result.data;
  return normalizeAgentSpec(merged, current);
}

export function mergeAgentSpecSafe(
  current: AgentSpec,
  patch: AgentSpecPatch
): { spec: AgentSpec } | { error: string } {
  try {
    return { spec: mergeAgentSpec(current, patch) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid agent spec patch",
    };
  }
}

export function parseAgentSpec(data: unknown): AgentSpec | null {
  const normalized = normalizeAgentSpec(data);
  return agentSpecSchema.safeParse(normalized).success ? normalized : null;
}

export function isAgentSpecEmpty(spec: AgentSpec): boolean {
  return (
    spec.name === defaultAgentSpec.name &&
    !spec.persona.role &&
    !spec.persona.tone &&
    !spec.instructions &&
    spec.tools.length === 0 &&
    !spec.agents?.length
  );
}

export function hasCustomDesign(spec: AgentSpec): boolean {
  return Boolean(
    spec.deployment?.frontendGenerated ||
    spec.deployment?.files.some((f) => f.path === "index.html" && f.content.trim())
  );
}
