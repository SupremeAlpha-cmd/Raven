"use client";

import { useCallback, useEffect, useState } from "react";
import type { WalletStats } from "@/lib/wallets";
import { SignalTag, WatchLoading, EmptyScope } from "./raven-ui";

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

/** Segmented buy/sell split meter for a wallet. */
function SplitMeter({ buys, sells }: { buys: number; sells: number }) {
  const total = buys + sells;
  const buyPct = total === 0 ? 50 : (buys / total) * 100;
  const n = Math.round((buyPct / 100) * 12);
  return (
    <div
      className="flex gap-[2px]"
      role="img"
      aria-label={`${buys} buys, ${sells} sells`}
    >
      {Array.from({ length: 12 }, (_, i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-[2px] ${i < n ? "bg-emerald-500" : "bg-rose-500"}`}
        />
      ))}
    </div>
  );
}

function WalletRow({ w, rank }: { w: WalletStats; rank: number }) {
  const top3 = rank < 3;
  return (
    <a
      href={`${EXPLORER}/address/${w.address}`}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-3 border-b border-stone-200/70 px-4 py-3 transition-colors ${
        top3 ? "bg-violet-50/60 hover:bg-violet-50" : "hover:bg-stone-50"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[13px] font-black ${
          top3 ? "bg-violet-500 text-white" : "bg-stone-200/70 text-stone-500"
        }`}
      >
        {rank + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-[14px] font-black text-[#1c1917]">
            {shortAddr(w.address)}
          </span>
          {top3 && (
            <span className="shrink-0 rounded-md bg-violet-500 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-white">
              top 3
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-2.5">
          <SplitMeter buys={w.buys} sells={w.sells} />
          <span className="truncate font-mono text-[11px] text-stone-500">
            {w.trades} trades ·{" "}
            <span className="font-bold text-emerald-600">{w.buys}B</span> /{" "}
            <span className="font-bold text-rose-600">{w.sells}S</span> · {w.topToken} ·{" "}
            {timeAgo(w.lastActive)}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div
          className={`font-mono font-black ${
            top3 ? "text-xl text-violet-700" : "text-[15px] text-[#1c1917]"
          }`}
        >
          {formatVolume(w.quoteVolume)}
        </div>
        <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-stone-400">
          volume
        </div>
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
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <SignalTag tone="violet">most active wallets // tracked live</SignalTag>
        <p className="font-mono text-[11px] font-bold text-violet-700">
          {tradersSeen} traders
        </p>
      </div>
      {loading ? (
        <WatchLoading tone="violet" message="reading the room" />
      ) : error ? (
        <p className="px-4 py-16 text-center font-mono text-sm font-bold text-rose-600">
          SCOPE DOWN — {error}
        </p>
      ) : wallets.length === 0 ? (
        <EmptyScope
          tone="violet"
          message="no wallets on the scope"
          sub="no wallets in range"
        />
      ) : (
        <div className="border-t-2 border-[#1c1917]/10">
          {wallets.map((w, i) => (
            <WalletRow key={w.address} w={w} rank={i} />
          ))}
        </div>
      )}
      <p className="px-4 py-4 font-mono text-[11px] leading-relaxed text-stone-500">
        Ranked by activity (quote-denominated volume), not profitability. PnL
        tracking comes later.
      </p>
    </div>
  );
}
