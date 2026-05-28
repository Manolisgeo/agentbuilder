import { defaultAgentSpec, isAgentSpecEmpty, type AgentSpec } from "./agent-spec";

type RuntimePromptOptions = {
  liveTools?: boolean;
  swarmMode?: boolean;
};

export function hasWebSearchTool(spec: AgentSpec): boolean {
  return spec.tools.some((tool) => tool.type === "web_search");
}

export function buildAgentRuntimePrompt(
  spec: AgentSpec,
  options: RuntimePromptOptions = {}
): string {
  const { liveTools = false, swarmMode = false } = options;
  const hasSearch = hasWebSearchTool(spec);

  let toolsSection = "";
  if (spec.tools.length > 0) {
    const capabilityLines = spec.tools
      .map((tool) => `- ${tool.name} (${tool.type.replace("_", " ")})`)
      .join("\n");

    if (liveTools && hasSearch) {
      toolsSection = `\n\n## Live capabilities\n${capabilityLines}\n\nYou have access to the \`web_search\` tool for real-time information. Call it when the user asks about current events, recent news, live data, or anything that requires up-to-date web results. After searching, synthesize a clear answer and cite sources by title when relevant.`;
    } else if (hasSearch && swarmMode) {
      toolsSection = `\n\n## Capabilities\n${capabilityLines}\n\nWeb search may already have been run by a sub-agent — use any provided search context in your final answer and cite sources naturally.`;
    } else if (hasSearch) {
      toolsSection = `\n\n## Capabilities\n${capabilityLines}\n\nWeb search is configured but unavailable in this session (missing API key). Answer from general knowledge and note when live data would help.`;
    } else {
      toolsSection = `\n\n## Capabilities\n${capabilityLines}`;
    }
  }

  const swarmSection =
    spec.agents && spec.agents.length > 0
      ? `\n\n## Swarm coordination\nYou orchestrate these specialist sub-agents:\n${spec.agents
          .map(
            (agent) =>
              `- **${agent.role}** (id: \`${agent.id}\`)${agent.dependsOn.length ? ` — depends on: ${agent.dependsOn.join(", ")}` : ""}\n  ${agent.instructions}`
          )
          .join("\n")}\n\nWhen responding after delegation, synthesize sub-agent work into one cohesive end-user answer.`
      : "";

  return `You are ${spec.name}, an AI agent deployed for end users.

## Persona
- Role: ${spec.persona.role}
- Tone: ${spec.persona.tone || "Helpful and clear"}

## Instructions
${spec.instructions}
${toolsSection}${swarmSection}

Stay fully in character. You are speaking with an end user — not a developer. Be helpful, concise, and true to your defined tone.`;
}

export function buildOrchestratorRuntimePrompt(spec: AgentSpec): string {
  const subAgents = spec.agents ?? [];
  const subAgentList =
    subAgents.length > 0
      ? subAgents
          .map(
            (agent) =>
              `- id: "${agent.id}" | role: ${agent.role}${agent.dependsOn.length ? ` | depends on: ${agent.dependsOn.join(", ")}` : ""}\n  Instructions: ${agent.instructions}`
          )
          .join("\n")
      : "No sub-agents configured.";

  const searchNote = hasWebSearchTool(spec)
    ? "Live web search is available — set needsWebSearch when fresh web data would help."
    : "Web search is not configured for this agent.";

  return `You are the routing orchestrator for "${spec.name}".

## Orchestrator role
${spec.persona.role}

## Orchestrator instructions
${spec.instructions || "Route work to the best sub-agent when specialist expertise is needed."}

## Sub-agents
${subAgentList}

## Routing rules
- Pick the single best sub-agent when the request matches a specialist role.
- Use subAgentId null only for simple greetings, clarifications, or when no sub-agent fits.
- ${searchNote}
- searchQuery should be a focused query string when needsWebSearch is true.
- routingMessage should read like a live status update (e.g. "Routing to Research Agent…").`;
}

export function buildSubAgentRuntimePrompt(agent: {
  role: string;
  instructions: string;
}): string {
  return `You are a specialist sub-agent in a coordinated swarm.

## Role
${agent.role}

## Instructions
${agent.instructions}

Produce focused specialist output for the orchestrator. Do not address the end user directly — your output will be synthesized by the orchestrator.`;
}

export function isAgentPreviewReady(spec: AgentSpec): boolean {
  return (
    !isAgentSpecEmpty(spec) &&
    spec.name !== defaultAgentSpec.name &&
    Boolean(spec.persona.role) &&
    Boolean(spec.instructions)
  );
}

export function isLivePreviewAvailable(spec: AgentSpec): boolean {
  return hasWebSearchTool(spec);
}
