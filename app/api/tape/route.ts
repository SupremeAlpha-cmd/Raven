import { NextResponse } from "next/server";
import { getRecentSwaps } from "@/lib/tape";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/tape — the most recent pump.fun curve trades on Solana. */
export async function GET() {
  try {
    const { entries, latestBlock } = await getRecentSwaps();
    return NextResponse.json(
      { entries, latestBlock, count: entries.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "tape failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
