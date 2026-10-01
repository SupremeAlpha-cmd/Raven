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

const rankColor = ["text-amber-300", "text-zinc-300", "text-orange-400"];

function WalletRow({ w, rank }: { w: WalletStats; rank: number }) {
  const total = w.buys + w.sells;
  const buyPct = total === 0 ? 50 : (w.buys / total) * 100;
  return (
    <a
      key={w.address}
      href={`${EXPLORER}/address/${w.address}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 border-b border-white/5 px-4 py-3 transition-colors hover:bg-white/[0.03]"
    >
      <span
        className={`w-6 shrink-0 font-mono text-[12px] font-bold ${
          rankColor[rank] ?? "text-zinc-600"
        }`}
      >
        {rank + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[13px] font-semibold text-zinc-100">
          {shortAddr(w.address)}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="flex h-1 w-16 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full bg-emerald-400"
              style={{ width: `${buyPct}%` }}
            />
            <div className="h-full bg-rose-400" style={{ width: `${100 - buyPct}%` }} />
          </div>
          <span className="font-mono text-[11px] text-zinc-500">
            {w.trades} trades ·{" "}
            <span className="text-emerald-300/90">{w.buys}B</span> /{" "}
            <span className="text-rose-300/90">{w.sells}S</span> · {w.topToken} ·{" "}
            {timeAgo(w.lastActive)}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-[13px] font-bold text-violet-200">
          {formatVolume(w.quoteVolume)}
        </div>
        <div className="font-mono text-[10px] text-zinc-600">volume</div>
      </div>
    </a>
  );
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
        <p className="font-mono text-[11px] text-violet-300/80">
          {tradersSeen} traders tracked
        </p>
      </div>
      {loading ? (
        <p className="px-4 py-8 text-center font-mono text-sm text-zinc-500">
          reading the room…
        </p>
      ) : error ? (
        <p className="px-4 py-8 text-center font-mono text-sm text-rose-300">
          {error}
        </p>
      ) : wallets.length === 0 ? (
        <p className="px-4 py-8 text-center font-mono text-sm text-zinc-500">
          no wallets in range
        </p>
      ) : (
        <div className="border-t border-white/5">
          {wallets.map((w, i) => (
            <WalletRow key={w.address} w={w} rank={i} />
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
