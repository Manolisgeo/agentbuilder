import type { AgentSpec } from "@/lib/agent-spec";
import { buildVoiceFrontendHtml } from "@/lib/voice-frontend-template";
import { inferVoiceFromSpec } from "@/lib/voice";

/** Utilities for working with LLM-generated frontend HTML stored on the spec. */

const HTML_FENCE_RE = /^```(?:html)?\s*\n?([\s\S]*?)```\s*$/i;
const HTML_DOC_RE = /(<!DOCTYPE html[\s\S]*<\/html>)/i;
const HTML_ROOT_RE = /(<html[\s>][\s\S]*<\/html>)/i;

export function extractHtmlFromLlmOutput(text: string): string | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(HTML_FENCE_RE);
  if (fenced?.[1]) return fenced[1].trim();

  const doc = trimmed.match(HTML_DOC_RE);
  if (doc?.[1]) return doc[1].trim();

  const root = trimmed.match(HTML_ROOT_RE);
  if (root?.[1]) return root[1].trim();

  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return trimmed;
  }

  return null;
}

export function getAgentFrontendHtml(spec: AgentSpec): string | null {
  // Voice agents always use the prebuilt template — never trust LLM-stored
  // HTML to render the call UI correctly. This guarantees the mic button,
  // status line, and transcript always work after deploy.
  if (inferVoiceFromSpec(spec)) {
    return buildVoiceFrontendHtml(spec);
  }
  const saved = spec.deployment?.files.find((f) => f.path === "index.html")?.content;
  if (saved?.trim()) return saved;
  return null;
}
