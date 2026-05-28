# HTML Dashboard Preview Feature

## Goal

Enable the preview-runtime agent to generate and render HTML dashboards inline in the `PreviewPanel` chat, letting users see rich visual summaries (urgent emails, news feeds, data tables, etc.) instead of plain text replies.

---

## Constraints

- AI SDK v6 (`ai` ^6.0.191) — tool output format must stay compatible with `streamText` / `createUIMessageStream`.
- Model is DeepSeek via `@ai-sdk/openai` compat — no vision; HTML must be generated as text.
- Sandbox: all HTML must run in a `<iframe srcDoc>` with a restrictive `sandbox` attribute (same pattern as `DesignPreviewPanel`).
- No new npm dependencies required; `react-syntax-highlighter` already available if code display is needed.
- Dashboard HTML is **static at render time** — agent fetches live data via existing tools first, then bakes it in. No JS `fetch` from inside the iframe.
- Only the **preview runtime** (`/api/preview`) gets the `renderDashboard` tool — the builder chat is unaffected.
- `lib/chat-display.ts:sanitizeAssistantChatText()` currently strips HTML from assistant text — we must route HTML through a tool result, not raw text output.
- `PreviewPanel` already listens for custom `data-*` parts (e.g. `data-orchestration`). Same pattern used here: `data-dashboard`.

---

## Unknowns / Risks

- **iframe sandbox scope**: `sandbox="allow-scripts"` is needed for any JS-driven charts (Chart.js CDN, etc.). Current `DesignPreviewPanel` uses `sandbox=""` (fully restricted). Decision needed: allow scripts in dashboard iframe or restrict to pure HTML/CSS only. Recommend `allow-scripts` for richer charts but log the tradeoff.
- **DeepSeek HTML quality**: DeepSeek generates decent HTML but may produce malformed fragments. Need HTML validation / fallback in the `renderDashboard` tool executor.
- **Multiple dashboard calls in one turn**: Agent might call `renderDashboard` more than once (e.g. email card + news card). The UI needs to handle N dashboard cards in one message thread.
- **Refresh / stale data**: Dashboard HTML is a snapshot. No live-update mechanism. User must re-prompt to refresh. This is acceptable for v1 but should be documented.
- **Size limits**: Large email threads or news lists could produce very large HTML strings. Should add a `MAX_DASHBOARD_HTML_BYTES` guard (~200 KB) in the tool executor.
- **Swarm mode**: When swarm is active, multiple sub-agents could each emit `data-dashboard`. The orchestration timeline and dashboard cards must not conflict in the `PreviewPanel` render order.

---

## Steps

### Phase 1 — New tool: `renderDashboard`

**1. Define tool schema in `lib/preview-tools.ts`** (new file or extend existing preview runtime tools)

```ts
// lib/preview-tools.ts  (new file)
import { tool } from "ai";
import { z } from "zod";

export const renderDashboard = tool({
  description:
    "Render a rich HTML dashboard to the user. Call this after fetching data via other tools. The html argument must be a complete, self-contained HTML document (including <style> blocks). No external fetch() calls inside the HTML.",
  parameters: z.object({
    title: z.string().describe("Short heading shown above the dashboard card"),
    html: z.string().describe("Complete HTML document to render in a sandboxed iframe"),
  }),
  execute: async ({ title, html }) => {
    if (html.length > 200_000) {
      return { success: false, error: "HTML exceeds 200 KB limit. Reduce content." };
    }
    // Basic well-formedness check
    if (!html.trim().startsWith("<")) {
      return { success: false, error: "html must be a valid HTML string" };
    }
    return { success: true, title, html };
  },
});
```

**Files affected:** `lib/preview-tools.ts` (create)

---

**2. Emit `data-dashboard` custom part in `lib/preview-runtime.ts`**

In the single-agent and swarm-agent execution paths, after `onStepFinish` / within `onChunk`:

- After `streamText` finishes a step, read tool results.
- For any step where `toolName === "renderDashboard"` and `result.success === true`, write:

```ts
writer.write({
  type: "data-dashboard",
  value: { id: crypto.randomUUID(), title: result.title, html: result.html },
});
```

This matches the existing pattern for `data-orchestration` in swarm mode.

**Files affected:** `lib/preview-runtime.ts`

---

**3. Add `renderDashboard` to preview tools registry**

In `lib/preview-runtime.ts` (or wherever tools are assembled for `/api/preview`), include `renderDashboard` alongside `web_search` and Gmail tools.

**Files affected:** `lib/preview-runtime.ts`

---

### Phase 2 — UI types

**4. Extend `SwarmUIMessage` data types in `lib/chat-types.ts`**

Add a discriminated union member:

```ts
| { type: "data-dashboard"; value: { id: string; title: string; html: string } }
```

to the existing `UIDataPart` / `SwarmUIMessage` type.

**Files affected:** `lib/chat-types.ts`

---

### Phase 3 — Dashboard card component

**5. Create `components/preview/dashboard-card.tsx`**

```tsx
// components/preview/dashboard-card.tsx
interface DashboardCardProps {
  title: string;
  html: string;
  id: string;
}

export function DashboardCard({ title, html, id }: DashboardCardProps) {
  return (
    <div className="my-3 rounded-xl border border-border overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">Live dashboard</span>
      </div>
      <iframe
        key={id}
        srcDoc={html}
        sandbox="allow-scripts"
        title={title}
        className="w-full border-0"
        style={{ height: "400px" }}
        onLoad={(e) => {
          // Auto-resize to content height (best-effort; cross-origin rules may block)
          try {
            const doc = (e.target as HTMLIFrameElement).contentDocument;
            if (doc?.body) {
              (e.target as HTMLIFrameElement).style.height =
                doc.body.scrollHeight + "px";
            }
          } catch {}
        }}
      />
    </div>
  );
}
```

Height defaults to 400 px; auto-resize attempted via `onLoad` (works because `srcDoc` is same-origin).

**Files affected:** `components/preview/dashboard-card.tsx` (create)

---

### Phase 4 — Wire into PreviewPanel

**6. Read `data-dashboard` parts in `components/preview/preview-panel.tsx`**

`PreviewPanel` currently reads `data-orchestration` from `chat.data` to build the swarm timeline. Mirror that pattern:

```ts
const dashboards = useMemo(
  () =>
    chat.data
      .filter((d): d is { type: "data-dashboard"; value: DashboardData } =>
        d?.type === "data-dashboard"
      )
      .map((d) => d.value),
  [chat.data]
);
```

Then associate dashboards to the message that triggered them. Simplest approach: render `DashboardCard` blocks inside the last assistant message's render slot, ordered by arrival.

**Files affected:** `components/preview/preview-panel.tsx`

---

**7. Render `DashboardCard` inside `ChatMessage` or after it in `PreviewPanel`**

Two options:

- **Option A (simpler):** Render all `data-dashboard` entries after the last assistant message in `PreviewPanel`'s message list render — no changes to `ChatMessage`.
- **Option B (precise):** Pass per-message dashboards into `ChatMessage` as a prop, render cards inline after the text parts.

**Recommend Option A for v1.** Implement in `PreviewPanel`'s `messages.map()` render loop.

**Files affected:** `components/preview/preview-panel.tsx`

---

### Phase 5 — System prompt update

**8. Update preview system prompt to teach the agent when/how to use `renderDashboard`**

In `lib/orchestrator-prompt.ts` or wherever the preview runtime system prompt lives (`lib/preview-runtime.ts` — check `systemPrompt` variable):

Add instruction block:

```
## Dashboard Rendering
You have a renderDashboard tool. Use it when the user requests a visual summary, dashboard, or structured view of data (emails, news, calendar, metrics, etc.).

Workflow:
1. Fetch the required data using available tools (web_search, gmail_fetch_emails, etc.).
2. Call renderDashboard with a self-contained HTML document that presents the data.
   - Include inline <style> blocks for visual design.
   - Use a clean, modern layout (flexbox/grid).
   - Do not use external <script src> or <link href> for CSS frameworks — inline everything.
   - CDN scripts (Chart.js, etc.) ARE allowed via <script src="https://..."> for data visualization only.
3. Write a brief text summary BEFORE calling renderDashboard so the user knows what was fetched.
```

**Files affected:** `lib/preview-runtime.ts` (system prompt string) or `lib/orchestrator-prompt.ts`

---

### Phase 6 — Builder tool: `setDashboardSpec` (optional, v1.1)

Allow the builder to define that an agent always opens with a dashboard view. Defer to v1.1.

---

### Phase 7 — SILENT_TOOLS update

**9. Add `renderDashboard` to the `SILENT_TOOLS` set in `components/chat/chat-message.tsx`**

The tool call itself should not render a badge — the `DashboardCard` IS the UI. Add `"renderDashboard"` to the existing `SILENT_TOOLS` set.

**Files affected:** `components/chat/chat-message.tsx`

---

### Phase 8 — Refresh UX

**10. Add "Refresh" button to `DashboardCard`**

Button triggers `chat.reload()` or re-submits the last user message. For v1, a simple "Re-run" prompt in the chat input is sufficient. The button can just be a tooltip: "Re-send your message to refresh this dashboard."

This is a UX polish step; implement after core flow works.

**Files affected:** `components/preview/dashboard-card.tsx`

---

## Verification

| Step | Signal |
|------|--------|
| 1 — tool schema | TypeScript compiles, `renderDashboard.execute({ title: "T", html: "<p>ok</p>" })` returns `{ success: true }` |
| 2 — data emission | `/api/preview` stream includes a `data-dashboard` chunk visible in browser DevTools Network tab |
| 3 — type extension | No TypeScript errors in `lib/chat-types.ts` or `preview-panel.tsx` |
| 5 — card component | `DashboardCard` renders with title bar + iframe in Storybook or direct page mount |
| 6+7 — PreviewPanel | Asking "Show me my top 5 urgent emails as a dashboard" in preview mode renders a card with an iframe below the assistant text |
| 8 — prompt | Agent reliably calls `renderDashboard` after Gmail/search tool calls when asked for visual output |
| 9 — silent tool | No `ToolBadge` appears for `renderDashboard` calls in chat history |
| End-to-end | HTML with inline styles renders correctly; iframe does not escape its container; no console CORS errors |

---

## Implementation Order

```
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 (system prompt) → 9 → 10
```

Steps 1–4 are backend-only. Steps 5–7 are frontend. Step 8 requires no code changes — only string editing. Steps 1 and 5 can be built and tested in isolation.

---

## Out of Scope (v1)

- Live-updating dashboards (websockets / polling inside iframe)
- Agent-designer tool to configure a "default dashboard" on load
- Saving/exporting dashboard HTML as a standalone file (possible with `lib/export.ts` in v1.1)
- Multiple simultaneous dashboard panels (grid layout)
- Dashboard resize handles
