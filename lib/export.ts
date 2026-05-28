import JSZip from "jszip";
import type { AgentSpec } from "./agent-spec";

const MEMORY_TEMPLATE_COMMENT_RE = /\{\{memory\.([a-zA-Z0-9_]+)\}\}/g;

function annotateMemoryTemplates(text: string): string {
  return text.replace(
    MEMORY_TEMPLATE_COMMENT_RE,
    (_, key) => `[memory.${key} — injected at runtime]`
  );
}

function buildAgentMarkdown(spec: AgentSpec): string {
  const toolsList =
    spec.tools.length > 0
      ? spec.tools.map((t) => `- **${t.name}** (\`${t.type}\`)`).join("\n")
      : "_No tools configured._";

  const instructions = annotateMemoryTemplates(spec.instructions || "_No instructions yet._");

  const agentsSection =
    spec.agents && spec.agents.length > 0
      ? `\n## Sub-agents\n\n${spec.agents
          .map(
            (a) =>
              `### ${a.role}\n\n${annotateMemoryTemplates(a.instructions)}${
                a.memory?.reads?.length
                  ? `\n\n**Reads:** ${a.memory.reads.join(", ")}`
                  : ""
              }${
                a.memory?.writes?.length
                  ? `\n\n**Writes:** ${a.memory.writes.join(", ")}`
                  : ""
              }`
          )
          .join("\n\n---\n\n")}\n`
      : "";

  return `# ${spec.name}

## Persona

- **Role:** ${spec.persona.role || "Not set"}
- **Tone:** ${spec.persona.tone || "Not set"}

## Instructions

${instructions}

## Tools

${toolsList}
${agentsSection}`;
}

function buildReadme(spec: AgentSpec): string {
  const hasMemory = spec.swarmMemory && spec.swarmMemory.length > 0;
  const memoryNote = hasMemory
    ? `- \`memory-schema.json\` — shared memory key definitions\n`
    : "";

  return `# ${spec.name}

This bundle was exported from **Swarm Agent Builder**.

## Contents

- \`agent.json\` — machine-readable agent specification
- \`agent.md\` — human-readable system prompt, persona, and tools
${memoryNote}
## Usage

Import \`agent.json\` into your agent runtime, or use \`agent.md\` as a system prompt template.

## Agent Summary

- **Role:** ${spec.persona.role || "Not set"}
- **Tools:** ${spec.tools.map((t) => t.name).join(", ") || "None"}
${hasMemory ? `- **Memory keys:** ${spec.swarmMemory!.map((k) => k.key).join(", ")}` : ""}
`;
}

export async function exportAgentBundle(spec: AgentSpec): Promise<Blob> {
  const zip = new JSZip();

  zip.file("agent.json", JSON.stringify(spec, null, 2));
  zip.file("agent.md", buildAgentMarkdown(spec));
  zip.file("README.md", buildReadme(spec));

  if (spec.swarmMemory && spec.swarmMemory.length > 0) {
    zip.file("memory-schema.json", JSON.stringify(spec.swarmMemory, null, 2));
  }

  return zip.generateAsync({ type: "blob" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadAgentBundle(spec: AgentSpec) {
  const blob = await exportAgentBundle(spec);
  const safeName = spec.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
  downloadBlob(blob, `${safeName || "agent"}-bundle.zip`);
}
