import { NextRequest, NextResponse } from "next/server";
import { searchFbMarketplace } from "@/lib/fb-marketplace/searcher";
import type { FbSearchOptions } from "@/lib/fb-marketplace/types";

export const maxDuration = 120;

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
