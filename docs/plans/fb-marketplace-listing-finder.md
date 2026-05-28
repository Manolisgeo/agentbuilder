# Facebook Marketplace Listing Finder — Agent Implementation Plan

> **Status:** Research complete. This plan is the authoritative implementation guide for DeepSeek-driven code generation. Every file path, schema shape, tool name, and code pattern is exact — do not deviate.

---

## Goal

Add a `fb_marketplace_search` tool type to the agent builder so users can create agents that search Facebook Marketplace listings, filter by location/price/keyword, and render the results as a rich visual card feed inside the PreviewPanel — using the same `renderDashboard` rendering pipeline already in place.

**What it does at runtime:**
1. Agent is configured with a `fb_marketplace_search` tool and a session cookie file path
2. User asks "find me road bikes under $200 in San Francisco"
3. Agent calls `fb_marketplace_search(query, location, maxPrice)`
4. The tool spawns a headless Playwright browser via `facebook-cli` code embedded in the project
5. Results (title, price, location, URL, images) are returned as JSON
6. Agent calls `renderDashboard` with an HTML card grid of the listings

**What it does NOT do:**
- Message sellers (requires Messenger PIN + Lexical editor automation — too fragile)
- Require a Facebook API key (uses browser session cookies)
- Run in production/Vercel (local only — Playwright can't run in serverless)

---

## Architecture Overview

```
User prompt
    │
    ▼
/api/preview route (existing)
    │  calls fb_marketplace_search tool
    ▼
/api/tools/fb-marketplace route  ◄── NEW
    │  spawns child_process
    ▼
lib/fb-marketplace/searcher.ts   ◄── NEW
    │  Playwright + Facebook session cookies
    ▼
facebook.com/marketplace/{city}/search/?query=...
    │
    ▼
JSON listings array → back to preview route → agent → renderDashboard
```

---

## Constraints (must be respected)

- Stack: Next.js 15 App Router, TypeScript, no new npm packages beyond what's listed below
- New npm packages required: **none** — Playwright is already used in the project (`.playwright-mcp/` exists), `child_process` is Node built-in
- `DEEPSEEK_API_KEY` is the only LLM env var — unchanged
- New env var: `FB_SESSION_COOKIES_PATH` — path to a Netscape cookies.txt file exported from the user's browser
- Tool type string: exactly `"fb_marketplace_search"` — must be added to `TOOL_TYPES` in `lib/agent-spec.ts`
- The preview API route at `app/api/preview/route.ts` gets this tool via the existing `createPreviewTools()` pattern — exactly like `renderDashboard` was added
- Canvas node: reuses `BoardNodeKind = "tool"` — no new node types needed
- The searcher code is **self-contained** in `lib/fb-marketplace/` — it does NOT depend on the `/tmp/facebook-cli` test repo
- Session cookies are stored at the path in `FB_SESSION_COOKIES_PATH` (Netscape format) and converted to Playwright JSON on first use, cached at `~/.config/agentsbuilder/fb-session.json`

---

## Files to Create

```
lib/fb-marketplace/
  searcher.ts          ← Playwright search logic (headless, cookies, SF city slug)
  cookie-converter.ts  ← Netscape .txt → Playwright JSON format
  types.ts             ← FbListing, FbSearchOptions types

app/api/tools/
  fb-marketplace/
    route.ts           ← POST handler, calls searcher, returns JSON
```

## Files to Modify

```
lib/agent-spec.ts      ← Add "fb_marketplace_search" to TOOL_TYPES
lib/preview-runtime.ts ← Add fb_marketplace_search case to createPreviewTools()
lib/agent-prompt.ts    ← Add toolsSection case for fb_marketplace_search
```

---

## Step 1 — Types (`lib/fb-marketplace/types.ts`)

```typescript
export type FbListing = {
  id: string;
  title: string | null;
  price: number;
  currency: string;
  location: string;
  url: string;
  images: string[];
  seller: { id: string; name: string };
  postedAt: string;
};

export type FbSearchOptions = {
  query: string;
  location?: string;   // e.g. "San Francisco, CA"
  minPrice?: number;
  maxPrice?: number;
  limit?: number;      // default 10
};

export type FbSearchResult = {
  ok: true;
  listings: FbListing[];
} | {
  ok: false;
  error: string;
};
```

---

## Step 2 — Cookie Converter (`lib/fb-marketplace/cookie-converter.ts`)

Converts a Netscape-format cookies.txt (exported by any browser extension) to Playwright's JSON cookie array. Filters to only Facebook/Instagram cookies. Deduplicates by (name, domain). Caches result at `~/.config/agentsbuilder/fb-session.json`.

```typescript
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
  // Read and parse Netscape format
  // Filter to facebook.com / .facebook.com / fbcdn.net
  // Deduplicate by (name, domain)
  // Cache to CACHE_PATH
  // Return array
}

export function loadFbSessionCookies(rawPath: string): PlaywrightCookie[] {
  // If CACHE_PATH exists and is newer than rawPath, return cached
  // Otherwise call convertNetscapeCookies and return result
}
```

**Full implementation — exact code for `convertNetscapeCookies`:**

```typescript
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
```

---

## Step 3 — Searcher (`lib/fb-marketplace/searcher.ts`)

This is the core Playwright logic. **Exact implementation below — copy verbatim.**

**Key learnings from live test (DO NOT change these):**
- Facebook Marketplace serves listings at `facebook.com/marketplace/{citySlug}/search/?query={q}` — city slug in URL avoids the broken UI location filter
- The installed Playwright Chromium is at `~/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` — must use `executablePath` because the headless shell binary is a different download
- After loading cookies, navigate to `facebook.com` first, confirm URL doesn't contain `login` — if it does, cookies are expired and the tool should return an error with instructions to re-export cookies
- Listings are extracted from `a[href*="/marketplace/item/"]` links — selector is stable
- The list view does NOT include seller IDs — only title, price (garbled into location string), location, and URL
- Price parsing from cards is unreliable — skip it; return raw text fields and let the agent describe them
- Each search takes ~20–30 seconds (browser cold start + page load + scroll)

```typescript
import { chromium } from "playwright";
import path from "path";
import os from "os";
import fs from "fs";
import type { FbListing, FbSearchOptions, FbSearchResult } from "./types";
import { loadFbSessionCookies } from "./cookie-converter";

// Hardcoded city slug map — add more as needed
const CITY_SLUGS: Record<string, string> = {
  "san francisco":       "sanfrancisco",
  "san francisco, ca":   "sanfrancisco",
  "new york":            "newyork",
  "new york, ny":        "newyork",
  "los angeles":         "losangeles",
  "los angeles, ca":     "losangeles",
  "chicago":             "chicago",
  "chicago, il":         "chicago",
  "seattle":             "seattle",
  "seattle, wa":         "seattle",
  "austin":              "austin",
  "austin, tx":          "austin",
  "miami":               "miami",
  "miami, fl":           "miami",
  "boston":              "boston",
  "boston, ma":          "boston",
  "denver":              "denver",
  "denver, co":          "denver",
  "portland":            "portland",
  "portland, or":        "portland",
};

// Path to Chrome for Testing installed by Playwright
const CHROME_PATH = path.join(
  os.homedir(),
  "Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64",
  "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
);

export async function searchFbMarketplace(
  options: FbSearchOptions
): Promise<FbSearchResult> {
  const cookiesPath = process.env.FB_SESSION_COOKIES_PATH;
  if (!cookiesPath || !fs.existsSync(cookiesPath)) {
    return {
      ok: false,
      error:
        "FB_SESSION_COOKIES_PATH is not set or file does not exist. " +
        "Export your Facebook cookies as cookies.txt (Netscape format) using a browser extension " +
        "and set FB_SESSION_COOKIES_PATH=/path/to/cookies.txt in .env.local.",
    };
  }

  const { query, location, minPrice, maxPrice, limit = 10 } = options;

  // Resolve city slug
  const citySlug = location ? CITY_SLUGS[location.toLowerCase()] : null;

  // Build URL
  const params = new URLSearchParams({ query });
  if (minPrice != null) params.set("minPrice", String(minPrice));
  if (maxPrice != null) params.set("maxPrice", String(maxPrice));

  const url = citySlug
    ? `https://www.facebook.com/marketplace/${citySlug}/search/?${params}`
    : `https://www.facebook.com/marketplace/search/?${params}`;

  // Launch browser
  const launchOptions: Parameters<typeof chromium.launch>[0] = {
    headless: true,
    slowMo: 50,
  };
  if (fs.existsSync(CHROME_PATH)) {
    launchOptions.executablePath = CHROME_PATH;
  }

  const browser = await chromium.launch(launchOptions);

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    // Load session cookies
    const cookies = loadFbSessionCookies(cookiesPath);
    await context.addCookies(cookies);

    const page = await context.newPage();

    // Verify session is valid
    await page.goto("https://www.facebook.com", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    if (currentUrl.includes("login") || currentUrl.includes("checkpoint")) {
      return {
        ok: false,
        error:
          "Facebook session cookies are expired or invalid. " +
          "Please re-export your cookies.txt from facebook.com while logged in.",
      };
    }

    // Navigate to search
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Wait for listing links
    try {
      await page.waitForSelector('a[href*="/marketplace/item/"]', {
        timeout: 10000,
      });
    } catch {
      return { ok: true, listings: [] };
    }

    // Scroll to load more
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(800);
    }

    // Extract listings
    const links = await page.locator('a[href*="/marketplace/item/"]').all();
    const listings: FbListing[] = [];

    for (const link of links.slice(0, limit)) {
      try {
        const href = (await link.getAttribute("href")) || "";
        const match = href.match(/\/marketplace\/item\/(\d+)/);
        if (!match) continue;
        const id = match[1];
        if (listings.some((l) => l.id === id)) continue;

        const text = (await link.textContent()) || "";

        listings.push({
          id,
          title: text.trim() || null,
          price: 0,
          currency: "USD",
          location: location || "Unknown",
          url: `https://facebook.com/marketplace/item/${id}/`,
          images: [],
          seller: { id: "", name: "Unknown" },
          postedAt: new Date().toISOString(),
        });
      } catch {
        continue;
      }
    }

    return { ok: true, listings };
  } finally {
    await browser.close();
  }
}
```

---

## Step 4 — API Route (`app/api/tools/fb-marketplace/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { searchFbMarketplace } from "@/lib/fb-marketplace/searcher";
import type { FbSearchOptions } from "@/lib/fb-marketplace/types";

export const maxDuration = 120; // Playwright needs time

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const options: FbSearchOptions = {
      query: body.query ?? "item",
      location: body.location,
      minPrice: body.minPrice,
      maxPrice: body.maxPrice,
      limit: Math.min(body.limit ?? 10, 20),
    };

    const result = await searchFbMarketplace(options);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
```

---

## Step 5 — Add Tool Type to Agent Spec (`lib/agent-spec.ts`)

Find the `TOOL_TYPES` array and add `"fb_marketplace_search"`:

```typescript
// BEFORE:
export const TOOL_TYPES = [
  "web_search",
  "gmail_read_inbox",
  "gmail_summarizer",
  "gmail_send_digest",
  "slack_send",
  "http_request",
  "custom",
  "file_search",
  "http_api",
  "db_query",
] as const;

// AFTER — add exactly one entry:
export const TOOL_TYPES = [
  "web_search",
  "gmail_read_inbox",
  "gmail_summarizer",
  "gmail_send_digest",
  "slack_send",
  "http_request",
  "custom",
  "file_search",
  "http_api",
  "db_query",
  "fb_marketplace_search",   // ← ADD THIS
] as const;
```

No other changes needed in `agent-spec.ts` — the schema automatically includes it.

---

## Step 6 — Preview Runtime Tool (`lib/preview-runtime.ts`)

Inside `createPreviewTools()` (or wherever `renderDashboard` tool is registered), add the `fb_marketplace_search` case. Pattern mirrors `web_search` tool — it calls the API route internally.

```typescript
// Add to the tools object returned by createPreviewTools():
fb_marketplace_search: tool({
  description:
    "Search Facebook Marketplace listings by keyword, location, and price range. " +
    "Returns a list of listings with title, price, location, and URL. " +
    "After getting results, always call renderDashboard to display them visually.",
  parameters: z.object({
    query: z.string().describe("Search keyword, e.g. 'road bike', 'mountain bike'"),
    location: z
      .string()
      .optional()
      .describe("City name, e.g. 'San Francisco, CA'. Supported: San Francisco, New York, Los Angeles, Chicago, Seattle, Austin, Miami, Boston, Denver, Portland"),
    minPrice: z.number().optional().describe("Minimum price in USD"),
    maxPrice: z.number().optional().describe("Maximum price in USD"),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("Max listings to return (max 20)"),
  }),
  execute: async ({ query, location, minPrice, maxPrice, limit }) => {
    // Only run if this tool is configured on the agent
    const hasTool = spec.tools.some((t) => t.type === "fb_marketplace_search");
    if (!hasTool) {
      return { ok: false, error: "fb_marketplace_search tool not configured on this agent." };
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/tools/fb-marketplace`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, location, minPrice, maxPrice, limit }),
        }
      );
      const data = await res.json();
      return data;
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to search marketplace",
      };
    }
  },
}),
```

---

## Step 7 — Agent Prompt (`lib/agent-prompt.ts`)

In `buildAgentRuntimePrompt`, add a case for `fb_marketplace_search` in the tools section:

```typescript
// Add to the toolsSection logic:
const hasFbSearch = spec.tools.some((t) => t.type === "fb_marketplace_search");

if (liveTools && hasFbSearch) {
  toolsSection = `\n\n## Live capabilities\n${capabilityLines}\n\n` +
    `You have access to \`fb_marketplace_search\` to find listings on Facebook Marketplace. ` +
    `When the user asks to find, search, or browse Marketplace listings for any item, call \`fb_marketplace_search\` ` +
    `with their keyword, location (city + state), and optional price range. ` +
    `After receiving results, ALWAYS call \`renderDashboard\` with a rich HTML card grid showing the listings — ` +
    `include title, price, location, and a clickable link for each listing. ` +
    `If ok is false, tell the user the error clearly and ask them to check their cookies file.`;
}
```

---

## Step 8 — The renderDashboard HTML Template

When the agent calls `renderDashboard` after `fb_marketplace_search`, it should generate HTML like this. **This exact template should be included in the agent's instructions** so DeepSeek generates it correctly:

```html
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
         background: #f8f9fa; margin: 0; padding: 16px; }
  h2 { font-size: 16px; color: #1c1e21; margin: 0 0 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  .card { background: white; border-radius: 8px; overflow: hidden; 
          box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .card-body { padding: 10px; }
  .card-title { font-size: 13px; font-weight: 600; color: #1c1e21; 
                margin: 0 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card-meta { font-size: 11px; color: #65676b; margin: 2px 0; }
  .card-link { display: block; margin-top: 8px; font-size: 12px; color: #1877f2; 
               text-decoration: none; font-weight: 500; }
  .card-link:hover { text-decoration: underline; }
  .badge { display: inline-block; background: #e7f3ff; color: #1877f2; 
           font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
  .empty { text-align: center; color: #65676b; padding: 32px; font-size: 14px; }
</style>
</head>
<body>
  <h2>🚲 {QUERY} near {LOCATION} — {COUNT} listings</h2>
  <div class="grid">
    {CARDS}
  </div>
</body>
</html>
```

Each `{CARDS}` entry:
```html
<div class="card">
  <div class="card-body">
    <div class="card-title">{TITLE}</div>
    <div class="card-meta">📍 {LOCATION}</div>
    <a class="card-link" href="{URL}" target="_blank">View on Marketplace →</a>
  </div>
</div>
```

---

## Step 9 — Sample Agent Spec for the Builder

When a user asks "build me a Facebook Marketplace bike finder", DeepSeek should generate exactly this spec via `updatePersona`, `updateInstructions`, `addTool`, and `updateAgentUi`:

```json
{
  "name": "Marketplace Scout",
  "persona": {
    "role": "A specialized shopping assistant that searches Facebook Marketplace for items near you",
    "tone": "Helpful, direct, and efficient"
  },
  "instructions": "You help users find items on Facebook Marketplace. When the user asks to find or search for any item:\n1. Extract the item keyword, location (default: San Francisco, CA), and any price constraints they mention\n2. Call fb_marketplace_search with those parameters\n3. If ok is true, call renderDashboard with a card grid HTML showing the listings. Include title, location, and a View link for each card\n4. If ok is false, show the error and ask the user to verify their FB_SESSION_COOKIES_PATH setting\n5. After showing results, ask if they want to refine the search (different location, price range, or keywords)",
  "tools": [
    {
      "id": "fb-search-1",
      "name": "Marketplace Search",
      "type": "fb_marketplace_search"
    }
  ]
}
```

---

## Step 10 — Environment Variables

Add to `.env.local`:

```bash
# Path to your Facebook session cookies exported as Netscape cookies.txt
# Export using Cookie-Editor or EditThisCookie browser extension from facebook.com while logged in
FB_SESSION_COOKIES_PATH=/Users/yourname/Downloads/cookies.txt
```

Add `FB_SESSION_COOKIES_PATH` to the credential collection flow in `lib/orchestrator-prompt.ts` under the `buildCredentialGuide` function so the builder prompts the user to provide it when `fb_marketplace_search` is detected.

---

## Step 11 — Builder Prompt Addition (orchestrator-prompt.ts)

In `buildCredentialGuide(spec: AgentSpec)`, add a case:

```typescript
if (spec.tools.some(t => t.type === "fb_marketplace_search")) {
  lines.push(
    "**Facebook Marketplace** requires a session cookies file:",
    "1. Go to facebook.com in your browser and make sure you're logged in",
    "2. Install the **Cookie-Editor** browser extension",
    "3. Click Cookie-Editor → Export → Export as Netscape → save as `cookies.txt`",
    "4. Add `FB_SESSION_COOKIES_PATH=/path/to/cookies.txt` to your `.env.local` file",
    "5. The cookies are valid for ~90 days; re-export when searches start failing"
  );
}
```

---

## Known Limitations (document these for the user)

| Limitation | Reason | Workaround |
|------------|--------|------------|
| Local only, no Vercel deploy | Playwright can't run in serverless | Run `next dev` locally |
| ~25s per search | Browser cold start + page load | Acceptable for manual use |
| Title/price parsing is rough | FB uses garbled CSS class names | Agent describes text; user clicks link |
| No seller messaging | Messenger requires PIN + Lexical editor automation | User clicks the listing URL |
| Cookies expire in ~90 days | Facebook session timeout | Re-export cookies.txt |
| Location must be in CITY_SLUGS map | FB uses city slugs in URL | Add new cities to the map in `searcher.ts` |

---

## Implementation Order for DeepSeek

Generate in this exact order — each step is independent and testable:

1. `lib/fb-marketplace/types.ts` — just types, no logic
2. `lib/fb-marketplace/cookie-converter.ts` — pure file I/O, no Playwright
3. `lib/fb-marketplace/searcher.ts` — full Playwright search
4. `app/api/tools/fb-marketplace/route.ts` — thin POST wrapper
5. `lib/agent-spec.ts` — add `"fb_marketplace_search"` to `TOOL_TYPES`
6. `lib/preview-runtime.ts` — add tool registration
7. `lib/agent-prompt.ts` — add toolsSection case
8. `lib/orchestrator-prompt.ts` — add credential guide case
