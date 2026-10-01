"use client";

import { useCallback, useEffect, useState } from "react";
import type { Graduation, NearGraduation } from "@/lib/graduation";

const EXPLORER = "https://robinhoodchain.blockscout.com";
const REFRESH_MS = 5 * 60_000;

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}

/** Heat color for graduation progress: cool early, hot near the line. */
function heat(pct: number): { bar: string; track: string; text: string } {
  if (pct >= 90)
    return { bar: "bg-rose-400", track: "bg-rose-100", text: "text-rose-600" };
  if (pct >= 70)
    return {
      bar: "bg-orange-400",
      track: "bg-orange-100",
      text: "text-orange-600",
    };
  if (pct >= 50)
    return { bar: "bg-amber-400", track: "bg-amber-100", text: "text-amber-700" };
  return {
    bar: "bg-emerald-400",
    track: "bg-emerald-100",
    text: "text-emerald-600",
  };
}

const rankColor = ["text-amber-600", "text-stone-400", "text-orange-600"];

function NearRow({ t, rank }: { t: NearGraduation; rank: number }) {
  const pct = Math.min(100, t.progress * 100);
  const h = heat(pct);
  return (
    <a
      href={`${EXPLORER}/token/${t.token}`}
      target="_blank"
      rel="noreferrer"
      className="flex gap-3 border-b border-stone-200/70 px-4 py-3.5 transition-colors hover:bg-amber-50/60"
    >
      <span
        className={`w-6 shrink-0 pt-0.5 font-mono text-[13px] font-bold ${
          rankColor[rank] ?? "text-stone-400"
        }`}
      >
        {rank + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-mono text-[14px] font-bold text-[#1c1917]">
            ${t.symbol}
          </span>
          <span className={`shrink-0 font-mono text-[12px] font-bold ${h.text}`}>
            {pct.toFixed(1)}%
          </span>
        </div>
        <div className={`mt-2 h-2.5 overflow-hidden rounded-full ${h.track}`}>
          <div
            className={`h-full rounded-full ${h.bar} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[11px] text-stone-500">
          <span>
            {fmt(t.raised)} / {fmt(t.threshold)} USDG
          </span>
          <span>
            24h <span className="font-bold text-stone-700">+{fmt(t.velocity24h)}</span>
          </span>
        </div>
      </div>
    </a>
  );
}

function GradRow({ g }: { g: Graduation }) {
  return (
    <a
      href={`${EXPLORER}/token/${g.token}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-3 border-b border-stone-200/70 px-4 py-2.5 transition-colors hover:bg-emerald-50/60"
    >
      <span className="flex items-center gap-2 font-mono text-[13px] font-semibold text-[#1c1917]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
        ${g.symbol}
      </span>
      <span className="shrink-0 font-mono text-[11px] text-stone-500">
        seeded {fmt(g.pairAmount)} {g.pair} · {timeAgo(g.timestamp)}
      </span>
    </a>
  );
}

export default function TodayView() {
  const [nearing, setNearing] = useState<NearGraduation[]>([]);
  const [graduated, setGraduated] = useState<Graduation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/today", { cache: "no-store" });
      if (!res.ok) throw new Error(`today ${res.status}`);
      const json = await res.json();
      setNearing(json.nearing ?? []);
      setGraduated(json.graduated ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load today");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (loading) {
    return (
      <p className="px-4 py-16 text-center font-mono text-sm text-stone-500">
        scanning the curves…
      </p>
    );
  }
  if (error) {
    return (
      <p className="px-4 py-16 text-center font-mono text-sm text-rose-600">
        {error}
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
          nearing graduation
        </p>
        <p className="font-mono text-[11px] text-amber-700/80">
          ranked by velocity
        </p>
      </div>
      {nearing.length === 0 ? (
        <p className="px-4 py-6 font-mono text-sm text-stone-400">
          no active curves in range
        </p>
      ) : (
        <div className="border-t border-stone-200/70">
          {nearing.map((t, i) => (
            <NearRow key={t.token} t={t} rank={i} />
          ))}
        </div>
      )}

      <div className="px-4 pb-1 pt-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
          recently graduated
        </p>
      </div>
      {graduated.length === 0 ? (
        <p className="px-4 py-6 font-mono text-sm text-stone-400">
          no graduations in range
        </p>
      ) : (
        <div className="border-t border-stone-200/70">
          {graduated.map((g) => (
            <GradRow key={g.token + g.blockNumber} g={g} />
          ))}
        </div>
      )}
      <p className="px-4 py-4 font-mono text-[11px] leading-relaxed text-stone-500">
        Graduation = 8,090 USDG net raised on the bonding curve. Progress is
        computed from on-chain buys and sells.
      </p>
    </div>
  );
}
