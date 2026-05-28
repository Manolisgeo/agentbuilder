import "server-only";
import { readFile } from "fs/promises";
import path from "path";
import { google } from "googleapis";

const REDIRECT_URI = "http://localhost:3000/api/auth/google/callback";
const SPEC_PATH = path.join(process.cwd(), ".agent-spec.json");

async function loadGoogleCredentials(): Promise<{ clientId: string; clientSecret: string }> {
  // Prefer explicit env vars, fall back to saved agent spec
  const envId = process.env.GOOGLE_CLIENT_ID;
  const envSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret };

  try {
    const raw = await readFile(SPEC_PATH, "utf-8");
    const spec = JSON.parse(raw) as { envVars?: Record<string, string> };
    const clientId = spec.envVars?.GOOGLE_CLIENT_ID;
    const clientSecret = spec.envVars?.GOOGLE_CLIENT_SECRET;
    if (clientId && clientSecret) return { clientId, clientSecret };
  } catch {
    // spec file not found
  }

  throw new Error(
    "Google credentials not found. Save your agent first (the builder collects GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)."
  );
}

export async function createOAuthClient() {
  const { clientId, clientSecret } = await loadGoogleCredentials();
  return new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
}

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];
