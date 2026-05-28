import JSZip from "jszip";
import type { AgentSpec } from "./agent-spec";
import { resolveAgentUi } from "./agent-ui";
import { buildDeployThemeCss } from "./deploy-html";
import { syncDeployment } from "./deployment-templates";

const MEMORY_TEMPLATE_COMMENT_RE = /\{\{memory\.([a-zA-Z0-9_]+)\}\}/g;

function annotateMemoryTemplates(text: string): string {
  return text.replace(
    MEMORY_TEMPLATE_COMMENT_RE,
    (_, key) => `[memory.${key} — injected at runtime]`
  );
}

function buildAgentMarkdown(spec: AgentSpec): string {
  const ui = resolveAgentUi(spec.ui);
  const deployment = syncDeployment(spec);
  const toolsList =
    spec.tools.length > 0
      ? spec.tools.map((t) => `- **${t.name}** (\`${t.type}\`)`).join("\n")
      : "_No tools configured._";

  const instructions = annotateMemoryTemplates(
    spec.instructions || "_No instructions yet._"
  );

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
${agentsSection}
## Deployed UI

- **Template:** ${ui.template}
- **Layout:** ${ui.layout}
- **Theme mode:** ${ui.theme.mode}
- **Primary color:** ${ui.theme.primaryColor}
- **Font:** ${ui.theme.fontFamily}
- **Welcome message:** ${ui.welcomeMessage ?? "Default"}

## Deployment

- **Platform:** ${deployment.platform}
- **Files:** ${deployment.files.map((f) => f.path).join(", ") || "None"}
`;
}

function buildThemeCss(spec: AgentSpec): string {
  return buildDeployThemeCss(spec);
}

function buildReadme(spec: AgentSpec): string {
  const deployment = syncDeployment(spec);
  const ui = resolveAgentUi(spec.ui);
  const hasMemory = spec.swarmMemory && spec.swarmMemory.length > 0;
  const memoryNote = hasMemory
    ? `- \`memory-schema.json\` — shared memory key definitions\n`
    : "";

  return `# ${spec.name}

This bundle was exported from **Swarm Agent Builder**.

## Contents

- \`agent.json\` — machine-readable agent specification (includes UI theme and deployment config)
- \`agent.md\` — human-readable system prompt, persona, tools, and design notes
- \`theme.css\` — CSS variables for the deployed agent theme
${deployment.files.map((f) => `- \`${f.path}\` — ${f.language} deployment source`).join("\n")}
${memoryNote}
## Usage

Import \`agent.json\` into your agent runtime, or use \`agent.md\` as a system prompt template.
Link \`theme.css\` in your deployed UI to apply the configured brand colors and typography.

For ${deployment.platform} deployment, start with the generated source files and wire them to your agent API endpoint.

## Agent Summary

- **Role:** ${spec.persona.role || "Not set"}
- **Tools:** ${spec.tools.map((t) => t.name).join(", ") || "None"}
- **UI template:** ${ui.template} (${ui.layout})
- **Platform:** ${deployment.platform}
${hasMemory ? `- **Memory keys:** ${spec.swarmMemory!.map((k) => k.key).join(", ")}` : ""}
`;
}

export async function exportAgentBundle(spec: AgentSpec): Promise<Blob> {
  const zip = new JSZip();
  const deployment = syncDeployment(spec);
  const exportSpec = {
    ...spec,
    ui: resolveAgentUi(spec.ui),
    deployment,
  };

  zip.file("agent.json", JSON.stringify(exportSpec, null, 2));
  zip.file("agent.md", buildAgentMarkdown(spec));
  zip.file("README.md", buildReadme(spec));
  zip.file("theme.css", buildThemeCss(spec));

  for (const file of deployment.files) {
    zip.file(file.path, file.content);
  }

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
