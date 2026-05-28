import {
  agentSpecSchema,
  MAX_SWARM_AGENTS,
  type AgentSpec,
  type SwarmAgent,
} from "@/lib/agent-spec";

export function updatePersona(
  spec: AgentSpec,
  patch: { name?: string; role?: string; tone?: string }
): AgentSpec {
  return agentSpecSchema.parse({
    ...spec,
    name: patch.name ?? spec.name,
    persona: {
      role: patch.role ?? spec.persona.role,
      tone: patch.tone ?? spec.persona.tone,
    },
  });
}

export function updateInstructions(
  spec: AgentSpec,
  instructions: string,
  mode: "replace" | "append" = "replace"
): AgentSpec {
  const merged =
    mode === "append" && spec.instructions
      ? `${spec.instructions.trim()}\n\n${instructions.trim()}`
      : instructions;
  return agentSpecSchema.parse({ ...spec, instructions: merged });
}

export function addTool(
  spec: AgentSpec,
  tool: { id: string; name: string; type: string }
): AgentSpec {
  if (spec.tools.some((t) => t.id === tool.id)) {
    return agentSpecSchema.parse({
      ...spec,
      tools: spec.tools.map((t) => (t.id === tool.id ? tool : t)),
    });
  }
  return agentSpecSchema.parse({
    ...spec,
    tools: [...spec.tools, tool],
  });
}

export function removeTool(spec: AgentSpec, id: string): AgentSpec {
  return agentSpecSchema.parse({
    ...spec,
    tools: spec.tools.filter((t) => t.id !== id),
  });
}

export function addSubAgent(spec: AgentSpec, agent: SwarmAgent): AgentSpec {
  const agents = spec.agents ?? [];
  if (agents.length >= MAX_SWARM_AGENTS && !agents.some((a) => a.id === agent.id)) {
    throw new Error(`Maximum of ${MAX_SWARM_AGENTS} sub-agents allowed`);
  }
  const existing = agents.find((a) => a.id === agent.id);
  const next = existing
    ? agents.map((a) => (a.id === agent.id ? agent : a))
    : [...agents, agent];
  return agentSpecSchema.parse({ ...spec, agents: next });
}

export function updateSubAgent(
  spec: AgentSpec,
  id: string,
  patch: Partial<Omit<SwarmAgent, "id">>
): AgentSpec {
  const agents = spec.agents ?? [];
  const index = agents.findIndex((a) => a.id === id);
  if (index === -1) {
    throw new Error(`Sub-agent "${id}" not found`);
  }
  const updated = { ...agents[index], ...patch, id };
  return agentSpecSchema.parse({
    ...spec,
    agents: agents.map((a, i) => (i === index ? updated : a)),
  });
}

export function removeSubAgent(spec: AgentSpec, id: string): AgentSpec {
  const agents = (spec.agents ?? []).filter((a) => a.id !== id);
  return agentSpecSchema.parse({
    ...spec,
    agents: agents.length > 0 ? agents : undefined,
  });
}

export function setEnvVar(spec: AgentSpec, key: string, value: string): AgentSpec {
  return agentSpecSchema.parse({
    ...spec,
    envVars: { ...(spec.envVars ?? {}), [key]: value },
  });
}
