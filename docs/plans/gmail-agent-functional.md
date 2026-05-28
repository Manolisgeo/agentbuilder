# Gmail Agent — Make It Functional

## Goal
Wire real Gmail API calls into the preview panel and add a local hourly cron scheduler so the Gmail Digest agent reads inboxes and sends emails without hallucinating.

---

## Constraints

- No database — persist tokens and agent spec as local JSON files in project root
- Scheduler runs locally via `node-cron` in a standalone script (not Vercel Cron)
- `googleapis` npm package not yet installed — must be added
- `node-cron` not yet installed — must be added
- LLM stays DeepSeek (`lib/deepseek.ts`) — no change
- Preview runtime is server-side (Next.js API route) — `fs` I/O is safe
- `fs` must never be imported in client components
- Tool type strings are matched exactly: `"gmail_read_inbox"`, `"gmail_send_digest"`
- Google OAuth redirect URI must match Google Cloud console exactly: `http://localhost:3000/api/auth/google/callback`
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` were collected into `agentSpec.envVars` by the builder — they must be promoted to `.env.local` before OAuth flow can start

---

## Unknowns / Risks

- Google Cloud project OAuth consent screen status: if still in "testing" mode only allowlisted test users can auth — must verify in console
- `googleapis` is a large package — use `"server-only"` guard to prevent client bundle inclusion
- Token auto-refresh: `googleapis` `oauth2Client` emits a `tokens` event when access token is silently refreshed — must re-persist tokens in that handler or subsequent runs fail after 1 hour
- `tsx` availability for running TypeScript scheduler script: check with `npx tsx --version`; fallback is `ts-node`
- `agentSpec.envVars` currently lives only in React state — saving spec to file is the bridge between builder UI and all server-side code; if save is skipped, OAuth and scheduler have no credentials
- Scheduler runs in the same process as the Next.js dev server is not possible — it must be a separate script run in a second terminal

---

## Steps

### Part A — Install dependencies

1. **Install `googleapis` and `node-cron`**
   - File: `package.json`
   - Command: `npm install googleapis node-cron`
   - Also install types: `npm install -D @types/node-cron`

---

### Part B — Token and spec file persistence

2. **Create `lib/gmail-tokens.ts`**
   - Reads/writes `.gmail-tokens.json` in project root using `fs/promises`
   - Exports:
     ```ts
     type GmailTokens = { access_token: string; refresh_token: string; expiry_date: number }
     readTokens(): Promise<GmailTokens | null>
     writeTokens(tokens: GmailTokens): Promise<void>
     ```
   - Add `"server-only"` import at top of file

3. **Create `app/api/save-agent/route.ts`**
   - `POST` handler: reads `agentSpec` from request body, validates with `agentSpecSchema.parse`, writes to `.agent-spec.json` via `fs/promises.writeFile`
   - Returns `{ ok: true }`
   - Add `.agent-spec.json` and `.gmail-tokens.json` to `.gitignore`

4. **Add "Save Agent" button to `components/actions-panel.tsx`**
   - On click: `POST /api/save-agent` with current `agentSpec`
   - Show toast/inline status: "Saved" or "Save failed"
   - Depends on step 3

---

### Part C — OAuth2 flow

5. **Read credentials from saved spec / `.env.local`**
   - Decision: require `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`
   - User action (not code): copy values from `agentSpec.envVars` collected during builder chat into `.env.local`
   - Rationale: simplest; avoids reading `.agent-spec.json` just for credentials

6. **Create `lib/gmail-oauth.ts`**
   - Exports `createOAuthClient()` that returns `new google.auth.OAuth2(CLIENT_ID, SECRET, REDIRECT_URI)`
   - `REDIRECT_URI = "http://localhost:3000/api/auth/google/callback"`
   - Add `"server-only"` import

7. **Create `app/api/auth/google/route.ts`**
   - `GET` handler: calls `createOAuthClient().generateAuthUrl({ access_type: 'offline', scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'], prompt: 'consent' })`
   - Returns `Response.redirect(url)`
   - Depends on step 6

8. **Create `app/api/auth/google/callback/route.ts`**
   - `GET` handler: extracts `code` from URL params
   - Calls `oauth2Client.getToken(code)` → receives `{ tokens }`
   - Calls `writeTokens(tokens)` (step 2)
   - Returns `Response.redirect('/')` with success message
   - Registers `oauth2Client.on('tokens', writeTokens)` to persist auto-refreshed tokens
   - Depends on steps 2, 6

---

### Part D — Gmail API tool implementations

9. **Create `lib/gmail-tools.ts`**
   - Add `"server-only"` import
   - Export `createGmailReadInboxTool(oauth2Client)` — returns an AI SDK tool object:
     - Description: "Fetch unread emails from Gmail inbox from the last hour"
     - `inputSchema: z.object({ hoursBack: z.number().default(1) })`
     - `execute`: calls `gmail.users.messages.list` with `q: 'is:unread newer_than:1h'`, then `gmail.users.messages.get` for each (max 20), returns array of `{ from, subject, snippet, date }`
   - Export `createGmailSendDigestTool(oauth2Client)` — returns an AI SDK tool object:
     - Description: "Send an HTML email digest to the authenticated user's Gmail inbox"
     - `inputSchema: z.object({ subject: z.string(), html: z.string() })`
     - `execute`: calls `gmail.users.messages.send` with RFC 2822 encoded message to `me`
   - Both tools follow the same pattern as `lib/web-search.ts`: typed error class, guard function, named export
   - Export `hasGmailTools(spec: AgentSpec): boolean` — returns true if spec has any tool with type `gmail_read_inbox` or `gmail_send_digest`

10. **Update `lib/agent-prompt.ts`**
    - Add `hasGmailTools` import + re-export (or define locally)
    - In `buildAgentRuntimePrompt`: add a branch for Gmail tools alongside the existing `web_search` branch, so the system prompt informs the LLM that Gmail read/send are available as live tools

11. **Update `lib/preview-runtime.ts`** — wire Gmail tools
    - In `runSingleAgentPreview`:
      - Import `readTokens` from `lib/gmail-tokens.ts`
      - Import `createGmailReadInboxTool`, `createGmailSendDigestTool`, `hasGmailTools` from `lib/gmail-tools.ts`
      - If `hasGmailTools(spec)` is true:
        - Call `readTokens()` — if null, return error message: "Gmail not authorized. Visit /api/auth/google to connect."
        - Create `oauth2Client` via `createOAuthClient()`, call `setCredentials(tokens)`, register `tokens` event → `writeTokens`
        - Build `gmailTools` object with only the tools present in `spec.tools`
        - Merge with any `webSearchTools` into single `tools` object passed to `streamText`
    - Depends on steps 2, 6, 9

---

### Part E — Standalone scheduler script

12. **Create `scripts/gmail-scheduler.ts`**
    - Imports: `node-cron`, `readTokens`/`writeTokens` from `lib/gmail-tokens.ts`, `createOAuthClient` from `lib/gmail-oauth.ts`, Gmail tools from `lib/gmail-tools.ts`, `deepseekChat` from `lib/deepseek.ts`
    - On startup: reads `.agent-spec.json` → validates with `agentSpecSchema.parse`; if missing, exits with error
    - On startup: calls `readTokens()`; if null, prints "Run: open http://localhost:3000/api/auth/google" and exits
    - Schedules `cron.createTask('0 * * * *', runDigest, { noOverlap: true })` then calls `task.start()`
    - `runDigest()`:
      1. Creates `oauth2Client`, sets credentials, registers `tokens` event → `writeTokens`
      2. Calls `gmail.users.messages.list` directly (not via LLM tool call) to fetch unread messages
      3. If 0 unread: calls `gmail.users.messages.send` with subject "No new emails — all caught up!" body
      4. If unread > 0: calls `generateText` with DeepSeek, spec instructions as system prompt, Gmail read result as user message, `createGmailSendDigestTool` in tools — lets LLM compose and send the digest
    - Run with: `npx tsx scripts/gmail-scheduler.ts`
    - Depends on steps 1, 2, 6, 9

13. **Add `scripts/gmail-scheduler.ts` run command to `package.json`**
    - `"scheduler": "tsx scripts/gmail-scheduler.ts"`

---

## Verification

| Step | Signal |
|------|--------|
| Step 1 | `node_modules/googleapis` exists; `node_modules/node-cron` exists |
| Step 3 | `POST /api/save-agent` with spec body returns `{"ok":true}`; `.agent-spec.json` appears in project root |
| Step 4 | Save button visible in actions panel; clicking it creates/updates `.agent-spec.json` |
| Step 7 | `GET http://localhost:3000/api/auth/google` redirects browser to Google consent page |
| Step 8 | After Google consent, browser redirects to `/`; `.gmail-tokens.json` exists with `access_token` and `refresh_token` |
| Step 11 | In preview panel, send message "Check my inbox" — agent calls `gmail_read_inbox` tool, response shows real email subjects (not hallucinated); no "Gmail not authorized" error |
| Step 11 | In preview panel, agent calls `gmail_send_digest` — email arrives in Gmail inbox within ~30 seconds |
| Step 12 | `npm run scheduler` starts without errors; logs "Gmail agent scheduler running. Next run: top of next hour."; at the scheduled time, digest email arrives in Gmail inbox |
