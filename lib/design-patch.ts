import { generateText } from "ai";
import type { AgentSpec } from "@/lib/agent-spec";
import { extractHtmlFromLlmOutput } from "@/lib/frontend-codegen";
import { injectChatRuntime } from "@/lib/frontend-runtime";
import { withLlmRetry } from "@/lib/llm";
import type { DesignSelection } from "@/lib/design-inspector";

function buildDesignPatchPrompt(
  spec: Pick<AgentSpec, "name" | "persona">,
  html: string,
  selection: DesignSelection,
  instruction: string
): string {
  const doc =
    html.length > 14000
      ? html.slice(0, 14000) + "\n<!-- document truncated -->"
      : html;

  return `You are a frontend designer making a targeted edit to one element in a deployed agent UI.

## Agent
- Name: ${spec.name}
- Role: ${spec.persona.role || "AI assistant"}

## Selected element (data-design-id="${selection.id}")
Label: ${selection.label}
Tag: ${selection.tagName}

\`\`\`html
${selection.outerHTML}
\`\`\`

## User's change request
${instruction}

## Rules
1. Apply the change ONLY to the selected element (and its descendants if needed for the edit).
2. Keep every other part of the document byte-identical unless required for the edit.
3. Preserve all element IDs required for chat: chat-form, chat-input, chat-send, chat-log, welcome.
4. Keep data-design-id attributes stable where possible.
5. Output the COMPLETE HTML document (<!DOCTYPE html> through </html>).

## Full current document
\`\`\`html
${doc}
\`\`\`

Output ONLY the raw complete HTML. No markdown fences. No explanation.`;
}

export async function patchDesignElement(
  spec: Pick<AgentSpec, "name" | "persona">,
  html: string,
  selection: DesignSelection,
  instruction: string
): Promise<string> {
  const { text } = await withLlmRetry(
    (model) =>
      generateText({
        model,
        prompt: buildDesignPatchPrompt(spec, html, selection, instruction),
        maxOutputTokens: 12000,
        maxRetries: 0,
      }),
    { maxAttempts: 3 }
  );

  const patched = extractHtmlFromLlmOutput(text);
  if (!patched) {
    throw new Error(
      "Could not apply the design change. Try describing the edit differently."
    );
  }

  return injectChatRuntime(patched);
}
