import type { AgentSpec } from "@/lib/agent-spec";
import { resolveAgentUi } from "@/lib/agent-ui";

export const FRONTEND_RUNTIME_CONTRACT = `
## Required chat runtime (must work when deployed)

Your HTML MUST include these element IDs so the live chat works:
- \`<form id="chat-form">\` wrapping the composer
- \`<input id="chat-input">\` or \`<textarea id="chat-input">\`
- \`<button id="chat-send" type="submit">\`
- \`<div id="chat-log">\` for messages (hidden until first message; add class "active" when showing)
- Optional: \`<div id="welcome">\` for empty state (add class "hidden" when chat starts)

Starter prompt buttons MUST use \`data-starter="the prompt text"\` and \`type="button"\`.

Include this CSS minimum for chat messages (you may restyle freely):
\`\`\`css
.chat-log { display: none; flex-direction: column; gap: 12px; }
.chat-log.active { display: flex; }
#welcome.hidden { display: none; }
.msg { padding: 10px 14px; border-radius: 8px; white-space: pre-wrap; font-size: 14px; line-height: 1.5; }
.msg.user { align-self: flex-end; max-width: 85%; }
.msg.assistant { align-self: flex-start; max-width: 90%; }
\`\`\`

Do NOT include fetch/API JavaScript — a runtime script is injected automatically.
`.trim();

export function buildFrontendCodegenPrompt(
  spec: AgentSpec,
  instruction: string,
  currentHtml?: string
): string {
  const ui = resolveAgentUi(spec.ui);
  const starters = ui.starterPrompts ?? [];
  const welcome =
    ui.welcomeMessage ?? `Hi! I'm ${spec.name}. How can I help you today?`;

  const agentContext = `
## Agent context (weave into the UI copy and visual tone)

- **Name:** ${spec.name}
- **Role:** ${spec.persona.role || "AI assistant"}
- **Tone:** ${spec.persona.tone || "helpful and professional"}
- **What it does:** ${spec.instructions.slice(0, 800) || "General-purpose assistant"}
- **Tools:** ${spec.tools.map((t) => t.name).join(", ") || "none"}
- **Welcome message to display:** ${welcome}
- **Starter prompts:** ${starters.length ? starters.map((s) => `"${s}"`).join(", ") : "generate 2–3 relevant starters based on the agent's purpose"}
`.trim();

  const revisionBlock = currentHtml
    ? `
## Current HTML (revise this — output the COMPLETE new document)

Apply the user's requested changes. Keep what works; rewrite what doesn't. Output the full document, not a diff.

\`\`\`html
${currentHtml.slice(0, 12000)}${currentHtml.length > 12000 ? "\n<!-- truncated for context -->" : ""}
\`\`\`
`
    : "";

  return `You are an expert frontend designer and developer. Generate a **complete, unique, self-contained HTML page** for this AI agent's chat interface.

${agentContext}

## User's design request

${instruction}

${revisionBlock}

## Your task

Output ONE complete HTML document (<!DOCTYPE html> through </html>). Requirements:

1. **Unique design** — Do NOT use a generic chat widget template. The visual design must reflect this specific agent's domain, audience, and personality. Vary layout, typography, color palette, spacing, and decorative elements every time.
2. **Self-contained** — All CSS in \`<style>\` tags. No external CDN links. No frameworks.
3. **Production quality** — Responsive, accessible contrast, polished typography, thoughtful micro-interactions via CSS only.
4. **Agent-specific copy** — Headlines, welcome text, and starter prompts must reference what THIS agent actually does.
5. **Complete document** — Always output the FULL HTML. Never a snippet, diff, or partial update.

${FRONTEND_RUNTIME_CONTRACT}

## Output format

Output ONLY the raw HTML document. No markdown fences. No explanation before or after. Start with <!DOCTYPE html>.`;
}
