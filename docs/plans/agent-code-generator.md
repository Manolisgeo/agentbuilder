# Agent Code Generator (DeepSeek)

## Goal

Add a `/agents` page that mirrors the 3-column layout of the builder: chat left, React Flow architecture graph center, actions right. DeepSeek is guided through structured code generation via an `updateCodeSpec` tool that builds live flow nodes (trigger → inputs → processors → outputs) before emitting the Python script as the text response. Full conversation history is maintained per session.

---

## Constraints

- Stack: Next.js 15 App Router, React 19, Vercel AI SDK v6 (`ai`, `@ai-sdk/react`, `@ai-sdk/openai`), Tailwind CSS 4, shadcn/ui, `@xyflow/react`.
- DeepSeek wired in `lib/deepseek.ts` (`deepseekChat`, `DEEPSEEK_API_KEY`). No new provider setup.
- API route pattern: `app/api/<name>/route.ts` with `POST` + `createUIMessageStream` + `createUIMessageStreamResponse`. Mirror `app/api/chat/route.ts` exactly.
- Chat UI pattern: `useChat<T>` + `DefaultChatTransport`. Mirror `components/chat-panel.tsx` exactly.
- Graph uses `BoardNode` from `components/board/board-node.tsx` — extend its `BoardNodeKind` union with new code node types rather than creating a new node component.
- HUD design system: `HudPanel`, `HudError`, `surface-1/2/3`, `primary`, `system`. All new components must use these.
- Same 3-column grid as `app/page.tsx`: `grid-cols-1 lg:grid-cols-[minmax(300px,340px)_1fr_minmax(260px,280px)]`.
- No existing syntax highlighter — must add `react-syntax-highlighter`.
- `DEEPSEEK_API_KEY` is the only env var; already in use.
- AppSidebar is currently static `<button>` elements — needs `next/link` + `usePathname` for navigation.

---

## Unknowns / Risks

- **Model tool compliance**: DeepSeek must call `updateCodeSpec` BEFORE emitting code. The system prompt enforces this but the model may occasionally skip it. Graph will simply remain empty that turn — acceptable degradation.
- **Streaming into syntax highlighter**: Re-renders on each chunk. Test for jank on long scripts; can debounce if needed.
- **`maxDuration`**: Set to `60`. Long scripts may still time out on Vercel Hobby (max 60 s). Raise to `120` if on Pro plan.
- **Code fence stripping**: System prompt forbids fences, but model may emit them. `extractPythonCode()` helper strips ` ```python ... ``` ` defensively.
- **`BoardNodeKind` extension**: Adding new kinds to `board-node.tsx` is backward-safe — existing kinds are unchanged. New entries only added to the union and `NODE_THEMES` map.

---

## Data model

### `CodeFlowNode`

Represents one architectural component of the generated script.

```
kind: "trigger" | "input" | "processor" | "output" | "dependency"
id: string          — stable slug (e.g. "gmail-input", "summarize")
label: string       — display name
subtitle?: string   — short type description
detail?: string     — 1–2 sentence elaboration
dependsOn: string[] — ids of upstream nodes
```

### `CodeSpec`

Top-level structure passed to the graph and the system prompt.

```
name: string         — script name
description?: string — one-line summary
nodes: CodeFlowNode[]
```

### Node kind → graph semantics

| kind | color | icon | meaning |
|------|-------|------|---------|
| `trigger` | amber `#f59e0b` | `Clock` | How / when the script runs (cron, event, CLI) |
| `input` | cyan `#06b6d4` | `Database` | Data sources (Gmail, RSS, API, file) |
| `processor` | blue `#3b82f6` | `Cpu` | Logic/transform steps (summarize, parse, filter) |
| `output` | green `#10b981` | `Send` | Delivery targets (email, Slack, file, webhook) |
| `dependency` | purple `#8b5cf6` | `Package` | Key pip packages or external services |

Flow: trigger → inputs → processors → outputs. Dependencies float below all.

---

## Steps

### 1. Install `react-syntax-highlighter`

```bash
npm install react-syntax-highlighter @types/react-syntax-highlighter
```

- Affects: `package.json`, `package-lock.json`.

---

### 2. Extend `components/board/board-node.tsx`

Add the 5 new kinds to `BoardNodeKind` and `NODE_THEMES`.

```typescript
// Add to BoardNodeKind union:
| "trigger" | "input" | "processor" | "output" | "dependency"

// Add to NODE_THEMES:
trigger:    { accent: "#f59e0b", icon: Clock,    tag: "Trigger" }
input:      { accent: "#06b6d4", icon: Database,  tag: "Input" }
processor:  { accent: "#3b82f6", icon: Cpu,       tag: "Processor" }
output:     { accent: "#10b981", icon: Send,       tag: "Output" }
dependency: { accent: "#8b5cf6", icon: Package,   tag: "Dep" }
```

Import `Clock`, `Cpu`, `Database`, `Package`, `Send` from `lucide-react`.

Handle placement for new kinds:
- `trigger`: source handle right + bottom (like `agent`).
- `input`, `processor`, `output`, `dependency`: target handle left, source handle right (same as `instructions`).

- Affects: `components/board/board-node.tsx`.

---

### 3. Create `lib/codegen-types.ts`

Export Zod schemas + TypeScript types for `CodeSpec`.

```typescript
import { z } from "zod";

export const codeFlowNodeSchema = z.object({
  id: z.string(),
  kind: z.enum(["trigger", "input", "processor", "output", "dependency"]),
  label: z.string(),
  subtitle: z.string().optional(),
  detail: z.string().optional(),
  dependsOn: z.array(z.string()).default([]),
});

export const codeFlowNodePatchSchema = codeFlowNodeSchema.partial().required({ id: true });

export const codeSpecSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  nodes: z.array(codeFlowNodeSchema),
});

export const codeSpecPatchSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  nodes: z.array(codeFlowNodeSchema).optional(),
});

export type CodeFlowNode = z.infer<typeof codeFlowNodeSchema>;
export type CodeSpec = z.infer<typeof codeSpecSchema>;
export type CodeSpecPatch = z.infer<typeof codeSpecPatchSchema>;

export const defaultCodeSpec: CodeSpec = { name: "Untitled Script", nodes: [] };

export function mergeCodeSpec(current: CodeSpec, patch: CodeSpecPatch): CodeSpec {
  // Merge nodes by id — new nodes append, existing nodes update in-place
  const patchNodes = patch.nodes ?? [];
  const merged = [...current.nodes];
  for (const patchNode of patchNodes) {
    const idx = merged.findIndex((n) => n.id === patchNode.id);
    if (idx >= 0) merged[idx] = { ...merged[idx], ...patchNode };
    else merged.push(patchNode);
  }
  return codeSpecSchema.parse({
    name: patch.name ?? current.name,
    description: patch.description ?? current.description,
    nodes: merged,
  });
}

export function isCodeSpecEmpty(spec: CodeSpec): boolean {
  return spec.nodes.length === 0;
}
```

- Affects: `lib/codegen-types.ts` (new file).

---

### 4. Create `lib/codegen-prompt.ts`

Export `CODE_GEN_SYSTEM` constant and `buildCodegenSystemPrompt(spec: CodeSpec): string`.

```
CODE_GEN_SYSTEM:

You are an expert Python developer and AI agent engineer. Your job is to build complete, runnable Python agent scripts based on the user's description.

On EVERY turn you MUST follow this two-step process — in this exact order:

STEP 1 — Call updateCodeSpec with the full architecture:
  - Always include a "trigger" node (how/when the script runs: cron, event, CLI flag).
  - Include one "input" node per data source (Gmail, RSS feed, REST API, file, etc.).
  - Include one "processor" node per logic/transformation step (summarize, filter, parse, format).
  - Include one "output" node per delivery target (email, Slack, CSV, webhook, etc.).
  - Include "dependency" nodes for key pip packages (openai, schedule, smtplib, etc.).
  - Use dependsOn arrays to express data flow between nodes.
  - On refinement turns, update the existing spec — keep ids stable, add or modify nodes.

STEP 2 — Write the complete Python script as your text response:
  - Output ONLY raw Python source code. No prose. No markdown fences. No explanation.
  - Start with a docstring: what the agent does, how to configure it, how to run it.
  - Use os.environ.get("VAR_NAME", "") for all credentials and config.
  - List pip dependencies in a comment block near the top: # pip install X Y Z
  - Include a __main__ guard.
  - Always output the COMPLETE script — never a diff, never a partial snippet.
  - On refinement, rewrite the full script incorporating all requested changes.
```

`buildCodegenSystemPrompt(spec)` appends `Current code spec:\n${JSON.stringify(spec, null, 2)}` — same pattern as `buildSystemPrompt` in `app/api/chat/route.ts`.

- Affects: `lib/codegen-prompt.ts` (new file).

---

### 5. Create `lib/chat-types.ts` extension — `CodegenUIMessage`

Add a new exported type to `lib/chat-types.ts`:

```typescript
export type CodegenUIMessage = UIMessage<
  never,
  { codeSpec: CodeSpec }
>;
```

- Affects: `lib/chat-types.ts` (modify — add import + type).

---

### 6. Create `app/api/codegen/route.ts`

Mirrors `app/api/chat/route.ts`. Key differences: uses `CodeSpec`/`CodegenUIMessage`, tool is `updateCodeSpec`, system prompt uses `buildCodegenSystemPrompt`.

```typescript
export const maxDuration = 60;

export async function POST(req: Request) {
  // env guard — same as /api/chat

  const body = await req.json();
  const messages: CodegenUIMessage[] = body.messages ?? [];
  const parsedSpec = codeSpecSchema.safeParse(body.codeSpec);
  let currentSpec: CodeSpec = parsedSpec.success ? parsedSpec.data : defaultCodeSpec;

  const modelMessages = await convertToModelMessages(messages);

  const stream = createUIMessageStream<CodegenUIMessage>({
    execute: ({ writer }) => {
      const result = streamText({
        model: deepseekChat,
        system: buildCodegenSystemPrompt(currentSpec),
        messages: modelMessages,
        tools: {
          updateCodeSpec: {
            description: "Update the code architecture spec with nodes representing the agent's structure. Call this before writing the Python script.",
            inputSchema: codeSpecPatchSchema,
            execute: async (patch) => {
              currentSpec = mergeCodeSpec(currentSpec, patch);
              writer.write({
                type: "data-codeSpec",
                id: "code-spec",
                data: currentSpec,
              });
              return { success: true, nodeCount: currentSpec.nodes.length };
            },
          },
        },
        onFinish: () => {
          writer.write({ type: "data-codeSpec", id: "code-spec", data: currentSpec });
        },
      });
      writer.merge(result.toUIMessageStream());
    },
    onError: (error) => {
      console.error("Codegen stream error:", error);
      return error instanceof Error ? error.message : "Code generation failed.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
```

- Affects: `app/api/codegen/route.ts` (new file).
- Depends on Steps 3, 4, 5.

---

### 7. Create `components/codegen-chat-panel.tsx`

`"use client"`. Props: `{ codeSpec: CodeSpec; onSpecUpdate: (s: CodeSpec) => void; onError: (m: string) => void; onBuildingChange?: (b: boolean) => void }`.

**Transport:**
```typescript
new DefaultChatTransport({
  api: "/api/codegen",
  prepareSendMessagesRequest: ({ messages, id }) => ({
    body: { messages, id, codeSpec: codeSpecRef.current },
  }),
})
```

**`onData` handler:**
```typescript
if (dataPart.type === "data-codeSpec") {
  onSpecUpdate(dataPart.data);
}
```

**Message rendering:**

- User messages: right-aligned bubble (same classes as `chat-panel.tsx`).
- Assistant messages with `tool-*` parts: `Updating architecture` indicator (same cyan `system` color as existing "Updating spec").
- Assistant messages with `text` parts: render as syntax-highlighted Python code block using `<SyntaxHighlighter language="python" style={oneDark}>`. Extract code with `extractPythonCode(text)` (strips optional ` ```python ``` ` fences).
- Copy button absolute top-right of each code block: `Copy` → `Check` icon after click, reset after 2 s.
- Only render code blocks for non-empty text (the model may emit a short ack text — render it as a text bubble if it contains no Python keywords like `import` or `def`).

**Helper:**
```typescript
function extractPythonCode(text: string): string {
  const match = text.match(/```(?:python)?\n?([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

function looksLikePython(text: string): boolean {
  return /\b(import|def |class |if __name__|os\.environ)\b/.test(text);
}
```

**Starter prompts:**
```
"Read my Gmail every hour and email me a daily summary"
"Monitor a URL for price changes and notify me via Slack"
"Pull top HN posts every morning and send a digest email"
```

**Empty state:** Same card + starter prompt pattern as `chat-panel.tsx`, copy-adapted text.

**Loading state:** Same `Loader2` + `Processing` HUD chip.

- Affects: `components/codegen-chat-panel.tsx` (new file).
- Depends on Steps 3, 5.

---

### 8. Create `components/codegen-graph.tsx`

Mirrors `agent-graph.tsx`. Uses same `BoardNode`, `BoardToolbar`, `ReactFlow` setup. Builds nodes/edges from `CodeSpec` instead of `AgentSpec`.

**`buildGraphFromCodeSpec(spec, seenNodeIds)`:**

Layout algorithm:

```
Row 0 (y=80):   trigger nodes (x = 80 + i*300)
Row 1 (y=280):  input nodes   (x = 80 + i*300)
Row 2 (y=480):  processor nodes
Row 3 (y=680):  output nodes
Row 4 (y=880):  dependency nodes
```

Edge color map: trigger→input `#06b6d4`, input→processor `#3b82f6`, processor→output `#10b981`, other `rgba(255,255,255,0.25)`.

Respect `dependsOn`: if a node explicitly declares `dependsOn`, draw edges from those source ids. If `dependsOn` is empty, draw an edge from the canonical upstream row (e.g. trigger → inputs automatically).

Same `isNew` / `animDelay` / `seenNodeIds` tracking as `buildGraphFromSpec` in `agent-graph.tsx`.

**Placeholder nodes when spec is empty:**
```
ph-trigger  (y=80)  — "Trigger"  / "Entry point"
ph-input    (y=280) — "Input"    / "Data source"
ph-output   (y=480) — "Output"   / "Delivery target"
```

**Props:** `{ spec: CodeSpec; isBuilding?: boolean }` — same as `AgentGraphProps` without `buildProgress`/`buildPhase` (not needed for codegen).

- Affects: `components/codegen-graph.tsx` (new file).
- Depends on Step 2 (new `BoardNodeKind` values), Step 3.

---

### 9. Create `components/codegen-actions-panel.tsx`

Mirrors `actions-panel.tsx` but for code output.

**Sections:**

1. **Status** — `SegmentedProgress` computing progress from `codeSpec`:
   - 0 nodes: 0 %
   - Has trigger: +25 %
   - Has ≥1 input: +25 %
   - Has ≥1 processor: +25 %
   - Has ≥1 output: +25 %
   - Status label: `AWAITING DESCRIPTION` / `ASSEMBLING SCRIPT` (isBuilding) / `SCRIPT READY`

2. **Script snapshot** — shows `name`, `description`, node count per kind.

3. **Download script** — downloads `lastCode` (latest assistant text) as `agent.py`. Button disabled when no code yet.

4. **Copy script** — copies `lastCode` to clipboard with icon flip.

Props: `{ codeSpec: CodeSpec; lastCode: string; errorMessage: string | null; onClearError: () => void; isBuilding?: boolean }`.

`lastCode` is extracted from the last assistant message in the parent page component.

- Affects: `components/codegen-actions-panel.tsx` (new file).
- Depends on Step 3.

---

### 10. Create `app/agents/page.tsx`

`"use client"`. 3-column layout, same outer shell as `app/page.tsx`.

**State:**
```typescript
const [codeSpec, setCodeSpec] = useState<CodeSpec>(defaultCodeSpec);
const [errorMessage, setErrorMessage] = useState<string | null>(null);
const [isBuilding, setIsBuilding] = useState(false);
const [lastCode, setLastCode] = useState("");
```

`lastCode` updated via `onCodeUpdate` prop passed to `CodegenChatPanel` (called inside the panel when a complete assistant text part is received — detect via `status === "ready"` transition).

**Header:** `hud-label` "Code · Agent generator" + `h1` "Generate Python agent scripts".

**Main grid:**
```tsx
<main className="grid min-h-0 flex-1 grid-cols-1 gap-2 p-2 lg:grid-cols-[minmax(300px,340px)_1fr_minmax(260px,280px)]">
  <CodegenChatPanel
    codeSpec={codeSpec}
    onSpecUpdate={setCodeSpec}
    onError={setErrorMessage}
    onBuildingChange={setIsBuilding}
    onCodeUpdate={setLastCode}
  />
  <CodegenGraph spec={codeSpec} isBuilding={isBuilding} />
  <CodegenActionsPanel
    codeSpec={codeSpec}
    lastCode={lastCode}
    errorMessage={errorMessage}
    onClearError={() => setErrorMessage(null)}
    isBuilding={isBuilding}
  />
</main>
```

- Affects: `app/agents/page.tsx` (new file).
- Depends on Steps 7, 8, 9.

---

### 11. Update `components/app-sidebar.tsx`

Convert to link-based navigation.

```typescript
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { icon: Sparkles, label: "Builder",   href: "/" },
  { icon: Bot,      label: "Agents",    href: "/agents" },
  { icon: Layers,   label: "Workflows", href: null },   // inactive placeholder
  { icon: Download, label: "Export",    href: null },   // inactive placeholder
];
```

Active = `pathname === item.href`. Items with `href === null` render as `<button>` (unchanged). Active items render as `<Link>`.

- Affects: `components/app-sidebar.tsx`.

---

## File summary

| Action | File |
|--------|------|
| Install dep | `package.json` |
| Modify | `components/board/board-node.tsx` — add 5 new `BoardNodeKind` values |
| Modify | `lib/chat-types.ts` — add `CodegenUIMessage` |
| Modify | `components/app-sidebar.tsx` — link-based nav |
| New | `lib/codegen-types.ts` — `CodeSpec`, Zod schemas, `mergeCodeSpec` |
| New | `lib/codegen-prompt.ts` — `CODE_GEN_SYSTEM`, `buildCodegenSystemPrompt` |
| New | `app/api/codegen/route.ts` — POST handler + `updateCodeSpec` tool |
| New | `components/codegen-chat-panel.tsx` — chat + code block rendering |
| New | `components/codegen-graph.tsx` — React Flow from `CodeSpec` |
| New | `components/codegen-actions-panel.tsx` — download/copy/status |
| New | `app/agents/page.tsx` — 3-column page |

---

## Verification

| Step | Signal |
|------|--------|
| 1 | `npm install` exits 0; `node_modules/react-syntax-highlighter` present |
| 2 | `board-node.tsx` compiles; existing agent graph still renders (no regression) |
| 3 | `lib/codegen-types.ts` types resolve; `mergeCodeSpec` unit-testable manually |
| 4 | `CODE_GEN_SYSTEM` importable with no TS errors |
| 6 | `POST /api/codegen` with `DEEPSEEK_API_KEY` set → 200 streaming; without key → 500 JSON |
| 7–9 | All components render without console errors; `HudPanel` wraps correctly |
| 10 | `localhost:3000/agents` renders 3-column layout |
| 11 | Sidebar Builder→`/` and Agents→`/agents` navigate correctly; active indicator tracks pathname |
| Build | `next build --turbopack` exits 0 |

**End-to-end test sequence:**
1. Navigate to `/agents`.
2. Type: `"Fetch top 5 HN posts every hour and email me a summary"`.
3. Expect: graph spawns trigger node (Cron), input node (HackerNews API), processor node (Format digest), output node (Email/SMTP); Python script streams into code block.
4. Type: `"Also log each run to a log file"`.
5. Expect: graph adds processor node (Logger) or output node (Log file); full updated Python script re-emitted.
6. Copy button → clipboard → icon flips to `Check`.
7. Download → `agent.py` downloads.
8. Navigate to `/` → agent builder is unaffected.
