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
  return {
    description: "Search the web for up-to-date information.",
    inputSchema: jsonSchema({
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    }),
    execute: async ({ query }) => {
      if (!runtime.searchApiKey)
        return { note: "Web search is not configured (no search API key)." };
      try {
        const resp = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: runtime.searchApiKey,
            query,
            max_results: 5,
          }),
        });
        const data = await resp.json();
        return {
          results: (data.results || []).map((r) => ({
            title: r.title,
            url: r.url,
            content: r.content,
          })),
        };
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
  else if (t.type === "http_api") tools[t.name] = httpApiTool(rt);
  else if (t.type === "db_query") tools[t.name] = dbQueryTool(rt, t.engine);
  else if (t.type === "web_search") tools[t.name] = webSearchTool();
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(indexHtml);
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, agent: config.name }));
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
