"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TapeEntry } from "@/lib/tape";

const REFRESH_MS = 30_000;
const EXPLORER = "https://robinhoodchain.blockscout.com";

function timeAgo(ts: number): string {
  const secs = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (secs < 60) return `${secs}s ago`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function shortAddr(a: string): string {
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function DirectionBadge({ d }: { d: TapeEntry["direction"] }) {
  const styles =
    d === "buy"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : d === "sell"
        ? "bg-rose-100 text-rose-700 border-rose-200"
        : "bg-stone-100 text-stone-500 border-stone-200";
  return (
    <span
      className={`inline-block w-14 shrink-0 rounded-full border px-1.5 py-0.5 text-center font-mono text-[11px] font-bold uppercase ${styles}`}
    >
      {d}
    </span>
  );
}

function TapeRow({ e, fresh }: { e: TapeEntry; fresh: boolean }) {
  const hover =
    e.direction === "buy"
      ? "hover:bg-emerald-50/60"
      : e.direction === "sell"
        ? "hover:bg-rose-50/60"
        : "hover:bg-stone-50";
  return (
    <a
      href={`${EXPLORER}/tx/${e.txHash}`}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-3 border-b border-stone-200/70 px-4 py-2.5 transition-colors ${hover} ${
        fresh ? "raven-row-enter" : ""
      }`}
    >
      <DirectionBadge d={e.direction} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[13px] text-[#1c1917]">
          {e.amountIn} {e.tokenInSymbol}
          <span className="mx-1.5 text-stone-400">→</span>
          {e.amountOut} {e.tokenOutSymbol}
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-stone-500">
          {shortAddr(e.trader)}
        </div>
      </div>
      <div className="shrink-0 font-mono text-[11px] text-stone-400">
        {timeAgo(e.timestamp)}
      </div>
    </a>
  );
}

function PressureBar({ entries }: { entries: TapeEntry[] }) {
  const buys = entries.filter((e) => e.direction === "buy").length;
  const sells = entries.filter((e) => e.direction === "sell").length;
  const total = buys + sells;
  const buyPct = total === 0 ? 50 : (buys / total) * 100;
  return (
    <div className="rounded-3xl border border-stone-200/80 bg-white px-4 py-3 shadow-[0_2px_16px_rgba(28,25,23,0.05)]">
      <div className="flex items-center justify-between font-mono text-[11px]">
        <span className="font-bold text-emerald-600">{buys} buys</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">
          tape pressure
        </span>
        <span className="font-bold text-rose-600">{sells} sells</span>
      </div>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-stone-200/60">
        <div
          className="h-full rounded-full bg-emerald-400 transition-all"
          style={{ width: `${buyPct}%` }}
        />
        <div
          className="h-full rounded-full bg-rose-400 transition-all"
          style={{ width: `${100 - buyPct}%` }}
        />
      </div>
    </div>
  );
}

export default function FlowTape({
  onBlock,
}: {
  onBlock: (b: number | null) => void;
}) {
  const [entries, setEntries] = useState<TapeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);
  const seen = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/tape", { cache: "no-store" });
      if (!res.ok) throw new Error(`tape ${res.status}`);
      const json = await res.json();
      setEntries(json.entries ?? []);
      onBlock(json.latestBlock ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load tape");
    } finally {
      setLoading(false);
      setCountdown(REFRESH_MS / 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          load();
          return REFRESH_MS / 1000;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  // Mark rows seen after render so only genuinely new rows animate
  useEffect(() => {
    const t = setTimeout(() => {
      entries.forEach((e) => seen.current.add(e.txHash));
    }, 600);
    return () => clearTimeout(t);
  }, [entries]);

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
          buy / sell tape
        </p>
        <p className="font-mono text-[11px] text-stone-400">
          refresh in {countdown}s
        </p>
      </div>
      {loading ? (
        <p className="px-4 py-8 text-center font-mono text-sm text-stone-500">
          tuning the frequency…
        </p>
      ) : error ? (
        <p className="px-4 py-8 text-center font-mono text-sm text-rose-600">
          {error}
        </p>
      ) : entries.length === 0 ? (
        <p className="px-4 py-8 text-center font-mono text-sm text-stone-500">
          quiet skies — no swaps in range
        </p>
      ) : (
        <>
          <div className="px-4 pb-3">
            <PressureBar entries={entries} />
          </div>
          <div className="border-t border-stone-200/70">
            {entries.map((e) => (
              <TapeRow key={e.txHash} e={e} fresh={!seen.current.has(e.txHash)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
