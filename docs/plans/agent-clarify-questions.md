# Agent Clarifying Questions — Interactive Q&A

## Goal

When the agent needs more information before generating code, it calls an `askClarifyingQuestions` tool that emits a structured question block. The chat panel renders the questions as an interactive form card — not raw text. The user answers in-UI and clicks **Send Answers**, which packages the responses into a clean follow-up message and fires the next agent turn automatically.

This mirrors how DeepSeek naturally asks follow-ups (numbered questions, bold headers, contextual text), but replaces the unstructured prose with a UI that is impossible to misread and guaranteed to send structured data back.

---

## Constraints

- All constraints from `agent-code-generator.md` apply (stack, HUD design system, API patterns).
- Questions are rendered inside the existing `CodegenChatPanel` message list — no new panels needed.
- The answers are sent as a single synthesized user message so the full conversation history stays clean.
- No new environment variables. No new AI providers.
- The `askClarifyingQuestions` tool is **mutually exclusive** with `updateCodeSpec` per turn — the model either asks OR generates, never both.

---

## Question Format (Data Model)

### `ClarifyQuestion`

One atomic question in the block.

```
id: string           — stable slug (e.g. "email-importance", "summary-format")
text: string         — the question text shown to the user
kind: QuestionKind   — renders different input widget (see below)
options?: string[]   — required for "choice" and "multi-choice"
placeholder?: string — hint text for "text" and "textarea" inputs
required?: boolean   — defaults true; if false shows "(optional)"
```

### `QuestionKind`

| kind | widget | answer type |
|------|--------|-------------|
| `text` | single-line `<input>` | `string` |
| `textarea` | multi-line `<textarea>` | `string` |
| `choice` | radio button group | `string` (one of `options`) |
| `multi-choice` | checkbox group | `string[]` (subset of `options`) |
| `confirm` | Yes / No toggle buttons | `"yes" \| "no"` |

### `ClarifyBlock`

Top-level structure emitted by the tool.

```
context?: string          — optional preamble shown above questions (bold intro text)
questions: ClarifyQuestion[]
```

### `ClarifyAnswer`

Collected from the form.

```
id: string     — matches ClarifyQuestion.id
text: string   — display text of the question (for building the summary message)
answer: string | string[]
```

---

## Zod Schemas — `lib/clarify-types.ts` (new file)

```typescript
import { z } from "zod";

export const clarifyQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.enum(["text", "textarea", "choice", "multi-choice", "confirm"]),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  required: z.boolean().default(true),
});

export const clarifyBlockSchema = z.object({
  context: z.string().optional(),
  questions: z.array(clarifyQuestionSchema).min(1).max(5),
});

export type ClarifyQuestion = z.infer<typeof clarifyQuestionSchema>;
export type ClarifyBlock = z.infer<typeof clarifyBlockSchema>;

export type ClarifyAnswer = {
  id: string;
  text: string;
  answer: string | string[];
};

export function buildAnswerMessage(block: ClarifyBlock, answers: ClarifyAnswer[]): string {
  // Produces a clean, readable user message like:
  // "Here are my answers:
  //  1. What emails matter most? → Only from my team and urgent labels
  //  2. Summary format? → Bullet points with AI digest
  //  3. Delivery channel? → Yes (email to myself)"
  const lines = answers.map((a, i) => {
    const answerText = Array.isArray(a.answer) ? a.answer.join(", ") : a.answer;
    return `${i + 1}. ${a.text} → ${answerText}`;
  });
  return `Here are my answers:\n${lines.join("\n")}`;
}
```

- Affects: `lib/clarify-types.ts` (new file).

---

## System Prompt Addition — `lib/codegen-prompt.ts`

Extend `CODE_GEN_SYSTEM` with a third option for the model:

```
On your FIRST turn, if the user's description is ambiguous or under-specified, you MAY
call askClarifyingQuestions INSTEAD of updateCodeSpec. Ask at most 3 targeted questions.
Each question must have:
  - A concise, plain-English question text (no markdown bold inside the text field).
  - A kind that matches how a human would naturally answer it:
      • choice / multi-choice for enumerable options
      • confirm for yes/no
      • textarea for freeform elaboration
      • text for short values like a URL, email address, or cron expression
Use context to write a single-sentence explanation of WHY you're asking before the questions.
Do NOT ask about things you can infer. Do NOT ask more than 3 questions per turn.
After the user answers, proceed directly to updateCodeSpec + code generation. Never ask again.
```

- Affects: `lib/codegen-prompt.ts` (modify — append to `CODE_GEN_SYSTEM` and update `buildCodegenSystemPrompt`).

---

## API Route Addition — `app/api/codegen/route.ts`

Add `askClarifyingQuestions` tool alongside `updateCodeSpec`:

```typescript
askClarifyingQuestions: {
  description:
    "Ask the user up to 3 clarifying questions when the description is too vague to generate a good script. Call this INSTEAD of updateCodeSpec on the first turn if needed. Never call both in the same turn.",
  inputSchema: clarifyBlockSchema,
  execute: async (block) => {
    writer.write({
      type: "data-clarify",
      id: "clarify-block",
      data: block,
    });
    return { asked: block.questions.length };
  },
},
```

The `data-clarify` part is a one-shot emit — the block is stored by the client, rendered as a form, and consumed when the user submits answers.

- Affects: `app/api/codegen/route.ts` (modify — add tool, add import).

---

## `CodegenUIMessage` Extension — `lib/chat-types.ts`

Extend the data annotation to include the clarify block:

```typescript
export type CodegenUIMessage = UIMessage<
  never,
  { codeSpec: CodeSpec } | { clarify: ClarifyBlock }
>;
```

- Affects: `lib/chat-types.ts` (modify).

---

## Chat Panel — `components/codegen-chat-panel.tsx`

### New props

Add to existing props:
```typescript
onClarifySubmit?: (message: string) => void;
```

The parent page passes this so answers are submitted through the same `append()` / `sendMessage()` path.

### `onData` handler — add clarify branch

```typescript
if (dataPart.type === "data-clarify") {
  setClarifyBlock(dataPart.data);
  setClarifyAnswers({});  // reset any previous
}
```

### Message rendering — add clarify block case

After processing all `part`s of an assistant message, if that message carries a `data-clarify` annotation:
- Do NOT render a text bubble.
- Render `<ClarifyCard block={...} onSubmit={handleClarifySubmit} />` inline in the message list.

`handleClarifySubmit(answers: ClarifyAnswer[])`:
```typescript
const message = buildAnswerMessage(clarifyBlock, answers);
// Append as user message, fire next turn
sendMessage({ role: "user", content: message });
setClarifyBlock(null);
```

### State additions
```typescript
const [clarifyBlock, setClarifyBlock] = useState<ClarifyBlock | null>(null);
const [clarifySubmitted, setClarifySubmitted] = useState(false);
```

Once submitted, mark submitted and show a read-only summary instead of the form (so scrollback looks sensible).

- Affects: `components/codegen-chat-panel.tsx` (modify — add state, onData branch, rendering branch, pass onSubmit).

---

## New Component — `components/clarify-card.tsx`

`"use client"`. Self-contained interactive form card. No external state — fully controlled via `onSubmit`.

### Props
```typescript
type ClarifyCardProps = {
  block: ClarifyBlock;
  onSubmit: (answers: ClarifyAnswer[]) => void;
  submitted?: boolean;  // renders read-only summary when true
};
```

### Layout

```
┌─────────────────────────────────────────────────────┐
│  ● Quick questions                          [surface-2]│
│  context text (if present, muted)                     │
│                                                       │
│  1. What kind of emails are most important to you?    │
│     ○ All new emails                                  │
│     ○ Only from specific senders     ← radio group    │
│     ○ Urgent / important only                         │
│                                                       │
│  2. What should the summary look like?                │
│     ○ Bullet points (subject + sender)                │
│     ○ AI-generated digest per email   ← radio group   │
│                                                       │
│  3. Delivery channel?                                 │
│     [ Yes ]  [ No ]                   ← confirm       │
│                                                       │
│                        [ Send Answers →  ]            │
└─────────────────────────────────────────────────────┘
```

### Widget rendering per `QuestionKind`

**`choice`** — vertical radio group, each option is a styled pressable chip:
```tsx
<button
  onClick={() => setAnswer(q.id, opt)}
  className={cn(
    "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left transition-colors",
    answer === opt
      ? "bg-primary/20 border border-primary/50 text-white"
      : "border border-white/10 text-white/60 hover:border-white/30 hover:text-white"
  )}
>
  <span className={cn("size-3.5 rounded-full border-2", answer === opt ? "border-primary bg-primary" : "border-white/30")} />
  {opt}
</button>
```

**`multi-choice`** — same chip style but with checkbox semantics (toggle, allow multiple). Badge counter "2 selected" shown when >1 selected.

**`confirm`** — two-button toggle, "Yes" / "No". Same chip aesthetic, green tint for Yes, red for No.

**`text`** — `<input type="text">` styled with `surface-1` background, `border-white/15`, focus ring matching `primary`.

**`textarea`** — `<textarea rows={3}>` same styling.

### Validation

On "Send Answers" click: check all `required` questions have a non-empty answer. If any fail, add a red ring to the unanswered widget and show `"Please answer all required questions"` below the button.

### Submitted (read-only) state

When `submitted={true}`, render a compact summary card instead of the form:
```
✓  Answers sent
   1. Email importance → Urgent / important only
   2. Summary format → AI-generated digest
   3. Via email → Yes
```
Gray muted styling, checkmark icon, no buttons.

### Accessibility

- Each question group has a `<fieldset>` + `<legend>`.
- Keyboard navigation: Tab through options, Space/Enter to select.
- `aria-required`, `aria-invalid` attributes.

### Styling anchors (HUD system)

| Element | Token |
|---------|-------|
| Card background | `surface-2` |
| Header "Quick questions" | `hud-label` + `primary` dot |
| Context text | `text-white/60 text-xs` |
| Question text | `text-sm font-medium text-white` |
| Number | `text-primary text-xs font-mono` |
| Submit button | `bg-primary hover:bg-primary/80 text-black font-semibold` |
| Validation error | `text-red-400 text-xs` |

- Affects: `components/clarify-card.tsx` (new file).

---

## `app/agents/page.tsx` changes

No structural change. The `onClarifySubmit` wiring is handled internally by `CodegenChatPanel` — the parent page does not need to know about clarify blocks at all.

- Affects: `app/agents/page.tsx` (no change required).

---

## Actions Panel — `components/codegen-actions-panel.tsx`

Add a **"Waiting for answers"** status state when `clarifyPending` is true (prop passed from parent):

```typescript
// Additional prop
clarifyPending?: boolean;
```

```
Status label when clarifyPending:  "AWAITING YOUR ANSWERS"
SegmentedProgress:  pulse animation on all segments (same as isBuilding)
```

This gives clear top-right visual feedback that the agent is paused waiting for input.

- Affects: `components/codegen-actions-panel.tsx` (minor modify — add `clarifyPending` prop and status label).

---

## File Summary

| Action | File | Change |
|--------|------|--------|
| New | `lib/clarify-types.ts` | Zod schemas, types, `buildAnswerMessage` |
| Modify | `lib/codegen-prompt.ts` | Append clarify instructions to system prompt |
| Modify | `lib/chat-types.ts` | Extend `CodegenUIMessage` data annotation |
| Modify | `app/api/codegen/route.ts` | Add `askClarifyingQuestions` tool |
| New | `components/clarify-card.tsx` | Interactive question form + read-only summary |
| Modify | `components/codegen-chat-panel.tsx` | Handle `data-clarify`, render `ClarifyCard` |
| Modify | `components/codegen-actions-panel.tsx` | `clarifyPending` status label |

---

## State Flow Diagram

```
User sends vague prompt
        │
        ▼
  /api/codegen POST
        │
   DeepSeek decides:
   ┌────┴─────┐
   │           │
ambiguous    clear enough
   │           │
   ▼           ▼
askClarifying  updateCodeSpec
Questions      + emit code
   │
   ▼ data-clarify stream part
   │
CodegenChatPanel stores block
   │
   ▼
ClarifyCard renders in message list
Actions panel → "AWAITING YOUR ANSWERS"
   │
   ▼ user fills form + clicks Send
   │
buildAnswerMessage() → clean text
   │
sendMessage({ role: "user", content })
   │
   ▼
New /api/codegen POST with full history
   │
DeepSeek reads answers → updateCodeSpec + code
   │
   ▼
ClarifyCard re-renders as read-only summary
Graph populates, code streams
```

---

## Verification

| Step | Signal |
|------|--------|
| 1 | `lib/clarify-types.ts` compiles; `buildAnswerMessage` returns expected string |
| 2 | `/api/codegen` with vague prompt (`"make something with email"`) triggers `askClarifyingQuestions` tool call |
| 3 | `data-clarify` part arrives at client; `ClarifyCard` renders with correct question kinds |
| 4 | `choice` questions: clicking an option selects it; only one selectable |
| 5 | `multi-choice`: multiple options selectable; badge shows count |
| 6 | `confirm`: Yes/No toggle; correct styling |
| 7 | `text`/`textarea`: typing updates answer state |
| 8 | Validation: clicking Send with empty required fields shows error ring + message |
| 9 | Valid submit: `buildAnswerMessage` output is clean, sent as user message |
| 10 | After submit: `ClarifyCard` switches to read-only summary state |
| 11 | Next agent turn: receives full conversation including answer message; generates code + graph without asking again |
| 12 | Actions panel shows "AWAITING YOUR ANSWERS" during pending state, transitions to "ASSEMBLING SCRIPT" after submit |
| 13 | Specific prompt → no clarify block → direct code generation unaffected (existing flow regression-free) |

**End-to-end test sequence:**
1. Navigate to `/agents`.
2. Type: `"make an email agent"` (intentionally vague).
3. Expect: clarify card appears with 2–3 questions (e.g. email source, summary format, delivery channel). Actions panel reads "AWAITING YOUR ANSWERS".
4. Answer: choose `"All new emails"`, choose `"AI digest"`, confirm `"Yes"` for email delivery.
5. Click **Send Answers**.
6. Expect: card collapses to read-only summary. New user bubble appears with packaged answer text. DeepSeek responds with graph nodes + Python script.
7. Type: `"Fetch top 5 HN posts every hour and email me a summary"` (fully specified).
8. Expect: no clarify card — direct code generation (regression check).
