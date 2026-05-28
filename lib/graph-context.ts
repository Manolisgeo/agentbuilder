import type { AgentSpec } from "@/lib/agent-spec";
import { resolveAgentDeployment, resolveAgentUi } from "@/lib/agent-ui";

export function formatArchitectureContext(spec: AgentSpec): string {
  const lines: string[] = ["## Current agent architecture", ""];

  lines.push(`### Persona node (id: persona)`);
  lines.push(`- Name: ${spec.name || "Untitled Agent"}`);
  lines.push(`- Role: ${spec.persona.role || "(not set)"}`);
  lines.push(`- Tone: ${spec.persona.tone || "(not set)"}`);
  lines.push("");

  if (spec.instructions) {
    lines.push(`### Instructions node (id: instructions)`);
    lines.push(spec.instructions);
    lines.push("");
  } else {
    lines.push(`### Instructions node (id: instructions) — not yet defined`);
    lines.push("");
  }

  if (spec.tools.length > 0) {
    lines.push(`### Tool nodes`);
    for (const tool of spec.tools) {
      lines.push(`- **${tool.name}** (node id: tool-${tool.id}, type: ${tool.type})`);
    }
    lines.push("");
  } else {
    lines.push(`### Tool nodes — none yet`);
    lines.push("");
  }

  if (spec.agents && spec.agents.length > 0) {
    lines.push(`### Sub-agent nodes (swarm architecture)`);
    for (const agent of spec.agents) {
      const deps =
        agent.dependsOn.length > 0
          ? agent.dependsOn.map((d) => `swarm-${d}`).join(", ")
          : "orchestrator (persona)";
      lines.push(`- **${agent.role}** (node id: swarm-${agent.id})`);
      lines.push(`  - Depends on: ${deps}`);
      lines.push(`  - Instructions: ${agent.instructions.slice(0, 200)}${agent.instructions.length > 200 ? "…" : ""}`);
    }
    lines.push("");
  }

  lines.push(`### Editing guide`);
  lines.push(`Use granular tools to edit specific nodes:`);
  lines.push(`- updatePersona — name, role, tone`);
  lines.push(`- updateInstructions — system prompt (replace or append)`);
  lines.push(`- addTool / removeTool — tool nodes connected to persona`);
  lines.push(`- addSubAgent / updateSubAgent / removeSubAgent — swarm sub-agents`);
  lines.push(`- updateAgentSpec — bulk patch when many fields change at once`);
  lines.push(`- updateAgentUi — deployed UI template, layout, theme, welcome message`);
  lines.push(`- updateDeploymentPlatform — generate HTML/TS/Python/React deployment code`);
  lines.push(`- updateDeploymentCode — customize deployment source files`);

  const ui = resolveAgentUi(spec.ui);
  const deployment = resolveAgentDeployment(spec.deployment);

  lines.push("");
  lines.push(`### Deployed UI design`);
  lines.push(`- Template: ${ui.template}`);
  lines.push(`- Layout: ${ui.layout}`);
  lines.push(`- Theme: ${ui.theme.mode} mode, primary ${ui.theme.primaryColor}, font ${ui.theme.fontFamily}`);
  lines.push(`- Welcome: ${ui.welcomeMessage ?? "(default)"}`);
  if (ui.starterPrompts?.length) {
    lines.push(`- Starter prompts: ${ui.starterPrompts.join(" | ")}`);
  }

  lines.push("");
  lines.push(`### Deployment`);
  lines.push(`- Platform: ${deployment.platform}`);
  lines.push(`- Files: ${deployment.files.length > 0 ? deployment.files.map((f) => f.path).join(", ") : "(not generated yet)"}`);

  return lines.join("\n");
}
