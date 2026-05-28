import { z } from "zod";

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
  // collected credentials / env vars (key → value, e.g. GOOGLE_CLIENT_ID)
  envVars: z.record(z.string(), z.string()).optional(),
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
});

export type AgentSpec = z.infer<typeof agentSpecSchema>;
export type AgentSpecPatch = z.infer<typeof agentSpecPatchSchema>;
export type SwarmAgent = z.infer<typeof swarmAgentSchema>;
export type SwarmMemoryKey = z.infer<typeof swarmMemoryKeySchema>;

export const defaultAgentSpec: AgentSpec = {
  name: "Untitled Agent",
  persona: { role: "", tone: "" },
  instructions: "",
  tools: [],
};

export const MAX_SWARM_AGENTS = 4;

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
  };

  return agentSpecSchema.parse(merged);
}

export function parseAgentSpec(data: unknown): AgentSpec | null {
  const result = agentSpecSchema.safeParse(data);
  return result.success ? result.data : null;
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
