import { chromium } from "playwright";
import path from "path";
import os from "os";
import fs from "fs";
import type { FbListing, FbSearchOptions, FbSearchResult } from "./types";
import { loadFbSessionCookies } from "./cookie-converter";

const CITY_SLUGS: Record<string, string> = {
  "san francisco": "sanfrancisco",
  "san francisco, ca": "sanfrancisco",
  "new york": "newyork",
  "new york, ny": "newyork",
  "los angeles": "losangeles",
  "los angeles, ca": "losangeles",
  chicago: "chicago",
  "chicago, il": "chicago",
  seattle: "seattle",
  "seattle, wa": "seattle",
  austin: "austin",
  "austin, tx": "austin",
  miami: "miami",
  "miami, fl": "miami",
  boston: "boston",
  "boston, ma": "boston",
  denver: "denver",
  "denver, co": "denver",
  portland: "portland",
  "portland, or": "portland",
};

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

  const citySlug = location ? CITY_SLUGS[location.toLowerCase()] : null;

  const params = new URLSearchParams({ query });
  if (minPrice != null) params.set("minPrice", String(minPrice));
  if (maxPrice != null) params.set("maxPrice", String(maxPrice));

  const url = citySlug
    ? `https://www.facebook.com/marketplace/${citySlug}/search/?${params}`
    : `https://www.facebook.com/marketplace/search/?${params}`;

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

    const cookies = loadFbSessionCookies(cookiesPath);
    await context.addCookies(cookies);

    const page = await context.newPage();

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

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    try {
      await page.waitForSelector('a[href*="/marketplace/item/"]', {
        timeout: 10000,
      });
    } catch {
      return { ok: true, listings: [] };
    }

    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(800);
    }

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
