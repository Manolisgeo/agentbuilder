// Generated agent runtime. Self-contained Node server: serves a chat UI and
// runs the agent with real tool implementations. Config comes from
// agent.config.json (baked at generation time) plus env at run time:
//   DEEPSEEK_API_KEY  - LLM key (required)
//   AGENT_CONFIG      - JSON: { slots: { <slot>: { baseUrl, authHeader, glob,
//                       dbUrl } }, searchApiKey }
//   DATA_ROOT         - base dir for file_search mounts (default /data)
//   PORT              - listen port (default 8080)
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, stepCountIs, jsonSchema } from "ai";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const DATA_ROOT = process.env.DATA_ROOT || "/data";

const config = JSON.parse(await readFile(join(here, "agent.config.json"), "utf8"));
const indexHtml = await readFile(join(here, "public", "index.html"), "utf8");

let runtime = { slots: {} };
try {
  runtime = { slots: {}, ...JSON.parse(process.env.AGENT_CONFIG || "{}") };
} catch {
  console.error("AGENT_CONFIG is not valid JSON; ignoring.");
}

if (!process.env.DEEPSEEK_API_KEY) {
  console.error("WARNING: DEEPSEEK_API_KEY is not set - the agent cannot answer.");
}

const deepseek = createOpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});
const model = deepseek.chat("deepseek-chat");

// ElevenLabs voice (optional). apiKey via env; voiceId/models via AGENT_CONFIG.
const EL_KEY = process.env.ELEVENLABS_API_KEY;
const voiceCfg = runtime.voice || {};
const voiceEnabled = Boolean(EL_KEY && voiceCfg.voiceId);

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

function fileSearchTool(slot) {
  const dir = join(DATA_ROOT, slot);
  return {
    description:
      "Search the user's connected files for text matching a query. Returns matching file snippets.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords to search for." },
      },
      required: ["query"],
    }),
    execute: async ({ query }) => {
      const terms = String(query || "")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      if (terms.length === 0) return { matches: [], note: "Empty query." };
      const files = await walk(dir);
      const hits = [];
      for (const file of files) {
        let text;
        try {
          text = await readFile(file, "utf8");
        } catch {
          continue; // skip binary/unreadable files
        }
        const lower = text.toLowerCase();
        if (!terms.some((t) => lower.includes(t))) continue;
        const idx = lower.indexOf(terms.find((t) => lower.includes(t)));
        const start = Math.max(0, idx - 120);
        hits.push({
          file: file.slice(dir.length + 1),
          snippet: text.slice(start, start + 400),
        });
        if (hits.length >= 5) break;
      }
      return hits.length
        ? { matches: hits }
        : { matches: [], note: "No matching files found." };
    },
  };
}

function httpApiTool(rt) {
  const baseUrl = (rt.baseUrl || "").replace(/\/+$/, "");
  return {
    description:
      "Call the connected HTTP API. Provide a path (joined to the configured base URL) and optional method/body.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        path: { type: "string", description: "Path appended to the base URL." },
        method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
        body: { type: "string", description: "Optional request body (JSON string)." },
      },
      required: ["path"],
    }),
    execute: async ({ path, method, body }) => {
      if (!baseUrl) return { error: "No base URL configured for this tool." };
      const url = baseUrl + "/" + String(path || "").replace(/^\/+/, "");
      const headers = { "Content-Type": "application/json" };
      if (rt.authHeader) headers["Authorization"] = rt.authHeader;
      try {
        const resp = await fetch(url, {
          method: method || "GET",
          headers,
          body: body || undefined,
        });
        const text = await resp.text();
        return { status: resp.status, body: text.slice(0, 4000) };
      } catch (e) {
        return { error: String((e && e.message) || e) };
      }
    },
  };
}

function dbQueryTool(rt, engine) {
  return {
    description:
      "Run a read-only SQL query (SELECT/WITH only) against the connected database.",
    inputSchema: jsonSchema({
      type: "object",
      properties: { sql: { type: "string", description: "A SELECT query." } },
      required: ["sql"],
    }),
    execute: async ({ sql }) => {
      const q = String(sql || "").trim();
      if (!/^(select|with)\b/i.test(q))
        return { error: "Only read-only SELECT/WITH queries are allowed." };
      if (!rt.dbUrl) return { error: "No database URL configured for this tool." };
      try {
        if (engine === "postgres") {
          const { default: pg } = await import("pg");
          const client = new pg.Client({ connectionString: rt.dbUrl });
          await client.connect();
          const r = await client.query(q);
          await client.end();
          return { rows: r.rows.slice(0, 50) };
        }
        if (engine === "mysql") {
          const mysql = await import("mysql2/promise");
          const conn = await mysql.createConnection(rt.dbUrl);
          const [rows] = await conn.query(q);
          await conn.end();
          return { rows: Array.isArray(rows) ? rows.slice(0, 50) : rows };
        }
        if (engine === "sqlite") {
          const { default: Database } = await import("better-sqlite3");
          const db = new Database(rt.dbUrl, { readonly: true });
          return { rows: db.prepare(q).all().slice(0, 50) };
        }
        return { error: "Unsupported engine: " + engine };
      } catch (e) {
        return { error: String((e && e.message) || e) };
      }
    },
  };
}

function webSearchTool() {
  // Accept either the deploy-form key (runtime.searchApiKey) or TAVILY_API_KEY
  // env (same var the builder's preview uses).
  const key = runtime.searchApiKey || process.env.TAVILY_API_KEY;
  return {
    description: "Search the web for up-to-date information.",
    inputSchema: jsonSchema({
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    }),
    execute: async ({ query }) => {
      if (!key)
        return { note: "Web search is not configured (no search API key)." };
      try {
        const resp = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: key,
            query,
            search_depth: "basic",
            include_answer: true,
            max_results: 5,
          }),
        });
        const data = await resp.json();
        return {
          query,
          answer: data.answer ?? null,
          sources: (data.results || []).map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.content,
          })),
        };
      } catch (e) {
        return { error: String((e && e.message) || e) };
      }
    },
  };
}

function slackSendTool(rt) {
  const webhook = rt.webhookUrl;
  return {
    description:
      "Send a message to Slack via the configured incoming webhook.",
    inputSchema: jsonSchema({
      type: "object",
      properties: { text: { type: "string", description: "Message text." } },
      required: ["text"],
    }),
    execute: async ({ text }) => {
      if (!webhook) return { error: "No Slack webhook configured." };
      try {
        const resp = await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        return { ok: resp.ok, status: resp.status };
      } catch (e) {
        return { error: String((e && e.message) || e) };
      }
    },
  };
}

// Gmail tools reuse the OAuth tokens the builder already stored, injected at
// deploy time via GOOGLE_CLIENT_ID/SECRET + GMAIL_TOKENS. googleapis is
// imported lazily so non-Gmail agents don't need the dependency at runtime.
let gmailPromise = null;
function getGmail() {
  if (!gmailPromise) {
    gmailPromise = (async () => {
      const { google } = await import("googleapis");
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const tokens = JSON.parse(process.env.GMAIL_TOKENS || "null");
      if (!clientId || !clientSecret || !tokens) {
        throw new Error(
          "Gmail is not configured (missing Google credentials or OAuth tokens). Connect Gmail in the builder, then redeploy."
        );
      }
      const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
      oauth2.setCredentials(tokens);
      return google.gmail({ version: "v1", auth: oauth2 });
    })();
  }
  return gmailPromise;
}

function gmailReadInboxTool() {
  return {
    description:
      "Fetch unread emails from the Gmail inbox from the last N hours. Returns sender, subject, snippet, and date.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        hoursBack: { type: "number", description: "How many hours back." },
      },
      required: [],
    }),
    execute: async ({ hoursBack }) => {
      try {
        const gmail = await getGmail();
        const h = hoursBack || 1;
        const list = await gmail.users.messages.list({
          userId: "me",
          q: `is:unread newer_than:${h}h`,
          maxResults: 20,
        });
        const messages = list.data.messages ?? [];
        if (messages.length === 0) return { emails: [], count: 0 };
        const emails = await Promise.all(
          messages.map(async (m) => {
            const full = await gmail.users.messages.get({
              userId: "me",
              id: m.id,
              format: "metadata",
              metadataHeaders: ["From", "Subject", "Date"],
            });
            const headers = full.data.payload?.headers ?? [];
            const get = (n) => headers.find((x) => x.name === n)?.value ?? "";
            return {
              id: m.id,
              from: get("From"),
              subject: get("Subject"),
              date: get("Date"),
              snippet: full.data.snippet ?? "",
            };
          })
        );
        return { emails, count: emails.length };
      } catch (e) {
        return { error: String((e && e.message) || e) };
      }
    },
  };
}

function gmailSendDigestTool() {
  return {
    description:
      "Send an HTML email digest to the authenticated user's Gmail inbox.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        subject: { type: "string" },
        html: { type: "string", description: "HTML body." },
      },
      required: ["subject", "html"],
    }),
    execute: async ({ subject, html }) => {
      try {
        const gmail = await getGmail();
        const profile = await gmail.users.getProfile({ userId: "me" });
        const to = profile.data.emailAddress ?? "me";
        const message = [
          "To: " + to,
          "Content-Type: text/html; charset=utf-8",
          "MIME-Version: 1.0",
          "Subject: " + subject,
          "",
          html,
        ].join("\n");
        const raw = Buffer.from(message)
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
        await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
        return { sent: true, to, subject };
      } catch (e) {
        return { error: String((e && e.message) || e) };
      }
    },
  };
}

const tools = {};
for (const t of config.tools || []) {
  const rt = (runtime.slots && runtime.slots[t.slot]) || {};
  if (t.type === "file_search") tools[t.name] = fileSearchTool(t.slot);
  else if (t.type === "http_api" || t.type === "http_request")
    tools[t.name] = httpApiTool(rt);
  else if (t.type === "db_query") tools[t.name] = dbQueryTool(rt, t.engine);
  else if (t.type === "web_search") tools[t.name] = webSearchTool();
  else if (t.type === "slack_send") tools[t.name] = slackSendTool(rt);
  else if (t.type === "gmail_read_inbox") tools[t.name] = gmailReadInboxTool();
  else if (t.type === "gmail_send_digest") tools[t.name] = gmailSendDigestTool();
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(indexHtml);
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ ok: true, agent: config.name, voice: voiceEnabled })
    );
    return;
  }
  // Text-to-speech: { text } -> ElevenLabs audio (mp3).
  if (req.method === "POST" && req.url === "/api/tts") {
    if (!voiceEnabled) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Voice not configured." }));
      return;
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let text = "";
    try {
      text = JSON.parse(raw).text || "";
    } catch {
      // ignore
    }
    if (!text.trim()) {
      res.writeHead(400);
      res.end("empty text");
      return;
    }
    try {
      const resp = await fetch(
        "https://api.elevenlabs.io/v1/text-to-speech/" + voiceCfg.voiceId,
        {
          method: "POST",
          headers: {
            "xi-api-key": EL_KEY,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: text.slice(0, 5000),
            model_id: voiceCfg.ttsModel || "eleven_turbo_v2_5",
          }),
        }
      );
      if (!resp.ok) {
        const msg = await resp.text().catch(() => "");
        res.writeHead(resp.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: msg.slice(0, 300) || "TTS failed" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "audio/mpeg" });
      const buf = Buffer.from(await resp.arrayBuffer());
      res.end(buf);
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String((e && e.message) || e) }));
    }
    return;
  }
  // Speech-to-text: raw audio body -> ElevenLabs Scribe -> { text }.
  if (req.method === "POST" && req.url === "/api/stt") {
    if (!voiceEnabled) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Voice not configured." }));
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const audio = Buffer.concat(chunks);
    try {
      const form = new FormData();
      const type = req.headers["content-type"] || "audio/webm";
      form.append("file", new Blob([audio], { type }), "audio.webm");
      form.append("model_id", voiceCfg.sttModel || "scribe_v1");
      const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": EL_KEY },
        body: form,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        res.writeHead(resp.status, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ error: data.detail || "STT failed", text: "" })
        );
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ text: data.text || "" }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String((e && e.message) || e) }));
    }
    return;
  }
  if (req.method === "POST" && req.url === "/api/chat") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let messages = [];
    try {
      messages = JSON.parse(raw).messages || [];
    } catch {
      // ignore malformed body, treat as empty
    }
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    try {
      const result = streamText({
        model,
        system: config.systemPrompt,
        messages,
        tools: Object.keys(tools).length ? tools : undefined,
        stopWhen: stepCountIs(8),
      });
      for await (const delta of result.textStream) res.write(delta);
    } catch (e) {
      res.write("\n[error] " + String((e && e.message) || e));
    }
    res.end();
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(
    "Agent '" + config.name + "' listening on http://localhost:" + PORT
  );
});
