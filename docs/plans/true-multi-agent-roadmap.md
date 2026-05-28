# Swarm — True Multi-Agent Intelligence Roadmap

> **Strategic context:** The n8n community is increasingly vocal about the gap between "multi-agent" marketing and the reality of what their workflow engine can do. This plan turns those exact limitations into Swarm's core differentiators. Every feature below directly maps to a concrete failure mode in n8n and positions Swarm as the first visual agent builder that produces *real* collaborative multi-agent systems—not just a sequence of LLM calls connected by wires.

---

## The Opportunity in One Sentence

n8n can *draw* a multi-agent system; Swarm should *run* one.

---

## Competitive Gap Map

| n8n Limitation | What users experience | Swarm's answer |
|---|---|---|
| No shared memory | Agents forget what other agents did | **Shared Agent Memory** (Feature 1) |
| Sequential, hardwired execution | The workflow does what you drew, nothing more | **Dynamic Task Routing** (Feature 2) |
| No autonomous loops | Agents stop when the flow ends | **Continuous Agent Execution** (Feature 3) |
| No inter-agent communication | Agents work in isolation | **Agent-to-Agent Messaging** (Feature 4) |
| Manual, brittle parallelism | You coordinate merges yourself | **Automatic Parallel Coordination** (Feature 5) |
| No state evolution | Nothing learned carries forward | **Agent Memory & Learning Layer** (Feature 6) |
| Orchestration requires expert n8n knowledge | Normal users can't build real pipelines | **Conversational Swarm Design** (Feature 7) |

---

## Feature Specifications

---

### Feature 1 — Shared Agent Memory

**The n8n problem:** Each agent node operates in isolation. There is no automatic shared context. Community workarounds involve manually reading/writing Airtable rows or Supabase tables between every node—fragile, slow, and invisible to the user.

**What Swarm does instead:**

Introduce a first-class `SwarmMemory` object that lives at the *swarm level*, not inside any single agent. All agents in a swarm read from and write to this shared namespace automatically.

**Key concepts:**
- **Working memory** — a short-term scratchpad that all agents in a run can read and write. Automatically cleared between runs unless pinned.
- **Episodic memory** — a structured log of what each agent did, in what order, and what it concluded. Other agents can query it ("what did the researcher agent find?").
- **Semantic memory** — optional long-term vector store. Agents can embed facts and retrieve them across runs.

**UI surface:**
- Memory panel in the canvas: shows the live working-memory state during a preview run, highlighted as agents write to it.
- Each agent node has a `reads` / `writes` badge showing which memory keys it touches—so users can see data flow without reading code.

**Implementation notes:**
- `SwarmMemory` modeled as a Zod schema per swarm, stored client-side during preview, exportable to a Supabase/Postgres adapter for production.
- Agents reference memory keys in their instructions via `{{memory.researchSummary}}` templating.
- Spec update: extend `AgentSpec.agents[].memory` with `reads: string[]` and `writes: string[]`.

---

### Feature 2 — Dynamic Task Routing

**The n8n problem:** Every edge in an n8n workflow is drawn by the human. An agent cannot decide at runtime to hand off to a colleague, call a sub-agent it wasn't originally wired to, or create a new task branch. You get only what you drew.

**What Swarm does instead:**

Add a **Router Agent** primitive—an orchestrator that dynamically dispatches subtasks to the most appropriate specialist at runtime, rather than following a hardcoded path.

**How it works:**
1. The user defines a set of specialist agents (researcher, writer, validator, etc.) in the swarm canvas.
2. One agent is designated the **Router**. Its only job is to decompose the incoming task and assign subtasks to specialists.
3. The Router emits a `dispatchTask(agentId, task, context)` call. This is a first-class tool alongside `web_search` etc.
4. Specialists return results to the Router's working memory.
5. The Router decides whether to reassign, refine, or finalize.

**Key features:**
- **Dynamic handoff:** A specialist can itself call `dispatchTask` to escalate or delegate, enabling mesh topologies, not just hub-and-spoke.
- **Routing audit log:** Every dispatch decision is recorded with the Router's reasoning, shown in the Actions panel.
- **Visual diff on run:** The canvas animates which edges were actually traversed in a given run (as opposed to all possible connections drawn at design time)—making dynamic routing *visible*.

**Implementation notes:**
- `dispatchTask` defined as a Zod-validated tool in `app/api/chat/route.ts` and `app/api/preview/route.ts`.
- Agent graph adds dashed "potential" edges vs solid "activated" edges.
- Extend `AgentSpec` with a `role: "router" | "specialist" | "validator"` field.

---

### Feature 3 — Continuous Agent Execution (Agentic Loops)

**The n8n problem:** n8n workflows run start-to-finish and stop. An agent node has no ability to re-trigger itself, wait for an async condition, or stay alive between events. Implementing loops requires awkward workarounds and there is no concept of a long-running background agent.

**What Swarm does instead:**

Introduce **Loop Policies** on any agent node—declarative rules that describe when an agent should re-evaluate its output and continue working.

**Loop policy types:**

| Policy | Behavior |
|---|---|
| `untilConfident(threshold)` | Agent reruns until its own confidence score exceeds threshold |
| `untilApproved` | Agent pauses and awaits human approval before continuing |
| `maxIterations(n)` | Cap iterations to prevent runaway loops |
| `whileCondition(memoryKey, test)` | Continues while a shared memory value satisfies a predicate |
| `onEvent(eventType)` | Wakes agent when an external event arrives (webhook, schedule, etc.) |

**UI surface:**
- Loop badge on agent nodes with the active policy name.
- Iteration counter in the HUD during a preview run.
- `LOOPING` build-phase status in `SegmentedProgress`.

**Key differentiation:** This is what makes Swarm agents feel autonomous rather than procedural. A research agent can keep searching until it's confident. A writer can keep revising until the critic approves. No such primitive exists in n8n.

---

### Feature 4 — Agent-to-Agent Messaging Protocol

**The n8n problem:** In n8n, agents never communicate—they consume inputs and emit outputs through the workflow graph. There is no channel through which Agent A can send an unsolicited message to Agent B, ask a question mid-task, or react to what another agent is doing.

**What Swarm does instead:**

Build a lightweight **message bus** as part of SwarmMemory. Any agent can post a message to a named channel; any agent subscribed to that channel receives it as input on its next turn.

**Message types:**

- `question(toAgent, text)` — asks another agent to resolve an ambiguity before continuing.
- `broadcast(channel, text)` — posts a fact or event to all subscribers (e.g., "research complete, here is the summary").
- `critique(toAgent, outputRef, feedback)` — structured feedback from a validator to the agent that produced the output.
- `escalate(toAgent, reason)` — signals a blocker to a coordinator or human.

**UI surface:**
- Message timeline in the Actions panel: shows all inter-agent messages in chronological order during a run.
- Message indicator on edges when two agents exchange messages during a preview.

**Why this matters:** This is the core of what makes multi-agent systems feel like a *team*. Agents should be able to challenge each other's work, share discoveries, and ask for help—not silently hand data downstream.

---

### Feature 5 — Automatic Parallel Coordination

**The n8n problem:** Running agents in parallel in n8n is possible, but merging their results and coordinating them is entirely manual. There's no primitive for "run all three of these agents simultaneously and give me a consolidated result."

**What Swarm does instead:**

Introduce a **Parallel Group** canvas primitive. Users drag multiple agents into a group, mark the group as parallel, and the system handles spawning, waiting, and merging automatically.

**Features:**
- **Auto-merge strategies:** `concat` (stack outputs), `vote` (majority-wins for classification), `synthesize` (a merge agent reads all outputs and produces a unified result).
- **Dependency awareness:** Within a parallel group, agents that share memory keys are automatically sequenced to avoid conflicts—no manual wiring required.
- **Partial failure handling:** If one agent in a parallel group fails, the others complete and the failing agent's slot is marked as skipped or retried, rather than crashing the entire swarm.

**UI surface:**
- Parallel group rendered as a rounded container on the canvas, color-coded.
- Progress bars per agent inside the group during a run.
- Merge agent shown as a final node after the group with the selected merge strategy.

---

### Feature 6 — Agent Memory & Cross-Run Learning

**The n8n problem:** Once an n8n workflow finishes, the agent nodes retain nothing. There is no way for an agent to remember that last Tuesday it answered a similar question a certain way, or that a particular tool consistently fails for certain input shapes.

**What Swarm does instead:**

Add **Persistent Agent Profiles**—per-agent metadata that accumulates across runs and is injected into the agent's system prompt automatically.

**Profile layers:**

- **Outcome memory:** After each run, tag the final output as `success`, `failure`, or `partial`. The agent's profile stores the last N outcomes with the inputs that produced them.
- **Preference tuning:** Users (or the agent itself) can add "lessons" to the profile: short natural-language notes that get prepended to the system prompt. ("Prefer citing primary sources over news summaries.")
- **Tool performance log:** Each tool call records latency and success rate. Agents use this to prefer faster, more reliable tools for equivalent tasks.

**Key design principle:** Learning is *explicit and inspectable*, not a black box. Every memory entry is shown in the agent profile panel and can be deleted or edited by the user.

---

### Feature 7 — Conversational Swarm Design (Core Differentiator)

**The n8n problem:** Building a real multi-agent system in n8n requires expert-level knowledge of its node library, memory mechanisms, and execution model. The user *draws* the system themselves—and if they draw it wrong, it fails silently.

**What Swarm does instead (and already starts to do):**

The user describes what they want to *accomplish*, not what system to *build*. The LLM proposes the agent architecture, assigns roles, wires memory keys, sets loop policies, and builds the swarm spec. The canvas is a *result* of that conversation, not the input to it.

**Enhancements to the existing builder:**

1. **Swarm decomposition tool:** When a user describes a complex goal ("I want a system that monitors my competitors and writes a weekly briefing"), the LLM proposes multiple coordinated agents—not just one—and explains why each is needed. Users can accept, reject, or modify the proposed swarm.

2. **Role suggestion:** The builder automatically suggests `router`, `specialist`, and `validator` role assignments based on the task description, and explains the reasoning ("A validator agent here prevents the writer from publishing unverified claims").

3. **Memory key inference:** When the LLM adds a new agent to the spec, it infers which memory keys it should read and write based on what prior agents produce, and shows those connections as labeled edges on the canvas.

4. **Conflict detection:** Before running a preview, the system checks for memory write conflicts (two agents writing the same key), missing dependencies, and unconnected outputs—surfacing these as canvas annotations before the run, not as runtime errors.

5. **Swarm templates:** A library of pre-validated swarm architectures (research + synthesis, debate + arbitration, multi-draft writing, etc.) that users can instantiate and customize conversationally.

---

### Feature 8 — Run Inspector & Replay

**The n8n problem:** When a multi-agent workflow produces a wrong result, debugging requires reading execution logs across multiple nodes, correlating timestamps, and guessing which agent introduced the error. There is no holistic view of a run.

**What Swarm does instead:**

A **Run Inspector** that records every agent decision, memory read/write, message, and tool call in a single timeline, then lets users replay any run step-by-step.

**Key views:**
- **Timeline view:** Chronological list of all events across all agents in a run. Filterable by agent, event type, or memory key.
- **Canvas replay:** Scrub a slider to replay the run on the canvas—see which agents were active at each moment, watch memory values update, and see messages travel between nodes.
- **Counterfactual editing:** Modify a memory value or agent instruction at a specific step and re-run from that point to see how the outcome changes.

---

### Feature 9 — Export to Real Execution Environments

**The n8n problem:** n8n's multi-agent workflows are locked to n8n. There is no clean way to export the orchestration logic to run in Python, to deploy it as a standalone service, or to hand it off to an engineering team to extend.

**What Swarm does instead:**

Extend the existing ZIP export to produce runnable, framework-native code:

| Export target | Output |
|---|---|
| **Python + LangGraph** | A `workflow.py` using LangGraph's `StateGraph` with agents mapped to nodes, shared memory as `TypedDict` state, and edges reflecting the dynamic routing rules |
| **Python + CrewAI** | A `crew.py` with `Agent`, `Task`, and `Crew` objects matching the swarm spec roles |
| **OpenAI Assistants API** | `assistants.json` with assistant definitions, thread management code, and a coordinator script |
| **Standalone API** | A Next.js/FastAPI server with one endpoint per agent, a shared Redis memory adapter, and a coordinator endpoint |

**Why this is critical:** Swarm becomes the *design tool* for systems that run anywhere. This is the ultimate answer to n8n lock-in: design your swarm visually, export to whatever stack your team uses.

---

## Phased Implementation Plan

### Phase 1 — Foundation (makes Swarm credibly different)
Priority: ship these before any other differentiators.

1. **Shared Agent Memory** (Feature 1) — extend `AgentSpec`, add memory panel, wire into preview
2. **Conversational Swarm Design enhancements** (Feature 7) — role inference, memory key inference, swarm templates
3. **Export to LangGraph/CrewAI** (Feature 9, partial) — highest-value export targets

**Why first:** These three together let a user design a real multi-agent system and export runnable code. That's a complete, demonstrable product story that n8n cannot match.

---

### Phase 2 — Intelligence Layer (makes Swarm meaningfully better)

4. **Dynamic Task Routing** (Feature 2) — Router primitive, `dispatchTask` tool, canvas animation
5. **Agentic Loops** (Feature 3) — Loop policies, `LOOPING` phase, iteration HUD
6. **Agent-to-Agent Messaging** (Feature 4) — message bus, message timeline

**Why second:** These features require the memory foundation to be solid. They also need careful UX design—the canvas must remain readable as dynamism increases.

---

### Phase 3 — Collaboration & Debugging (makes Swarm production-grade)

7. **Automatic Parallel Coordination** (Feature 5) — parallel groups, merge strategies
8. **Run Inspector & Replay** (Feature 8) — timeline, canvas replay, counterfactual editing
9. **Agent Memory & Cross-Run Learning** (Feature 6) — persistent profiles, outcome memory

**Why third:** These are powerful but require execution infrastructure (storing run histories, replay state) that isn't needed in Phase 1-2.

---

## Messaging & Positioning

The marketing angle is not "we're better than n8n." It's:

> **n8n orchestrates steps. Swarm builds teams.**

Supporting copy:

- "In n8n, you draw the workflow. In Swarm, you describe the goal—the agents figure out the rest."
- "True multi-agent means shared memory, dynamic handoffs, and agents that talk to each other. Not a sequence of LLM calls wearing a team costume."
- "Design your swarm in plain English. Export production-ready LangGraph or CrewAI code."

The target audience is the 67-upvote Reddit thread writer and everyone who liked it: people with enough AI experience to know n8n is a workaround, not a real multi-agent system, but who want a visual, accessible way to build the real thing.

---

## Success Metrics

| Metric | Target |
|---|---|
| Users who complete a 2+ agent swarm design | > 40% of sessions (vs current single-agent bias) |
| Export downloads (LangGraph / CrewAI) | > 60% of completed designs |
| Time-to-first-multi-agent-preview | < 5 minutes from landing page |
| Memory key utilization | > 70% of multi-agent designs use at least one shared memory key |
| Run Inspector sessions per week | Tracked from Phase 3 launch |

---

## What We Are NOT Building

To stay focused, the following are explicitly out of scope:

- **A workflow runner / execution engine** inside Swarm itself. Swarm is a design + export tool. Execution happens in the user's environment via the exported code or an external platform.
- **Visual programming in the canvas.** Users never drag nodes from a palette. The conversation drives the spec; the canvas is a read-only visualization that can be annotated.
- **A competitor to LangChain/LangGraph/CrewAI.** Swarm exports *to* these frameworks. We make them accessible, not redundant.
- **Model fine-tuning or custom model management.** Swarm uses DeepSeek (and optionally other models via Vercel AI Gateway) but is not a model platform.

This constraint is the source of Swarm's coherence: we do one thing n8n cannot—help users *think through* and *specify* a real multi-agent system—and then get out of the way.
