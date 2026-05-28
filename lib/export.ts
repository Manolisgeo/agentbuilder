import JSZip from "jszip";
import type { AgentSpec } from "./agent-spec";

function buildAgentMarkdown(spec: AgentSpec): string {
  const toolsList =
    spec.tools.length > 0
      ? spec.tools.map((t) => `- **${t.name}** (\`${t.type}\`)`).join("\n")
      : "_No tools configured._";

  return `# ${spec.name}

## Persona

- **Role:** ${spec.persona.role || "Not set"}
- **Tone:** ${spec.persona.tone || "Not set"}

## Instructions

${spec.instructions || "_No instructions yet._"}

## Tools

${toolsList}
`;
}

function buildReadme(spec: AgentSpec): string {
  return `# ${spec.name}

This bundle was exported from **Swarm Agent Builder**.

## Contents

- \`agent.json\` — machine-readable agent specification
- \`agent.md\` — human-readable system prompt, persona, and tools

## Usage

Import \`agent.json\` into your agent runtime, or use \`agent.md\` as a system prompt template.

## Agent Summary

- **Role:** ${spec.persona.role || "Not set"}
- **Tools:** ${spec.tools.map((t) => t.name).join(", ") || "None"}
`;
}

export async function exportAgentBundle(spec: AgentSpec): Promise<Blob> {
  const zip = new JSZip();

  zip.file("agent.json", JSON.stringify(spec, null, 2));
  zip.file("agent.md", buildAgentMarkdown(spec));
  zip.file("README.md", buildReadme(spec));

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
