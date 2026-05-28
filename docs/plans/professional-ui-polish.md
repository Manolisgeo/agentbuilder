# Professional UI Polish

## Goal

Strip the HUD/terminal developer aesthetic from the agent builder page and replace it with clean corporate SaaS copy, typography, and visual language that a non-technical business user immediately understands.

---

## Constraints

- No new dependencies.
- Do not break existing logic; copy/label changes only in most steps.
- Existing Tailwind tokens, shadcn components, and HUD structure may be reused or lightly extended.
- `HudPanel` wrapper stays (its glass styling is fine); only the interior language/hierarchy changes.
- Keep all existing functionality (deploy, export, save, preview, design).
- Changes must work in both light and dark themes.

---

## Unknowns / Risks

- `getBuildStatusLabel` in `lib/build-progress.ts` returns uppercase strings consumed by `SegmentedProgress` — must trace all callers before renaming.
- `hud-label` class is used broadly; a CSS rename could cascade; safer to override per-component with Tailwind classes.
- Some sections (Deploy target toggle: "Local Docker" / "Railway") are functional choices, not just copy; renaming them is safe but must remain unambiguous to the end user.
- `SegmentedProgress` renders the `statusLabel` prop directly — changing labels in `lib/build-progress.ts` affects all surfaces that call `getBuildStatusLabel`.

---

## Steps

### 1. Rewrite right sidebar header — `components/actions-panel.tsx`

**Current:** Pulsing cyan dot + monospace `hud-label` "Telemetry" + h2 "Actions"

**Change to:** Remove the "Telemetry" label entirely. Replace header with:
- Left: Section title "Agent Status" in `text-sm font-semibold`
- Keep the pulsing dot but reduce prominence (smaller, use `bg-primary/50` instead of `bg-system`)

Result: The panel reads as a status sidebar, not a developer console.

---

### 2. Rename all `SectionHeader` labels — `components/actions-panel.tsx`

| Current label | New label |
|---|---|
| `Agent snapshot` | `Your Agent` |
| `Design & deployment` | `Design` |
| `Pre-deploy preview` | `Try It Out` |
| `Save agent` | `Save` |
| `Export bundle` | `Download` |
| `Deploy` | `Go Live` |
| `Deployments` | `Live Agents` |

---

### 3. Rewrite section body copy — `components/actions-panel.tsx`

| Section | Current copy | New copy |
|---|---|---|
| Save | "Persist spec to disk for the local scheduler and OAuth flow." | "Save your agent to come back to it later." |
| Export | (file extension badge row: `.json .md .html/ts/py`) | Remove badge row entirely; replace with: "Download a complete package you can run or share." |
| Preview | "Test your agent as an end user before exporting." | "See how your agent will look and feel before going live." |
| Design | "Describe your ideal UI in the chat — each agent gets a unique frontend generated from scratch. Edit code manually below if needed." | "Choose how your agent's interface looks. You can describe it in chat or tweak it below." |
| Deploy local | "Generate a runnable agent and launch it in a container." | "Run your agent on this computer." |
| Deploy railway | "Generate a Railway-ready bundle; deploy it live with the Railway CLI." | "Deploy your agent to the cloud with one command." |

---

### 4. Rename deploy target labels — `components/actions-panel.tsx`

| Current | New |
|---|---|
| `Local Docker` | `Run locally` |
| `Railway` | `Cloud deploy` |

---

### 5. Remove / soften developer-facing terminal blocks — `components/actions-panel.tsx`

- **Connector secrets block** ("Connector secrets read from `.env`"): Replace the mono font `<pre>` label with a plain sentence: "Uses your saved account connections." List connector names as plain text chips (remove `.env` reference).
- **`prepared` block** (Railway bundle instructions): Replace the raw `pre command` block with a friendly success card:
  - Title: "Ready to deploy"
  - Body: "Your agent package is ready. Open a terminal in `{dir}` and run the command below to go live."
  - Keep the `<pre>` for the command itself (it IS a command) but style it as a copy-to-clipboard chip, not a developer log.
  - Remove the "Set these env vars in the Railway dashboard" `<pre>` dump; replace with: "You'll also need to add your account credentials in the Railway dashboard." (link TBD).
- **Deploy logs** (`deployLogs` `<pre>` block): Collapse into a `<details>` summary / expandable disclosure:
  - Closed state: "Deploying… see details"
  - Open state: existing mono pre block

---

### 6. Fix disabled-state hint copy — `components/actions-panel.tsx`

| Current | New |
|---|---|
| `"Awaiting spec data"` | `"Finish building your agent to download"` |
| `"Build an agent first"` | `"Complete your agent setup to go live"` |
| `"Needs frontend design · name · role · instructions"` | `"Add a name, role, and instructions to unlock preview"` |
| `"Needs name · role · instructions"` | `"Add a name, role, and instructions to unlock preview"` |

These hints currently use `font-mono text-[9px] uppercase tracking-[0.16em]` — change to `text-[11px] text-muted-foreground text-center` (no mono, no uppercase).

---

### 7. Rename `SpecRow` labels — `components/actions-panel.tsx`

| Current label | New label |
|---|---|
| `Role` | `Role` (keep) |
| `Tone` | `Personality` |
| `Tools` | `Capabilities` |
| `Instructions` | `Instructions` (keep) |
| `Template` | `Design` |
| `Platform` | `Deploy target` |

---

### 8. Humanize build status labels — `lib/build-progress.ts`

`getBuildStatusLabel` returns uppercase strings. Change return values:

| Current | New |
|---|---|
| `"AWAITING INPUT"` | `"Ready when you are"` |
| `"ASSEMBLING AGENT"` | `"Building your agent…"` |
| `"READY"` | `"Agent ready"` |
| Any other `"…"` patterns | Title case, no underscores or all-caps |

Also update `SegmentedProgress` in `components/hud/segmented-progress.tsx`: if it applies `uppercase` or `tracking-widest` CSS to the status label, remove or soften those classes so mixed-case labels render correctly.

---

### 9. Clean up right sidebar header Chrome — `components/actions-panel.tsx`

**Current:** `<p className="hud-label ...">Telemetry</p>` + `<h2>Actions</h2>` side by side with pulsing dot.

**Change:**
- Single `<h2 className="text-sm font-semibold text-foreground">Agent Status</h2>` with a subtle live indicator dot to the right.
- Remove the double stacked label+heading pattern.
- The pulsing dot (`animate-ping`) remains but uses `bg-success/60` (green) instead of `bg-system` (cyan) to signal "live" rather than "system telemetry".

---

### 10. Remove developer HUD labels from page header — `app/page.tsx`

**Current breadcrumb:**
```
SWARM · WORKSPACE · AGENT BUILDER   (font-mono uppercase tracking-[0.28em])
```

**Change to:** Remove the monospace breadcrumb entirely. The header already has an `<h1>` — it doesn't need a tech-stack breadcrumb. If breadcrumb is wanted, use normal `text-xs text-muted-foreground` with slashes: `Workspace / Agent Builder`.

---

### 11. Rename `SectionHeader` sub-component visual — `components/actions-panel.tsx`

Current design: tiny colored dot + monospace `hud-label` text + gradient fade line.

Change to: plain `text-xs font-semibold text-foreground/70 uppercase tracking-wide` with a `border-b border-border/50 pb-1.5 mb-3`. Removes the sci-fi dot+line motif; keeps visual separation without developer framing.

---

### 12. Chat panel — rename phase badges — `components/chat-panel.tsx`

The chat panel shows phase badges "discovery" and "building". Change:

| Current | New |
|---|---|
| `discovery` | `Planning` |
| `building` | `Building` |

Check `lib/build-phase.ts` for the type enum values — do not rename the TypeScript type values, only the display strings rendered in the badge.

---

### 13. Verify `SegmentedProgress` renders non-uppercase labels correctly

After step 8, open the builder, confirm the status bar shows "Ready when you are" without being forced to all-caps. If `SegmentedProgress` has its own `uppercase` class, remove it so the new sentence-case labels render as intended.

---

## Verification

| Step | Signal |
|---|---|
| Steps 1–7, 9–12 | Visual inspection in browser: no "Telemetry", "hud-label", "AWAITING INPUT", monospace breadcrumb, `.env` reference visible to end user |
| Step 8 | Status bar shows sentence-case label during idle and build states |
| Step 5 (deploy logs) | Deploy logs section collapsed by default; expand shows logs |
| Step 5 (prepared block) | Railway "ready" card shows instead of raw env dump |
| All steps | No TypeScript errors (`tsc --noEmit`) |
| All steps | Dark mode: all new copy visible at adequate contrast |
| All steps | Existing save / export / deploy / preview functionality works end to end |
