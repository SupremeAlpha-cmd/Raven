import { NextResponse } from "next/server";
import { getWalletLeaderboard } from "@/lib/wallets";

export const dynamic = "force-dynamic";

/** GET /api/wallets — most active wallets over the recent window. */
export async function GET() {
  try {
    const data = await getWalletLeaderboard(25);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "wallets failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
