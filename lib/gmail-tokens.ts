import "server-only";
import { readFile, writeFile } from "fs/promises";
import path from "path";

export type GmailTokens = {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
};

const TOKENS_PATH = path.join(process.cwd(), ".gmail-tokens.json");

export async function readTokens(): Promise<GmailTokens | null> {
  try {
    const raw = await readFile(TOKENS_PATH, "utf-8");
    return JSON.parse(raw) as GmailTokens;
  } catch {
    return null;
  }
}

export async function writeTokens(tokens: GmailTokens): Promise<void> {
  await writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2), "utf-8");
}
