import { z } from "zod";

export const toolSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.literal("web_search"),
});

export const swarmAgentSchema = z.object({
  id: z.string(),
  role: z.string(),
  instructions: z.string(),
  dependsOn: z.array(z.string()),
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
});

export const agentSpecPatchSchema = agentSpecSchema.partial().extend({
  persona: z
    .object({
      role: z.string().optional(),
      tone: z.string().optional(),
    })
    .optional(),
});

export type AgentSpec = z.infer<typeof agentSpecSchema>;
export type AgentSpecPatch = z.infer<typeof agentSpecPatchSchema>;
export type SwarmAgent = z.infer<typeof swarmAgentSchema>;

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
  const merged: AgentSpec = {
    name: patch.name ?? current.name,
    persona: {
      role: patch.persona?.role ?? current.persona.role,
      tone: patch.persona?.tone ?? current.persona.tone,
    },
    instructions: patch.instructions ?? current.instructions,
    tools: patch.tools ?? current.tools,
    agents: patch.agents ?? current.agents,
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
