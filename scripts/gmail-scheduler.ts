import cron from "node-cron";
import { readFile } from "fs/promises";
import path from "path";
import { google } from "googleapis";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { agentSpecSchema, type AgentSpec } from "../lib/agent-spec";
import { type GmailTokens } from "../lib/gmail-tokens";

const SPEC_PATH = path.join(process.cwd(), ".agent-spec.json");
const TOKENS_PATH = path.join(process.cwd(), ".gmail-tokens.json");

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loadSpec(): Promise<AgentSpec> {
  let raw: string;
  try {
    raw = await readFile(SPEC_PATH, "utf-8");
  } catch {
    console.error(`No .agent-spec.json found. Save your agent from the builder first.`);
    process.exit(1);
  }
  return agentSpecSchema.parse(JSON.parse(raw));
}

async function loadTokens(): Promise<GmailTokens> {
  let raw: string;
  try {
    raw = await readFile(TOKENS_PATH, "utf-8");
  } catch {
    console.error(
      "No .gmail-tokens.json found. Visit http://localhost:3000/api/auth/google to authorize Gmail."
    );
    process.exit(1);
  }
  return JSON.parse(raw) as GmailTokens;
}

async function saveTokens(tokens: GmailTokens) {
  const { writeFile } = await import("fs/promises");
  await writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2), "utf-8");
}

function encodeEmail(to: string, subject: string, html: string): string {
  const message = [
    `To: ${to}`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${subject}`,
    "",
    html,
  ].join("\n");
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ── Core digest run ───────────────────────────────────────────────────────────

async function runDigest(spec: AgentSpec, tokens: GmailTokens) {
  const clientId =
    process.env.GOOGLE_CLIENT_ID ?? spec.envVars?.GOOGLE_CLIENT_ID;
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET ?? spec.envVars?.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google credentials not found. Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET were collected in the builder."
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "http://localhost:3000/api/auth/google/callback"
  );
  oauth2Client.setCredentials(tokens);
  oauth2Client.on("tokens", async (refreshed) => {
    await saveTokens({
      access_token: refreshed.access_token ?? tokens.access_token,
      refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
      expiry_date: refreshed.expiry_date ?? tokens.expiry_date,
    });
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Fetch unread emails from last hour
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: "is:unread newer_than:1h",
    maxResults: 20,
  });

  const messages = listRes.data.messages ?? [];
  const profileRes = await gmail.users.getProfile({ userId: "me" });
  const emailAddress = profileRes.data.emailAddress ?? "me";

  if (messages.length === 0) {
    const raw = encodeEmail(
      emailAddress,
      "No new emails — all caught up!",
      "<p>No unread emails in the last hour. You're all caught up!</p>"
    );
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    console.log(`[${new Date().toISOString()}] No new emails. Sent confirmation.`);
    return;
  }

  // Fetch message details
  const emailDetails = await Promise.all(
    messages.map(async (msg) => {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });
      const headers = full.data.payload?.headers ?? [];
      const get = (name: string) => headers.find((h) => h.name === name)?.value ?? "";
      return {
        from: get("From"),
        subject: get("Subject"),
        date: get("Date"),
        snippet: full.data.snippet ?? "",
      };
    })
  );

  // Use DeepSeek to compose the digest
  const deepseek = createOpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY,
  });
  const model = deepseek.chat("deepseek-chat");

  const emailList = emailDetails
    .map(
      (e, i) =>
        `${i + 1}. From: ${e.from}\n   Subject: ${e.subject}\n   Date: ${e.date}\n   Preview: ${e.snippet}`
    )
    .join("\n\n");

  const { text: html } = await generateText({
    model,
    system: `${spec.instructions}\n\nYou are composing an hourly Gmail digest. Output ONLY valid HTML for an email body — no markdown, no code fences. Use inline styles for formatting since email clients strip <style> tags.`,
    prompt: `Here are ${emailDetails.length} unread emails from the last hour:\n\n${emailList}\n\nCompose the HTML digest email body now.`,
  });

  const subject = `Gmail Digest — ${emailDetails.length} email${emailDetails.length !== 1 ? "s" : ""} (${new Date().toLocaleTimeString()})`;
  const raw = encodeEmail(emailAddress, subject, html);
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

  console.log(
    `[${new Date().toISOString()}] Digest sent. ${emailDetails.length} emails summarized.`
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  // Load .env.local manually (tsx doesn't auto-load it)
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const envRaw = await readFile(envPath, "utf-8");
    for (const line of envRaw.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = value;
      }
    }
  } catch {
    // .env.local is optional at startup; may already be in env
  }

  const spec = await loadSpec();
  const tokens = await loadTokens();

  console.log(`Gmail agent scheduler started.`);
  console.log(`Agent: ${spec.name}`);
  console.log(`Schedule: top of every hour (0 * * * *)`);
  console.log(`Next run: ${new Date(Math.ceil(Date.now() / 3600000) * 3600000).toLocaleTimeString()}`);

  const task = cron.createTask("0 * * * *", async () => {
    console.log(`[${new Date().toISOString()}] Running digest...`);
    try {
      const latestTokens = await readFile(TOKENS_PATH, "utf-8").then(
        (r) => JSON.parse(r) as GmailTokens
      );
      await runDigest(spec, latestTokens);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Digest failed:`, err);
    }
  }, { noOverlap: true });

  task.start();
}

main().catch((err) => {
  console.error("Scheduler failed to start:", err);
  process.exit(1);
});
