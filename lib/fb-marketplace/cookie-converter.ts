import fs from "fs";
import path from "path";
import os from "os";

const CACHE_DIR = path.join(os.homedir(), ".config", "agentsbuilder");
const CACHE_PATH = path.join(CACHE_DIR, "fb-session.json");

export type PlaywrightCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "None" | "Lax" | "Strict";
};

export function convertNetscapeCookies(rawPath: string): PlaywrightCookie[] {
  const raw = fs.readFileSync(rawPath, "utf-8");
  const seen = new Set<string>();
  const cookies: PlaywrightCookie[] = [];

  for (const line of raw.split("\n")) {
    if (line.startsWith("#") || !line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length < 7) continue;

    const [domain, , cookiePath, secure, expires, name, ...valueParts] = parts;
    const value = valueParts.join("\t");

    const isFacebook =
      domain.includes("facebook") ||
      domain.includes("fbcdn") ||
      domain.includes("instagram");
    if (!isFacebook) continue;

    const key = `${name}::${domain}`;
    if (seen.has(key)) continue;
    seen.add(key);

    cookies.push({
      name,
      value,
      domain,
      path: cookiePath,
      expires: parseInt(expires) || -1,
      httpOnly: false,
      secure: secure?.toUpperCase() === "TRUE",
      sameSite: "None",
    });
  }

  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cookies, null, 2));
  return cookies;
}

export function loadFbSessionCookies(rawPath: string): PlaywrightCookie[] {
  if (fs.existsSync(CACHE_PATH)) {
    const cacheStat = fs.statSync(CACHE_PATH);
    const rawStat = fs.statSync(rawPath);
    if (cacheStat.mtimeMs > rawStat.mtimeMs) {
      return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
    }
  }
  return convertNetscapeCookies(rawPath);
}
