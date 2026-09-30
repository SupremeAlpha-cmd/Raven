"use client";

import { useCallback, useEffect, useState } from "react";
import type { WalletStats } from "@/lib/wallets";

const EXPLORER = "https://robinhoodchain.blockscout.com";

function formatVolume(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(2) + "K";
  if (v === 0) return "0";
  return v >= 100 ? v.toFixed(1) : v.toFixed(4);
}

function shortAddr(a: string): string {
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function WalletsView({
  onBlock,
}: {
  onBlock: (b: number | null) => void;
}) {
  const [wallets, setWallets] = useState<WalletStats[]>([]);
  const [tradersSeen, setTradersSeen] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/wallets", { cache: "no-store" });
      if (!res.ok) throw new Error(`wallets ${res.status}`);
      const json = await res.json();
      setWallets(json.wallets ?? []);
      setTradersSeen(json.tradersSeen ?? 0);
      onBlock(json.latestBlock ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load wallets");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          most active wallets
        </p>
        <p className="font-mono text-[11px] text-zinc-600">
          {tradersSeen} traders tracked
        </p>
      </div>
      {loading ? (
        <p className="px-4 py-8 text-center font-mono text-sm text-zinc-500">
          reading the room…
        </p>
      ) : error ? (
        <p className="px-4 py-8 text-center font-mono text-sm text-red-400">
          {error}
        </p>
      ) : wallets.length === 0 ? (
        <p className="px-4 py-8 text-center font-mono text-sm text-zinc-500">
          no wallets in range
        </p>
      ) : (
        <div className="border-t border-zinc-800/60">
          {wallets.map((w, i) => (
            <a
              key={w.address}
              href={`${EXPLORER}/address/${w.address}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 border-b border-zinc-800/60 px-4 py-2.5 transition-colors hover:bg-zinc-900/60"
            >
              <span className="w-6 shrink-0 font-mono text-[11px] text-zinc-600">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[13px] text-zinc-100">
                  {shortAddr(w.address)}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-zinc-500">
                  {w.trades} trades · {w.buys}B / {w.sells}S · {w.topToken} ·
                  active {timeAgo(w.lastActive)}
                </div>
              </div>
              <div className="shrink-0 font-mono text-[13px] text-zinc-200">
                {formatVolume(w.quoteVolume)}
              </div>
            </a>
          ))}
        </div>
      )}
      <p className="px-4 py-4 font-mono text-[11px] leading-relaxed text-zinc-600">
        Ranked by activity (quote-denominated volume), not profitability. PnL
        tracking comes later.
      </p>
    </div>
  );
}
