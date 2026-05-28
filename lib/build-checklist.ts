import type { AgentSpec } from "@/lib/agent-spec";
import { defaultAgentSpec, hasCustomDesign } from "@/lib/agent-spec";
import { inferVoiceFromSpec } from "@/lib/voice";
import { hasVoiceFrontendHtml, shouldRefreshVoiceHtml } from "@/lib/voice-frontend-template";

export type BuildCheckItem = {
  id: string;
  label: string;
  done: boolean;
  required: boolean;
};

export function getBuildChecklist(spec: AgentSpec): BuildCheckItem[] {
  const isVoice = inferVoiceFromSpec(spec);
  const hasHtml = Boolean(
    spec.deployment?.files.find((f) => f.path === "index.html" && f.content.trim())
  );
  const voiceHtmlOk =
    !isVoice ||
    (hasVoiceFrontendHtml(spec) && !shouldRefreshVoiceHtml(spec));

  return [
    {
      id: "persona",
      label: "Persona (name + role)",
      done: spec.name !== defaultAgentSpec.name && Boolean(spec.persona.role),
      required: true,
    },
    {
      id: "instructions",
      label: "Instructions",
      done: Boolean(spec.instructions.trim()),
      required: true,
    },
    {
      id: "voice",
      label: "Voice enabled (ElevenLabs)",
      done: Boolean(spec.voice?.enabled) || isVoice,
      required: isVoice,
    },
    {
      id: "frontend",
      label: isVoice ? "Voice call UI (index.html)" : "Frontend (index.html)",
      done: hasHtml && voiceHtmlOk,
      required: true,
    },
    {
      id: "tools",
      label: "Tools configured",
      done: spec.tools.length > 0,
      required: false,
    },
  ];
}

export function isBuildComplete(spec: AgentSpec): boolean {
  return getBuildChecklist(spec)
    .filter((item) => item.required)
    .every((item) => item.done);
}

export function formatBuildChecklist(spec: AgentSpec): string {
  const items = getBuildChecklist(spec);
  const lines = items.map(
    (item) =>
      `- [${item.done ? "x" : " "}] ${item.label}${item.required ? " (required)" : ""}`
  );
  const complete = isBuildComplete(spec);
  return `## Build checklist (${complete ? "COMPLETE" : "INCOMPLETE — keep calling tools until all required items are done"})\n${lines.join("\n")}`;
}

export function hasAgentContent(spec: AgentSpec): boolean {
  return (
    spec.name !== defaultAgentSpec.name ||
    Boolean(spec.persona.role) ||
    Boolean(spec.instructions) ||
    spec.tools.length > 0 ||
    hasCustomDesign(spec)
  );
}
