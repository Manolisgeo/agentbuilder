import { defaultAgentSpec, isAgentSpecEmpty, type AgentSpec } from "./agent-spec";

export function buildAgentRuntimePrompt(spec: AgentSpec): string {
  const toolsSection =
    spec.tools.length > 0
      ? `\n\nAvailable capabilities:\n${spec.tools.map((t) => `- ${t.name} (${t.type.replace("_", " ")})`).join("\n")}\n\nNote: This is a preview session — external tools are not live. If a task would use a tool, explain your approach and provide the best answer you can from context.`
      : "";

  const swarmSection =
    spec.agents && spec.agents.length > 0
      ? `\n\nYou may coordinate sub-agents with these roles:\n${spec.agents.map((a) => `- ${a.role}: ${a.instructions}`).join("\n")}`
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

export function isAgentPreviewReady(spec: AgentSpec): boolean {
  return (
    !isAgentSpecEmpty(spec) &&
    spec.name !== defaultAgentSpec.name &&
    Boolean(spec.persona.role) &&
    Boolean(spec.instructions)
  );
}
