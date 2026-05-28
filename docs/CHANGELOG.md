# Swarm Agent Builder — Changelog

---

## Session: Shared Agent Memory — Phase 1

**Date:** 2026-05-28  
**Plan:** `docs/plans/shared-agent-memory.md`  
**Roadmap:** Feature 1 of `docs/plans/true-multi-agent-roadmap.md`

---

### What was built

#### Data layer

**`lib/agent-spec.ts`**
- Added `swarmMemoryKeySchema` — Zod schema for a named memory key (`key`, `type: "string" | "object" | "array"`, `description`)
- Extended `swarmAgentSchema` with optional `memory: { reads: string[], writes: string[] }` — declares which keys each sub-agent touches
- Added `swarmMemory: SwarmMemoryKey[]` as an optional top-level field on `agentSpecSchema`
- Updated `mergeAgentSpec` to upsert `swarmMemory` keys by name (same pattern as `mergeCodeSpec`)
- Updated `agentSpecPatchSchema` to accept partial agents with optional `dependsOn` and the new `swarmMemory` field
- Exported new type `SwarmMemoryKey`

**`lib/swarm-memory.ts`** *(new file)*
- `SwarmMemoryState = Record<string, unknown>` — runtime memory map, client-side only, no database
- `MemoryWriteEvent` — stream payload type carrying `{ state, writes: { key, agentRole }[] }`
- `resolveMemoryTemplates(text, state)` — replaces `{{memory.key}}` placeholders; empty string on missing key, never crashes
- `applyMemoryWrite(state, writes)` — immutable merge returning new state object

#### Service layer

**`lib/agent-prompt.ts`**
- `buildAgentRuntimePrompt(spec, memoryState?, agentIndex?)` — new optional params
- When `agentIndex` is set, uses the sub-agent's role/instructions instead of the root persona
- Calls `resolveMemoryTemplates` on instructions before injecting into the prompt
- Injects a `## Shared Memory (current state)` block annotated with read/write access per key
- Write-capable agents receive additional instruction: "call the writeMemory tool with key-value pairs"

**`lib/chat-types.ts`**
- Added `memoryState: MemoryWriteEvent` to the `SwarmUIMessage` data union — enables typed `onData` events in `useChat`
- Added `updateMemoryKeys` to `TOOL_LABELS`

**`lib/build-progress.ts`**
- +5% bonus to build progress when `spec.swarmMemory` has at least one key defined

**`lib/export.ts`**
- `memory-schema.json` added to exported ZIP bundle when memory keys exist
- `{{memory.key}}` placeholders in instructions annotated as `[memory.key — injected at runtime]` in exported markdown
- Sub-agents section added to `agent.md` export with reads/writes listed per agent

**`lib/orchestrator-prompt.ts`**
- `BUILDING_ADDENDUM` extended: instructs the LLM to call `updateMemoryKeys` when a second agent is added, set `reads`/`writes` on agents, and use `{{memory.keyName}}` in instructions

#### API routes

**`app/api/preview/route.ts`**
- Accepts `swarmMemoryInitial?: SwarmMemoryState` from request body
- **Single-agent path:** unchanged — passes `memoryState` to system prompt if non-empty, streams via `streamText`
- **Multi-agent path (new):**
  - Topological sort of `spec.agents` by `dependsOn` (DFS, handles arbitrary dependency graphs)
  - Sequential `generateText` per agent with `writeMemory` tool available
  - `writeMemory` tool: `inputSchema: z.object({ writes: z.record(z.string(), z.unknown()) })` — updates closure `memoryState` on call
  - Emits `data-memoryState` stream event after each agent completes (carries new state + list of keys written and by which agent role)
  - Streams each agent's output prefixed with `**[AgentRole]**` and separated by `---`

**`app/api/chat/route.ts`** (via `lib/chat-tools.ts`)
- New `updateMemoryKeys` tool in building mode:
  - Description targets the exact LLM scenario: "call when you add a new agent that produces or consumes data"
  - Merges new key definitions into `spec.swarmMemory` via `mergeAgentSpec`
  - Emits updated `data-agentSpec` event so the canvas updates immediately

#### Canvas / UI

**`components/board/board-node.tsx`**
- Added `"memory"` to `BoardNodeKind` — amber theme, `Database` icon, tag: "Memory"
- Added `isUpdated?: boolean` to `BoardNodeData` — triggers `memory-node-flash` CSS animation (600ms amber glow)
- Added `memoryReads?: string[]` and `memoryWrites?: string[]` to `BoardNodeData`
- Memory nodes get `Position.Top` target handle (consistent with tool/swarm nodes)
- Badge rows rendered at bottom of swarm agent nodes: `↓ reads: keyName` (blue) and `↑ writes: keyName` (amber)

**`components/agent-graph.tsx`**
- `buildGraphFromSpec` accepts `memoryState?` and `updatedMemoryKeys?` params
- Derives one memory node per `SwarmMemoryKey` at y=860 (below swarm agent row)
- Node `detail` shows current live value from `memoryState` (truncated at 60 chars, or `"(empty)"`)
- **Write edges** (agent → memory): solid amber, `ArrowClosed` marker
- **Read edges** (memory → agent): dashed amber, labeled "reads"
- `BoardCanvas` tracks `updatedMemoryKeys` state with 600ms timeout to clear flash
- `useEffect` diffs `memoryState` on each update to detect which keys changed
- `AgentGraphProps` extended with `memoryState?: SwarmMemoryState`

**`components/memory-panel.tsx`** *(new file)*
- Collapsible panel: header button toggles open/closed, shows key count summary when collapsed
- Per-key rows: key name, type badge (amber when populated, muted when empty), current value, last-written-by agent label
- Values truncated at 80 chars with expand/collapse toggle for long values
- 1.2s amber flash on rows whose key was in the latest `data-memoryState` write event
- Props: `keys: SwarmMemoryKey[]`, `state: SwarmMemoryState`, `lastWrittenBy: Record<string, string>`, `latestWrittenKeys?: Set<string>`

**`components/actions-panel.tsx`**
- Added `memoryState`, `lastWrittenBy`, `latestWrittenKeys` props
- Renders `<MemoryPanel>` between "Agent snapshot" and "Pre-deploy preview" sections when `spec.swarmMemory?.length > 0`

**`components/center-panel.tsx`**
- Accepts and forwards `memoryState` to `AgentGraph`
- Accepts and forwards `onMemoryUpdate` to `PreviewPanel`

**`components/preview/preview-panel.tsx`**
- Switched from `useChat<UIMessage>` to `useChat<SwarmUIMessage>` for typed data event access
- Added `onData` handler: fires `onMemoryUpdate(dataPart.data)` on `data-memoryState` events
- Added `onMemoryUpdate?: (event: MemoryWriteEvent) => void` prop

**`app/page.tsx`**
- Added `memoryState: SwarmMemoryState`, `lastWrittenBy: Record<string, string>`, `latestWrittenKeys: Set<string>` state
- `handleMemoryUpdate` callback: updates all three states, clears `latestWrittenKeys` after 1.2s
- Passes new state/callbacks to `CenterPanel` and `ActionsPanel`

**`app/globals.css`**
- Added `.memory-node-flash` class and `@keyframes memory-flash` (amber box-shadow pulse, 600ms)

---

### Constraints honored

- No external database — memory is pure client-side `Record<string, unknown>`, serializable to JSON
- No Redis, Supabase, or vector store
- `agentSpecSchema.parse()` still validates all existing and new specs without breaking
- Single-agent preview path is unchanged
- `MAX_SWARM_AGENTS = 4` respected — sequential execution budget ~20s within 30s `maxDuration`

---

## What comes next

These are the remaining features from `true-multi-agent-roadmap.md`, in priority order.

---

### Feature 2 — Dynamic Task Routing

**The gap:** Execution order is hardwired by `dependsOn` edges. The orchestrator cannot decide at runtime which agent to invoke next based on what it found.

**What to build:**
- Orchestrator agent that inspects current memory state after each sub-agent turn and selects the next agent to run (or loops back)
- `routingPolicy: "topological" | "dynamic"` on `agentSpecSchema`
- Dynamic routing prompt injection: after each agent, LLM orchestrator sees current memory + available agents and outputs `nextAgentId`
- Canvas: animated "active" edge highlight showing which path was taken

**Files to change:** `app/api/preview/route.ts`, `lib/agent-spec.ts`, `components/agent-graph.tsx`

---

### Feature 3 — Continuous Agent Execution (Loop detection + retry)

**The gap:** If an agent produces bad output, the swarm fails silently. There is no retry, no validation, no loop.

**What to build:**
- Per-agent `outputValidator` field: a Zod schema or LLM-graded rubric that the output must satisfy
- On failure: configurable retry count (default 2), with failure reason injected into next attempt's memory
- Loop detection: if the same agent is retried more than `maxRetries` times, mark the swarm as failed and surface the error
- Canvas: red node pulse on validation failure, retry counter badge

**Files to change:** `lib/agent-spec.ts`, `app/api/preview/route.ts`, `components/board/board-node.tsx`

---

### Feature 4 — Agent-to-Agent Messaging

**The gap:** Agents share memory passively (read/write), but cannot explicitly send a message to another agent mid-run.

**What to build:**
- `sendMessage` tool available to sub-agents: `{ toAgentId, content }` — adds to that agent's "inbox" in `SwarmMemoryState`
- Inbox is injected into the target agent's system prompt in the next turn
- Canvas: animated directed message edge (distinct from dependency edges — dashed violet)
- Preview output: message events surfaced inline between agent output blocks

**Files to change:** `lib/swarm-memory.ts`, `app/api/preview/route.ts`, `components/agent-graph.tsx`, `lib/agent-prompt.ts`

---

### Feature 5 — Automatic Parallel Coordination

**The gap:** Agents with no dependency relationship run sequentially. Real speedup requires parallel execution with a barrier to merge.

**What to build:**
- Detect independent agent groups (no `dependsOn` relationship between them)
- Run independent groups with `Promise.all`, respect `MAX_SWARM_AGENTS` concurrency cap
- Barrier agent: runs after all parallel branches complete, receives all branch outputs in memory
- Canvas: horizontal parallel lanes with a merge node at the barrier

**Files to change:** `app/api/preview/route.ts`, `components/agent-graph.tsx`, `lib/agent-spec.ts`

---

### Feature 6 — Persistent Memory & Learning Layer

**The gap:** Memory is ephemeral — cleared between preview runs. Nothing learned in one session carries to the next.

**What to build:**
- `persistentMemory` tier on top of `SwarmMemoryState`: keys marked `persist: true` survive between runs
- Client-side storage (localStorage in Phase 2, optional Supabase in Phase 3)
- Memory panel gains a "Persistent" vs "Session" tab
- Export bundle includes `memory-snapshot.json` with current persistent values

**Files to change:** `lib/swarm-memory.ts`, `lib/agent-spec.ts`, `components/memory-panel.tsx`, `lib/export.ts`

---

### Feature 7 — Conversational Swarm Design (already in-progress)

**The gap:** Building a real multi-agent pipeline requires n8n expertise. Swarm's chat builder already handles this better, but memory key inference needs to be more proactive.

**Remaining work:**
- After `updateMemoryKeys` is called, auto-suggest which agents should read/write each key (LLM inference)
- "Memory map" view in canvas: toggle that shows only memory nodes + edges, hiding agent-to-agent edges
- Onboarding prompt: when a user describes a multi-step task, proactively scaffold the full swarm + memory schema before asking for confirmation

**Files to change:** `lib/orchestrator-prompt.ts`, `components/agent-graph.tsx`, `components/board/board-toolbar.tsx`

---

### Near-term polish (any feature order)

| Item | Description |
|------|-------------|
| Prose memory fallback | If `writeMemory` tool call is skipped, parse key-value writes from prose output as fallback |
| Memory key autocomplete | In the build chat, suggest existing `swarmMemory` key names when the user types `{{memory.` |
| Memory panel in preview | Show `MemoryPanel` inline inside `PreviewPanel` (not just in `ActionsPanel`) for tighter feedback loop |
| `clarifyUser` memory questions | When building a swarm, ask the user to confirm memory key names before wiring them |
| Export: resolved instructions | Add `agent-resolved.md` to ZIP with `{{memory.key}}` replaced by type stubs (`[string]`, `[object]`) |
