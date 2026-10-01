"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TapeEntry } from "@/lib/tape";
import { SignalTag, TugMeter, WatchLoading, EmptyScope } from "./raven-ui";

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

function DirectionTag({ d }: { d: TapeEntry["direction"] }) {
  const styles =
    d === "buy"
      ? "bg-emerald-500 text-white"
      : d === "sell"
        ? "bg-rose-500 text-white"
        : "bg-(--raven-soft) text-(--raven-muted)";
  return (
    <span
      className={`inline-block w-16 shrink-0 rounded-md px-1.5 py-1 text-center font-mono text-[11px] font-black uppercase tracking-wide ${styles}`}
    >
      {d === "buy" ? "▲ buy" : d === "sell" ? "▼ sell" : d}
    </span>
  );
}

function TapeRow({ e, fresh }: { e: TapeEntry; fresh: boolean }) {
  const hover =
    e.direction === "buy"
      ? "hover:bg-emerald-500/10"
      : e.direction === "sell"
        ? "hover:bg-rose-500/10"
        : "hover:bg-(--raven-soft)";
  return (
    <a
      href={`${EXPLORER}/tx/${e.txHash}`}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-3 border-b border-(--raven-line)/70 px-4 py-2.5 transition-colors ${hover} ${
        fresh ? "raven-row-enter" : ""
      }`}
    >
      <DirectionTag d={e.direction} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[13px] font-bold text-(--raven-ink)">
          {e.amountIn} {e.tokenInSymbol}
          <span className="mx-1.5 text-(--raven-faint)">→</span>
          {e.amountOut} {e.tokenOutSymbol}
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-(--raven-muted)">
          {shortAddr(e.trader)}
        </div>
      </div>
      <div className="shrink-0 font-mono text-[11px] font-bold text-(--raven-faint)">
        {timeAgo(e.timestamp)}
      </div>
    </a>
  );
}

function PressurePanel({ entries }: { entries: TapeEntry[] }) {
  const buys = entries.filter((e) => e.direction === "buy").length;
  const sells = entries.filter((e) => e.direction === "sell").length;
  const total = buys + sells;
  const buyPct = total === 0 ? 50 : (buys / total) * 100;
  const verdict =
    buys - sells >= 5 ? (
      <span className="font-black text-emerald-600 dark:text-emerald-400">▲ BUYERS IN CONTROL</span>
    ) : sells - buys >= 5 ? (
      <span className="font-black text-rose-600 dark:text-rose-400">▼ SELLERS IN CONTROL</span>
    ) : (
      <span className="font-black text-(--raven-muted)">■ DEAD EVEN</span>
    );
  return (
    <div className="border-2 border-(--raven-ink) bg-(--raven-card) px-4 py-3.5 shadow-[4px_4px_0_rgba(var(--raven-shadow),0.12)]">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-3xl font-black text-emerald-600 dark:text-emerald-400">{buys}</p>
          <p className="font-mono text-[10px] font-black uppercase tracking-widest text-emerald-700">
            buys
          </p>
        </div>
        <p className="pb-1 text-center font-mono text-[11px]">{verdict}</p>
        <div className="text-right">
          <p className="font-mono text-3xl font-black text-rose-600 dark:text-rose-400">{sells}</p>
          <p className="font-mono text-[10px] font-black uppercase tracking-widest text-rose-700">
            sells
          </p>
        </div>
      </div>
      <TugMeter
        leftPct={buyPct}
        segments={28}
        className="mt-3 h-3.5"
        label={`tape pressure: ${buys} buys vs ${sells} sells`}
      />
      <p className="mt-2 text-center font-mono text-[10px] font-bold uppercase tracking-widest text-(--raven-faint)">
        ▸ tape pressure // last {total} swaps
      </p>
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
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <SignalTag tone="emerald">buy / sell tape // live</SignalTag>
        <p className="font-mono text-[11px] font-bold text-(--raven-faint)">
          refresh in {countdown}s
        </p>
      </div>
      {loading ? (
        <WatchLoading tone="emerald" message="tuning the frequency" />
      ) : error ? (
        <p className="px-4 py-16 text-center font-mono text-sm font-bold text-rose-600 dark:text-rose-400">
          SCOPE DOWN — {error}
        </p>
      ) : entries.length === 0 ? (
        <EmptyScope
          tone="emerald"
          message="quiet skies"
          sub="no swaps in range"
        />
      ) : (
        <>
          <div className="px-4 pb-3">
            <PressurePanel entries={entries} />
          </div>
          <div className="border-t-2 border-(--raven-ink)/10">
            {entries.map((e) => (
              <TapeRow key={e.txHash} e={e} fresh={!seen.current.has(e.txHash)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
