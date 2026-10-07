import { NextResponse } from "next/server";
import { lookupToken } from "@/lib/lookup";

export const dynamic = "force-dynamic";

/** GET /api/lookup?address=<mint> — bonding-curve progress for one token. */
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address") ?? "";
  try {
    const data = await lookupToken(address);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "lookup failed";
    const status = message.startsWith("not an address") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
