"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useAlerts } from "./AlertsContext";
import { RULE_META, type AlertRuleType } from "@/lib/alerts";
import { SignalTag, EmptyScope } from "./raven-ui";

const typeSolid: Record<AlertRuleType, string> = {
  graduation: "bg-amber-500 text-white",
  whale: "bg-emerald-500 text-white",
  launch: "bg-violet-500 text-white",
};

const typeSc: Record<AlertRuleType, string> = {
  graduation: "#f59e0b",
  whale: "#10b981",
  launch: "#8b5cf6",
};

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={on ? "disable rule" : "enable rule"}
      className={`relative h-7 w-12 shrink-0 rounded-lg border-2 transition-colors ${
        on ? "border-rose-600 bg-rose-500" : "border-stone-300 bg-stone-200"
      }`}
    >
      <span
        className={`absolute top-[2px] h-[18px] w-[18px] rounded-md bg-white shadow transition-all ${
          on ? "left-[24px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}

export default function AlertsView() {
  const {
    rules,
    feed,
    notifPerm,
    addRule,
    removeRule,
    toggleRule,
    setThreshold,
    dismissAlert,
    clearFeed,
    requestPermission,
  } = useAlerts();

  const [newType, setNewType] = useState<AlertRuleType>("graduation");
  const [newThreshold, setNewThreshold] = useState(
    String(RULE_META.graduation.defaultThreshold),
  );

  const needsThreshold = RULE_META[newType].needsThreshold;

  return (
    <div className="px-4 pb-10">
      {/* Notification permission */}
      {notifPerm !== "granted" && notifPerm !== "unsupported" && (
        <div className="mt-4 border-2 border-rose-500 bg-rose-50 px-4 py-3.5 shadow-[4px_4px_0_rgba(244,63,94,0.15)]">
          <p className="font-mono text-[13px] font-black uppercase tracking-wide text-rose-700">
            ▸ want a tap on the shoulder?
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[13px] text-rose-800/80">
              Alerts live here. Get them as system notifications too.
            </p>
            <button
              onClick={requestPermission}
              className="shrink-0 rounded-lg bg-rose-500 px-5 py-2 text-[13px] font-black text-white transition-all hover:bg-rose-400 active:scale-[0.97]"
            >
              ENABLE
            </button>
          </div>
        </div>
      )}
      {notifPerm === "denied" && (
        <p className="mt-4 border border-stone-300 bg-white px-4 py-3 font-mono text-[12px] text-stone-500">
          System notifications are blocked for this site — alerts will still
          appear in the feed below. Re-enable them in your browser's site
          settings.
        </p>
      )}

      {/* Rules */}
      <div className="flex items-center justify-between px-1 pb-2 pt-5">
        <SignalTag tone="rose">alert rules // checked every minute</SignalTag>
      </div>

      <div className="space-y-2.5">
        {rules.map((r) => {
          const meta = RULE_META[r.type];
          return (
            <div
              key={r.id}
              className={`border-2 bg-white px-4 py-3 ${
                r.enabled
                  ? "scope-corners border-[#1c1917] shadow-[4px_4px_0_rgba(28,25,23,0.12)]"
                  : "border-stone-200 opacity-50"
              }`}
              style={
                r.enabled
                  ? ({ ["--sc" as string]: typeSc[r.type] } as CSSProperties)
                  : undefined
              }
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-black uppercase tracking-wide ${typeSolid[r.type]}`}
                >
                  {meta.label}
                </span>
                <div className="flex items-center gap-2">
                  <Toggle on={r.enabled} onClick={() => toggleRule(r.id)} />
                  <button
                    onClick={() => removeRule(r.id)}
                    aria-label="delete rule"
                    className="rounded-md px-2 py-1 font-mono text-[13px] font-bold text-stone-400 hover:text-rose-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {meta.needsThreshold && (
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="font-mono text-[12px] font-bold text-stone-500">
                    AT / ABOVE
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={r.threshold}
                    onChange={(e) =>
                      setThreshold(r.id, Number(e.target.value))
                    }
                    className="w-24 rounded-lg border-2 border-stone-300 bg-white px-2.5 py-1.5 font-mono text-[13px] font-bold text-[#1c1917] outline-none focus:border-rose-500"
                  />
                  <span className="font-mono text-[12px] text-stone-500">
                    {meta.unit}
                  </span>
                </div>
              )}
              <p className="mt-1.5 font-mono text-[11px] text-stone-500">
                {meta.hint}
              </p>
            </div>
          );
        })}
      </div>

      {/* Add rule */}
      <div className="mt-3 border-2 border-dashed border-stone-300 px-4 py-3.5">
        <SignalTag tone="stone">＋ new rule</SignalTag>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <select
            value={newType}
            onChange={(e) => {
              const t = e.target.value as AlertRuleType;
              setNewType(t);
              setNewThreshold(String(RULE_META[t].defaultThreshold));
            }}
            className="rounded-lg border-2 border-stone-300 bg-white px-2.5 py-1.5 font-mono text-[13px] font-bold text-[#1c1917] outline-none"
          >
            {(Object.keys(RULE_META) as AlertRuleType[]).map((t) => (
              <option key={t} value={t}>
                {RULE_META[t].label}
              </option>
            ))}
          </select>
          {needsThreshold && (
            <input
              type="number"
              min={1}
              value={newThreshold}
              onChange={(e) => setNewThreshold(e.target.value)}
              aria-label="threshold"
              className="w-24 rounded-lg border-2 border-stone-300 bg-white px-2.5 py-1.5 font-mono text-[13px] font-bold text-[#1c1917] outline-none focus:border-rose-500"
            />
          )}
          <button
            onClick={() => {
              addRule(newType, Number(newThreshold) || 1);
              setNewThreshold(String(RULE_META[newType].defaultThreshold));
            }}
            className="rounded-lg bg-rose-500 px-5 py-1.5 text-[13px] font-black text-white transition-all hover:bg-rose-400 active:scale-[0.97]"
          >
            ADD RULE
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="flex items-center justify-between px-1 pb-2 pt-6">
        <SignalTag tone="rose">fired alerts // newest first</SignalTag>
        {feed.length > 0 && (
          <button
            onClick={clearFeed}
            className="font-mono text-[11px] font-bold text-stone-400 hover:text-stone-600"
          >
            clear all
          </button>
        )}
      </div>
      {feed.length === 0 ? (
        <EmptyScope
          tone="rose"
          message="nothing fired yet"
          sub="rules are checked every minute while this tab is open"
        />
      ) : (
        <div className="space-y-2.5">
          {feed.map((a, i) => (
            <div
              key={a.id}
              className={`border-2 bg-white px-4 py-3 ${
                i === 0
                  ? "scope-corners border-[#1c1917] shadow-[4px_4px_0_rgba(28,25,23,0.12)]"
                  : "border-stone-200"
              }`}
              style={
                i === 0
                  ? ({ ["--sc" as string]: "#f43f5e" } as CSSProperties)
                  : undefined
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-black tracking-tight text-[#1c1917]">
                    {a.title}
                  </p>
                  <p className="mt-0.5 font-mono text-[12px] text-stone-500">
                    {a.detail}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3 font-mono text-[11px]">
                    <span className="font-bold text-stone-400">{timeAgo(a.firedAt)}</span>
                    {a.link && (
                      <a
                        href={a.link}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-rose-600 hover:text-rose-500"
                      >
                        view on explorer →
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => dismissAlert(a.id)}
                  aria-label="dismiss alert"
                  className="shrink-0 rounded-md px-2 py-1 font-mono text-[13px] font-bold text-stone-400 hover:text-stone-600"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="px-1 py-4 font-mono text-[11px] leading-relaxed text-stone-500">
        Rules live in this browser only — no account, nothing leaves your
        device.
      </p>
    </div>
  );
}
