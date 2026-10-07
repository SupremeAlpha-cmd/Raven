import { NextResponse } from "next/server";
import { getToday } from "@/lib/graduation";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** GET /api/today — graduation calendar: nearing + recently graduated. */
export async function GET() {
  try {
    const data = await getToday();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "today failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
