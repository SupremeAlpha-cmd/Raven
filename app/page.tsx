"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TapeEntry } from "@/lib/tape";

const REFRESH_MS = 30_000;
const EXPLORER = "https://robinhoodchain.blockscout.com";

type Tab = "today" | "flow" | "wallets";

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

export default function Raven() {
  const [tab, setTab] = useState<Tab>("flow");
  const [entries, setEntries] = useState<TapeEntry[]>([]);
  const [latestBlock, setLatestBlock] = useState<number | null>(null);
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
      setLatestBlock(json.latestBlock ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load tape");
    } finally {
      setLoading(false);
      setCountdown(REFRESH_MS / 1000);
    }
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

  const tabs: { id: Tab; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "flow", label: "Flow" },
    { id: "wallets", label: "Wallets" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Raven</h1>
            <p className="text-xs text-zinc-500">Robinhood Chain · live terminal</p>
          </div>
          <div className="text-right font-mono text-[11px] text-zinc-500">
            <div className="flex items-center justify-end gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              live
            </div>
            {latestBlock !== null && <div>#{latestBlock.toLocaleString()}</div>}
          </div>
        </div>
        {/* Tabs */}
        <nav className="mx-auto flex max-w-3xl gap-1 px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-zinc-900 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl">
        {tab === "flow" && (
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
        )}

        {tab === "today" && (
          <div className="px-4 py-16 text-center">
            <p className="font-mono text-sm text-zinc-400">Today is coming.</p>
            <p className="mt-2 text-xs text-zinc-600">
              Graduation calendar — tokens nearing the line, ranked by velocity.
            </p>
          </div>
        )}

        {tab === "wallets" && (
          <div className="px-4 py-16 text-center">
            <p className="font-mono text-sm text-zinc-400">Wallets is coming.</p>
            <p className="mt-2 text-xs text-zinc-600">
              Smart-wallet signals — what the profitable wallets did today.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
