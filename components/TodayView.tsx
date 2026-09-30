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

function NearRow({ t }: { t: NearGraduation }) {
  const pct = Math.min(100, t.progress * 100);
  return (
    <a
      href={`${EXPLORER}/token/${t.token}`}
      target="_blank"
      rel="noreferrer"
      className="block border-b border-zinc-800/60 px-4 py-3 transition-colors hover:bg-zinc-900/60"
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[14px] font-semibold text-zinc-100">
          ${t.symbol}
        </span>
        <span className="font-mono text-[12px] text-zinc-400">
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[11px] text-zinc-500">
        <span>
          {fmt(t.raised)} / {fmt(t.threshold)} USDG
        </span>
        <span>24h +{fmt(t.velocity24h)}</span>
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
      className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-2.5 transition-colors hover:bg-zinc-900/60"
    >
      <span className="font-mono text-[13px] text-zinc-100">${g.symbol}</span>
      <span className="font-mono text-[11px] text-zinc-500">
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
      <p className="px-4 py-16 text-center font-mono text-sm text-zinc-500">
        scanning the curves…
      </p>
    );
  }
  if (error) {
    return (
      <p className="px-4 py-16 text-center font-mono text-sm text-red-400">
        {error}
      </p>
    );
  }

  return (
    <div>
      <div className="px-4 pb-1 pt-3">
        <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          nearing graduation
        </p>
      </div>
      {nearing.length === 0 ? (
        <p className="px-4 py-6 font-mono text-sm text-zinc-600">
          no active curves in range
        </p>
      ) : (
        <div className="border-t border-zinc-800/60">
          {nearing.map((t) => (
            <NearRow key={t.token} t={t} />
          ))}
        </div>
      )}

      <div className="px-4 pb-1 pt-6">
        <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          recently graduated
        </p>
      </div>
      {graduated.length === 0 ? (
        <p className="px-4 py-6 font-mono text-sm text-zinc-600">
          no graduations in range
        </p>
      ) : (
        <div className="border-t border-zinc-800/60">
          {graduated.map((g) => (
            <GradRow key={g.token + g.blockNumber} g={g} />
          ))}
        </div>
      )}
      <p className="px-4 py-4 font-mono text-[11px] leading-relaxed text-zinc-600">
        Graduation = 8,090 USDG net raised on the bonding curve. Progress is
        computed from on-chain buys and sells.
      </p>
    </div>
  );
}
