"use client";

import { useCallback, useEffect, useState } from "react";
import type { Graduation, NearGraduation } from "@/lib/graduation";
import { SignalTag, Meter, WatchLoading, EmptyScope } from "./raven-ui";

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
function heat(pct: number): { filled: string; text: string; sc: string } {
  if (pct >= 90)
    return { filled: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", sc: "#f43f5e" };
  if (pct >= 70)
    return { filled: "bg-orange-500", text: "text-orange-600", sc: "#f97316" };
  if (pct >= 50)
    return { filled: "bg-amber-500", text: "text-amber-700", sc: "#f59e0b" };
  return { filled: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", sc: "#10b981" };
}

function ImminentTag() {
  return (
    <span className="raven-blink inline-flex items-center gap-1.5 rounded-md bg-rose-500 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-white">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-(--raven-card)" />
      graduation imminent
    </span>
  );
}

/** The #1 token — in the crosshairs. */
function CrosshairCard({ t }: { t: NearGraduation }) {
  const pct = Math.min(100, t.progress * 100);
  const h = heat(pct);
  return (
    <a
      href={`${EXPLORER}/token/${t.token}`}
      target="_blank"
      rel="noreferrer"
      className="scope-corners block border-2 border-(--raven-ink) bg-(--raven-card) p-4 shadow-[4px_4px_0_rgba(var(--raven-shadow),0.12)] transition-transform active:scale-[0.99]"
      style={{ ["--sc" as string]: h.sc }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] font-black uppercase tracking-widest text-(--raven-muted)">
          ▸ in the crosshairs
        </p>
        {pct >= 90 && <ImminentTag />}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="truncate font-mono text-2xl font-black tracking-tight text-(--raven-ink)">
          ${t.symbol}
        </span>
        <span className={`shrink-0 font-mono text-3xl font-black ${h.text}`}>
          {pct.toFixed(0)}
          <span className="text-lg">%</span>
        </span>
      </div>
      <Meter
        pct={pct}
        segments={28}
        filled={h.filled}
        className="mt-3 h-4"
        label={`${t.symbol} graduation progress ${pct.toFixed(1)} percent`}
      />
      <div className="mt-2.5 flex justify-between font-mono text-[11px] font-bold text-(--raven-muted)">
        <span>
          {fmt(t.raised)} / {fmt(t.threshold)} USDG
        </span>
        <span>
          24h <span className="text-(--raven-ink)">+{fmt(t.velocity24h)}</span> velocity
        </span>
      </div>
    </a>
  );
}

function NearRow({ t, rank }: { t: NearGraduation; rank: number }) {
  const pct = Math.min(100, t.progress * 100);
  const h = heat(pct);
  return (
    <a
      href={`${EXPLORER}/token/${t.token}`}
      target="_blank"
      rel="noreferrer"
      className="flex gap-3 border-b border-(--raven-line)/70 px-4 py-3.5 transition-colors hover:bg-amber-500/10"
    >
      <span className="w-7 shrink-0 pt-0.5 text-center font-mono text-[13px] font-black text-(--raven-faint)">
        {rank + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[15px] font-black text-(--raven-ink)">
            ${t.symbol}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {pct >= 90 && <ImminentTag />}
            <span className={`font-mono text-[14px] font-black ${h.text}`}>
              {pct.toFixed(1)}%
            </span>
          </span>
        </div>
        <Meter
          pct={pct}
          segments={24}
          filled={h.filled}
          className="mt-2 h-2.5"
          label={`${t.symbol} graduation progress ${pct.toFixed(1)} percent`}
        />
        <div className="mt-1.5 flex justify-between font-mono text-[11px] text-(--raven-muted)">
          <span>
            {fmt(t.raised)} / {fmt(t.threshold)} USDG
          </span>
          <span>
            24h <span className="font-bold text-(--raven-muted)">+{fmt(t.velocity24h)}</span>
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
      className="flex items-center justify-between gap-3 border-b border-(--raven-line)/70 px-4 py-2.5 transition-colors hover:bg-emerald-500/10"
    >
      <span className="flex items-center gap-2">
        <span className="rounded-md bg-emerald-500 px-1.5 py-0.5 font-mono text-[10px] font-black text-white">
          ✓
        </span>
        <span className="font-mono text-[13px] font-black text-(--raven-ink)">
          ${g.symbol}
        </span>
      </span>
      <span className="shrink-0 font-mono text-[11px] text-(--raven-muted)">
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
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/today", { cache: "no-store" });
      if (!res.ok) throw new Error(`today ${res.status}`);
      const json = await res.json();
      setNearing(json.nearing ?? []);
      setGraduated(json.graduated ?? []);
      setStale(json.stale === true);
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

  if (loading) return <WatchLoading tone="amber" message="scanning the curves" />;
  if (error) {
    return (
      <p className="px-4 py-16 text-center font-mono text-sm font-bold text-rose-600 dark:text-rose-400">
        SCOPE DOWN — {error}
      </p>
    );
  }

  const [leader, ...rest] = nearing;

  return (
    <div>
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <SignalTag tone="amber">nearing graduation // ranked by velocity</SignalTag>
        {stale && (
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-(--raven-faint)">
            cached
          </span>
        )}
      </div>
      {nearing.length === 0 ? (
        <EmptyScope
          tone="amber"
          message="nothing on the scope"
          sub="no active curves in range"
        />
      ) : (
        <>
          <div className="px-4 pb-2">
            <CrosshairCard t={leader} />
          </div>
          {rest.length > 0 && (
            <div className="border-t-2 border-(--raven-ink)/10">
              {rest.map((t, i) => (
                <NearRow key={t.token} t={t} rank={i + 1} />
              ))}
            </div>
          )}
        </>
      )}

      <div className="px-4 pb-2 pt-6">
        <SignalTag tone="emerald">graduated // seeded on-chain</SignalTag>
      </div>
      {graduated.length === 0 ? (
        <p className="px-4 py-4 font-mono text-[12px] text-(--raven-faint)">
          no graduations in range
        </p>
      ) : (
        <div className="border-t border-(--raven-line)/70">
          {graduated.map((g) => (
            <GradRow key={g.token + g.blockNumber} g={g} />
          ))}
        </div>
      )}
      <p className="px-4 py-4 font-mono text-[11px] leading-relaxed text-(--raven-muted)">
        Graduation = 8,090 USDG net raised on the bonding curve. Progress is
        computed from on-chain buys and sells.
      </p>
    </div>
  );
}
