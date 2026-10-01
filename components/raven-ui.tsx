"use client";

import type { ReactNode } from "react";

export type Tone = "amber" | "emerald" | "violet" | "rose" | "stone";

const toneText: Record<Tone, string> = {
  amber: "text-amber-700",
  emerald: "text-emerald-700",
  violet: "text-violet-700",
  rose: "text-rose-700",
  stone: "text-stone-500",
};

const toneSolid: Record<Tone, string> = {
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
  stone: "bg-stone-400",
};

/** Mono signal tag — Raven's section header. Replaces soft eyebrows. */
export function SignalTag({
  tone,
  children,
  className = "",
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`font-mono text-[12px] font-bold ${toneText[tone]} ${className}`}>
      <span aria-hidden="true" className="mr-1.5">
        ▸
      </span>
      {children}
    </p>
  );
}

/** Segmented signal meter — blocky radio-style readout, not a soft bar. */
export function Meter({
  pct,
  segments = 24,
  filled,
  track = "bg-stone-200/80",
  className = "",
  label,
}: {
  pct: number;
  segments?: number;
  filled: string;
  track?: string;
  className?: string;
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const n = Math.round((clamped / 100) * segments);
  return (
    <div
      className={`flex gap-[3px] ${className}`}
      role="img"
      aria-label={label ?? `${clamped.toFixed(0)} percent`}
    >
      {Array.from({ length: segments }, (_, i) => (
        <div
          key={i}
          className={`min-w-0 flex-1 rounded-[2px] ${i < n ? filled : track}`}
        />
      ))}
    </div>
  );
}

/** Two-sided tug-of-war meter: emerald pushes from the left, rose from the right. */
export function TugMeter({
  leftPct,
  segments = 28,
  className = "",
  label,
}: {
  leftPct: number;
  segments?: number;
  className?: string;
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, leftPct));
  const n = Math.round((clamped / 100) * segments);
  return (
    <div
      className={`flex gap-[3px] ${className}`}
      role="img"
      aria-label={label ?? `buy pressure ${clamped.toFixed(0)} percent`}
    >
      {Array.from({ length: segments }, (_, i) => (
        <div
          key={i}
          className={`min-w-0 flex-1 rounded-[2px] ${
            i < n ? "bg-emerald-500" : "bg-rose-500"
          }`}
        />
      ))}
    </div>
  );
}

/** Expressive loading state — the watch is scanning. */
export function WatchLoading({
  tone,
  message,
}: {
  tone: Tone;
  message: string;
}) {
  return (
    <div className="px-4 py-16 text-center">
      <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
        <span className={`raven-loading-dot h-2 w-2 rounded-full ${toneSolid[tone]}`} />
        <span className={`raven-loading-dot h-2 w-2 rounded-full ${toneSolid[tone]}`} />
        <span className={`raven-loading-dot h-2 w-2 rounded-full ${toneSolid[tone]}`} />
      </div>
      <p className={`mt-4 font-mono text-[13px] font-bold uppercase tracking-widest ${toneText[tone]}`}>
        {message}
      </p>
    </div>
  );
}

/** Expressive empty state — nothing on the scope. */
export function EmptyScope({
  tone,
  message,
  sub,
}: {
  tone: Tone;
  message: string;
  sub?: string;
}) {
  const sc =
    tone === "amber"
      ? "#f59e0b"
      : tone === "emerald"
        ? "#10b981"
        : tone === "violet"
          ? "#8b5cf6"
          : tone === "rose"
            ? "#f43f5e"
            : "#a8a29e";
  return (
    <div className="px-4 py-10">
      <div
        className="scope-corners mx-auto max-w-xs px-8 py-10 text-center"
        style={{ ["--sc" as string]: sc }}
      >
        <p className={`font-mono text-[13px] font-bold uppercase tracking-widest ${toneText[tone]}`}>
          {message}
        </p>
        {sub && (
          <p className="mt-2 font-mono text-[11px] text-stone-500">{sub}</p>
        )}
      </div>
    </div>
  );
}
