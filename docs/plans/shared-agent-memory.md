# Shared Agent Memory — Implementation Plan

> Feature 1 from `true-multi-agent-roadmap.md`. Priority: Phase 1 (ship first).

---

## Goal

Introduce a first-class `SwarmMemory` layer so all agents in a swarm read from and write to a shared namespace, with live visibility in the canvas and preview panel.

---

## Constraints

- No external database in Phase 1. Memory is client-side during preview, serializable to JSON.
- Preview route (`app/api/preview/route.ts`) currently runs a single `streamText` call. Multi-agent sequential execution must be added without breaking single-agent mode.
- `AgentSpec` schema is Zod; all extensions must pass `agentSpecSchema.parse()` without breaking `mergeAgentSpec`.
- Canvas uses `@xyflow/react`. Memory nodes must be valid `Node<BoardNodeData>` shapes.
- LLM is DeepSeek via `deepseekChat`. Memory key inference must be achievable via structured tool calls in the existing streaming pattern.
- `MAX_SWARM_AGENTS = 4`. Sequential execution budget is bounded.
- No Redis, Supabase, or vector store in Phase 1. Semantic memory (vector) is out of scope.

---

## Unknowns / Risks

- `components/agent-graph.tsx` not yet read — unknown how nodes/edges are currently derived from `AgentSpec`. Must verify layout algorithm before adding memory nodes.
- DeepSeek tool-call reliability for `writeMemory` structured output during preview simulation: if the model ignores the tool, memory writes silently fail. Mitigation: also parse memory writes from prose output as fallback.
- `{{memory.key}}` template substitution in `instructions` must not break if a key is missing at runtime — need a safe fallback (empty string, not a crash).
- `createUIMessageStreamResponse` data event typing: adding `data-memoryState` requires extending the generic type in `chat-types.ts`. Confirm AI SDK v6 allows arbitrary data event keys without breaking the client.
- Build-phase system prompt length: injecting full memory schema + live state per agent turn may exceed DeepSeek context budget for large swarms. Keep memory schema injection concise (key + type + 1-line description only).

---

## Steps

### 1 — Extend `lib/agent-spec.ts`

Add memory fields to the Zod schemas.

**Actions:**

1a. Add `swarmMemoryKeySchema`:
```ts
export const swarmMemoryKeySchema = z.object({
  key: z.string(),               // e.g. "researchSummary"
  type: z.enum(["string", "object", "array"]),
  description: z.string(),       // 1-line purpose hint for LLM injection
});
```

1b. Extend `swarmAgentSchema` with optional memory declaration:
```ts
memory: z.object({
  reads: z.array(z.string()).default([]),
  writes: z.array(z.string()).default([]),
}).optional(),
```

1c. Extend `agentSpecSchema` with top-level `swarmMemory`:
```ts
swarmMemory: z.array(swarmMemoryKeySchema).optional(),
```

1d. Update `mergeAgentSpec` to merge `swarmMemory` arrays by `key` (same upsert pattern as `mergeCodeSpec` nodes).

1e. Update `agentSpecPatchSchema` to accept the same new fields as optional.

1f. Export new types: `SwarmMemoryKey`, updated `SwarmAgent`, updated `AgentSpec`.

**File:** `lib/agent-spec.ts`
**Depends on:** nothing

---

### 2 — Create `lib/swarm-memory.ts`

New file. Runtime state types and utilities — no Zod (runtime only, not persisted in spec).

```ts
export type SwarmMemoryState = Record<string, unknown>;

export function resolveMemoryTemplates(text: string, state: SwarmMemoryState): string {
  // Replace {{memory.key}} with state[key] ?? ""
}

export function applyMemoryWrite(
  state: SwarmMemoryState,
  writes: Record<string, unknown>
): SwarmMemoryState {
  return { ...state, ...writes };
}
```

**File:** `lib/swarm-memory.ts` (new)
**Depends on:** Step 1

---

### 3 — Extend `lib/agent-prompt.ts`

3a. Update `buildAgentRuntimePrompt` signature:
```ts
buildAgentRuntimePrompt(spec: AgentSpec, memoryState?: SwarmMemoryState, agentIndex?: number)
```

3b. For multi-agent specs, inject the specific sub-agent's persona + instructions (by `agentIndex`) instead of the root spec.

3c. Inject memory context into system prompt:
```
## Shared Memory (current state)
- researchSummary: "..."   [you READ this]
- draftOutput: (empty)     [you WRITE this]

When you write to memory, call the writeMemory tool with the key-value pairs.
```

3d. Apply `resolveMemoryTemplates` to `instructions` string before injecting into the prompt.

**File:** `lib/agent-prompt.ts`
**Depends on:** Steps 1, 2

---

### 4 — Extend `app/api/preview/route.ts`

This is the biggest change. The preview route must simulate sequential multi-agent execution.

4a. Accept `swarmMemoryInitial?: SwarmMemoryState` from request body.

4b. Add a `writeMemory` tool available to every agent during preview:
```ts
writeMemory: {
  inputSchema: z.object({ writes: z.record(z.unknown()) }),
  execute: async ({ writes }) => {
    memoryState = applyMemoryWrite(memoryState, writes);
    writer.write({ type: "data-memoryState", id: "memory", data: memoryState });
    return { success: true };
  }
}
```

4c. For single-agent specs (`!spec.agents?.length`), keep existing behavior — pass `memoryState` to system prompt only if non-empty.

4d. For multi-agent specs:
  - Sort `spec.agents` topologically by `dependsOn` (BFS from roots).
  - Run each agent sequentially with `await streamText(...)` (no streaming to client per-agent — collect full text, then stream the final synthesis or stream each agent's output with an agent-label prefix).
  - After each agent turn, flush pending `writeMemory` tool results; update `memoryState`.
  - Stream `data-memoryState` event after each agent completes.
  - Final agent output (or orchestrator summary) is the text streamed to the client.

4e. Decision: **stream each agent's output with a prefix label** (`[ResearchAgent] ...`) rather than waiting for all to finish. This gives live feedback.

4f. Handle `maxDuration = 30` limit: with 4 agents × ~5s each, total is ~20s — within budget. Document the limit.

**File:** `app/api/preview/route.ts`
**Depends on:** Steps 1, 2, 3

---

### 5 — Extend `app/api/chat/route.ts`

5a. Extend the `updateAgentSpec` tool's `agentSpecPatchSchema` to accept `swarmMemory` and per-agent `memory.reads`/`memory.writes` (already covered by Step 1's patch schema update — no extra work).

5b. Add a `updateMemoryKeys` tool in BUILD mode:
```ts
updateMemoryKeys: {
  description: "Define or update shared memory keys for the swarm. Call when you add a new agent that produces or consumes data.",
  inputSchema: z.object({
    keys: z.array(swarmMemoryKeySchema),
  }),
  execute: async ({ keys }) => {
    // Merge into currentSpec.swarmMemory
    currentSpec = mergeAgentSpec(currentSpec, { swarmMemory: keys });
    writer.write({ type: "data-agentSpec", id: "agent-spec", data: currentSpec });
    return { success: true };
  }
}
```

5c. Extend `BUILDING_SYSTEM` prompt to include memory key inference instructions:
```
- When you add a second+ agent, infer which memory keys they share.
  Call updateMemoryKeys to define them, then set reads/writes on each agent.
- Reference memory keys in agent instructions as {{memory.keyName}}.
- Keep memory keys camelCase, descriptive nouns (e.g. "researchFindings", "draftText").
```

**File:** `app/api/chat/route.ts`
**Depends on:** Step 1

---

### 6 — Extend `lib/chat-types.ts`

Add `data-memoryState` to the stream data union:
```ts
export type SwarmUIMessage = UIMessage<
  never,
  {
    agentSpec: AgentSpec;
    memoryState: SwarmMemoryState;
  }
>;
```

Verify AI SDK v6 allows multiple data keys in the same generic — if not, use a single `swarmData` key with a discriminated union.

**File:** `lib/chat-types.ts`
**Depends on:** Steps 1, 2

---

### 7 — Read and extend `components/agent-graph.tsx`

7a. Read the file first to understand current node/edge derivation logic.

7b. Add a `"memory"` `BoardNodeKind` to `board-node.tsx`:
```ts
memory: {
  accent: "#f59e0b",
  accentRgba: "245,158,11",
  glow: "rgba(245,158,11,0.35)",
  icon: Database,
  tag: "Memory",
},
```

7c. In `agent-graph.tsx`, derive memory nodes from `spec.swarmMemory`:
- One node per `SwarmMemoryKey`, positioned in a row below the agent row.
- Node `data.detail` = current live value from `memoryState` prop (or `"(empty)"` if undefined).

7d. Derive memory edges:
- For each `swarmAgent` with `memory.reads` keys: add an edge from the memory node → agent node (dashed, labeled "reads").
- For each `swarmAgent` with `memory.writes` keys: add an edge from agent node → memory node (solid, labeled "writes").
- Edge color: match the memory node accent (`#f59e0b`).

7e. Accept a `memoryState?: SwarmMemoryState` prop in `AgentGraph`. Propagate from `CenterPanel` → `AgentGraph`.

7f. Animate memory node on write: add `isUpdated` boolean to node data, apply a brief highlight class when `memoryState[key]` changes (use `useEffect` + 600ms timeout to clear).

**Files:** `components/agent-graph.tsx`, `components/board/board-node.tsx`
**Depends on:** Steps 1, 2

---

### 8 — Create `components/memory-panel.tsx`

Collapsible panel showing live memory state.

Layout:
```
┌──────────────────────────────────┐
│ Shared Memory           [▼]      │
├──────────────────────────────────┤
│ researchSummary  string          │
│ "Tesla Q1 results show..."       │
│ ← written by ResearchAgent       │
│                                  │
│ draftOutput      string          │
│ (empty)                          │
└──────────────────────────────────┘
```

Props: `{ keys: SwarmMemoryKey[]; state: SwarmMemoryState; lastWrittenBy: Record<string, string> }`

- `lastWrittenBy`: map from key → agent role name. Populated by the preview route via `data-memoryState` events (extend event payload to include `{ state, writes: { key, agentRole }[] }`).
- Flash animation on rows whose key was in the latest `data-memoryState` event.

**File:** `components/memory-panel.tsx` (new)
**Depends on:** Steps 1, 2

---

### 9 — Wire memory state through `app/page.tsx` and panels

9a. Add `memoryState: SwarmMemoryState` to `useState` in `app/page.tsx`.

9b. Pass `memoryState` to `CenterPanel` → `AgentGraph` (Step 7e).

9c. Add `MemoryPanel` to `ActionsPanel` or as a new tab in the right panel — show only when `spec.swarmMemory?.length > 0`.

9d. In `PreviewPanel` (or `chat-panel.tsx`), subscribe to `data-memoryState` stream events and call `setMemoryState`. Use the existing `useChat` data-event pattern.

**Files:** `app/page.tsx`, `components/actions-panel.tsx` (or new right-panel tab), `components/preview/preview-panel.tsx`
**Depends on:** Steps 6, 7, 8

---

### 10 — Update `lib/build-progress.ts`

Add `swarmMemory` to the progress heuristic so the progress bar reflects when memory keys are defined:
- +5% if `spec.swarmMemory?.length > 0`
- No change to existing thresholds

**File:** `lib/build-progress.ts`
**Depends on:** Step 1

---

### 11 — reads/writes badges on agent nodes

Display which memory keys each agent touches directly on its canvas node (as specified in the roadmap: "reads / writes badge").

In `board-node.tsx`:
- If `data.memoryReads?.length` or `data.memoryWrites?.length` are present in `BoardNodeData`, render a small badge row at the bottom of the node:
  - `↓ reads: researchSummary` (in blue)
  - `↑ writes: draftOutput` (in amber)
- Extend `BoardNodeData` to include: `memoryReads?: string[]; memoryWrites?: string[]`.
- Populate in `agent-graph.tsx` when deriving swarm agent nodes.

**Files:** `components/board/board-node.tsx`, `components/agent-graph.tsx`
**Depends on:** Step 7

---

### 12 — Export support

Extend `lib/export.ts` to include `swarmMemory` in the exported ZIP:
- Add a `memory-schema.json` file to the ZIP with the `swarmMemory` key definitions.
- In the existing agent instructions export, resolve `{{memory.key}}` placeholders with a comment `# [memory.key — injected at runtime]` so exported files are readable.

**File:** `lib/export.ts`
**Depends on:** Step 1

---

## Verification

| Step | Signal |
|------|--------|
| Step 1 | `agentSpecSchema.parse({ ..., swarmMemory: [{ key: "x", type: "string", description: "test" }] })` succeeds in a unit test or `console.log` check |
| Step 2 | `resolveMemoryTemplates("Hello {{memory.name}}", { name: "world" })` returns `"Hello world"` |
| Step 3 | Preview system prompt for a 2-agent spec includes "Shared Memory" section with correct read/write annotations |
| Step 4 | POST to `/api/preview` with a 2-agent spec streams two labeled output blocks and a `data-memoryState` event between them |
| Step 5 | In BUILD mode chat, asking "add a researcher and a writer that share findings" results in `updateMemoryKeys` tool call + `reads`/`writes` set on agents |
| Step 6 | TypeScript compiles without errors after adding `memoryState` to `SwarmUIMessage` |
| Step 7 | Canvas renders amber memory nodes with dashed read-edges and solid write-edges for a 2-agent spec with `swarmMemory` defined |
| Step 8 | Memory panel shows `(empty)` before preview, then live value after first agent runs |
| Step 9 | `memoryState` updates in real time during preview without page refresh |
| Step 11 | Agent node in canvas shows `↓ reads: researchSummary` badge when `memory.reads` is set |
| Step 12 | ZIP export includes `memory-schema.json` with correct key definitions |

---

## File Change Summary

| File | Change |
|------|--------|
| `lib/agent-spec.ts` | Add `swarmMemoryKeySchema`, extend `swarmAgentSchema` + `agentSpecSchema`, update `mergeAgentSpec` |
| `lib/swarm-memory.ts` | **New** — runtime state types, template resolver, state applier |
| `lib/agent-prompt.ts` | Accept `memoryState` + `agentIndex`, inject memory context, resolve templates |
| `lib/chat-types.ts` | Add `memoryState` to `SwarmUIMessage` data map |
| `lib/build-progress.ts` | +5% for defined memory keys |
| `lib/export.ts` | Emit `memory-schema.json` in ZIP |
| `app/api/preview/route.ts` | Sequential multi-agent execution, `writeMemory` tool, stream `data-memoryState` |
| `app/api/chat/route.ts` | Add `updateMemoryKeys` tool, extend BUILD system prompt |
| `app/page.tsx` | Add `memoryState` state, wire to panels |
| `components/board/board-node.tsx` | Add `"memory"` kind, `memoryReads`/`memoryWrites` badge |
| `components/agent-graph.tsx` | Derive memory nodes + edges, accept `memoryState` prop, animate writes |
| `components/memory-panel.tsx` | **New** — live memory key/value display |
| `components/actions-panel.tsx` | Add Memory tab / integrate `MemoryPanel` |
| `components/center-panel.tsx` | Pass `memoryState` down to `AgentGraph` |
| `components/preview/preview-panel.tsx` | Subscribe to `data-memoryState` events, call `setMemoryState` |
