"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TapeEntry } from "@/lib/tape";

const REFRESH_MS = 30_000;
const EXPLORER = "https://robinhoodchain.blockscout.com";

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function shortAddr(a: string): string {
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function DirectionBadge({ d }: { d: TapeEntry["direction"] }) {
  const styles =
    d === "buy"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : d === "sell"
        ? "bg-red-500/10 text-red-400 border-red-500/20"
        : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  return (
    <span
      className={`inline-block w-14 shrink-0 rounded border px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold uppercase ${styles}`}
    >
      {d}
    </span>
  );
}

function TapeRow({ e }: { e: TapeEntry }) {
  return (
    <a
      href={`${EXPLORER}/tx/${e.txHash}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 border-b border-zinc-800/60 px-4 py-2.5 transition-colors hover:bg-zinc-900/60"
    >
      <DirectionBadge d={e.direction} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[13px] text-zinc-100">
          {e.amountIn} {e.tokenInSymbol}
          <span className="mx-1.5 text-zinc-600">→</span>
          {e.amountOut} {e.tokenOutSymbol}
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-zinc-500">
          {shortAddr(e.trader)}
        </div>
      </div>
      <div className="shrink-0 font-mono text-[11px] text-zinc-500">
        {timeAgo(e.timestamp)}
      </div>
    </a>
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

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          buy / sell tape
        </p>
        <p className="font-mono text-[11px] text-zinc-600">
          refresh in {countdown}s
        </p>
      </div>
      {loading ? (
        <p className="px-4 py-8 text-center font-mono text-sm text-zinc-500">
          tuning the frequency…
        </p>
      ) : error ? (
        <p className="px-4 py-8 text-center font-mono text-sm text-red-400">
          {error}
        </p>
      ) : entries.length === 0 ? (
        <p className="px-4 py-8 text-center font-mono text-sm text-zinc-500">
          quiet skies — no swaps in range
        </p>
      ) : (
        <div className="border-t border-zinc-800/60">
          {entries.map((e) => (
            <TapeRow key={e.txHash} e={e} />
          ))}
        </div>
      )}
    </div>
  );
}
