import type { AgentSpec } from "@/lib/agent-spec";
import { FRONTEND_RUNTIME_CONTRACT } from "@/lib/frontend-codegen-prompt";

export const FRONTEND_DESIGN_GUIDE = `
## Frontend design (unique HTML per agent)

The deployed UI is **unique HTML you write via \`updateDeploymentCode\`** — not from fixed templates.

### When to generate the frontend

- After persona, instructions, and tools are configured, call \`updateDeploymentCode\` with a complete \`index.html\` file.
- When the user asks to change the look, call \`updateDeploymentCode\` again with a **complete revised** \`index.html\` (full document, not a diff).
- Call \`updateAgentUi\` first if you need to set welcome message / starter prompts that should appear in the HTML copy.

### How to write the HTML

1. **Unique design** — Tailor layout, colors, typography, and mood to this agent's domain. Never reuse a generic chat widget.
2. **Self-contained** — All CSS in \`<style>\` tags. No CDN links. No frameworks.
3. **Agent-specific copy** — Headlines, welcome text, and starters must reference what THIS agent does.
4. **Complete document** — Always output the FULL \`<!DOCTYPE html>\` through \`</html>\`.

${FRONTEND_RUNTIME_CONTRACT}

### Tool usage

- Write HTML ONLY via \`updateDeploymentCode\` with \`{ path: "index.html", language: "html", content: "..." }\`.
- Never paste HTML in chat text — users preview in the Design tab.
- Do NOT call any separate frontend generation tool — you generate the HTML yourself in the tool call.
`.trim();

export function buildFrontendDesignContext(spec: AgentSpec): string {
  const welcome = spec.ui?.welcomeMessage ?? `Hi! I'm ${spec.name}. How can I help?`;
  const starters = spec.ui?.starterPrompts?.join(", ") ?? "(create 2–3 domain-specific starters)";

  return `
### Agent context for frontend copy
- Name: ${spec.name}
- Role: ${spec.persona.role || "AI assistant"}
- Tone: ${spec.persona.tone || "professional"}
- Purpose: ${spec.instructions.slice(0, 500) || "general assistant"}
- Welcome message: ${welcome}
- Starter prompts: ${starters}
`.trim();
}
