"use client";

import { useState } from "react";
import { useAlerts } from "./AlertsContext";
import { RULE_META, type AlertRuleType } from "@/lib/alerts";

const typeAccent: Record<AlertRuleType, string> = {
  graduation: "bg-amber-400/15 text-amber-300 border-amber-400/25",
  whale: "bg-emerald-400/15 text-emerald-300 border-emerald-400/25",
  launch: "bg-violet-400/15 text-violet-300 border-violet-400/25",
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
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        on ? "bg-rose-400" : "bg-white/10"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
          on ? "left-[22px]" : "left-0.5"
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
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/5 px-4 py-3">
          <p className="text-[13px] text-zinc-300">
            Alerts live here. Want them as system notifications too?
          </p>
          <button
            onClick={requestPermission}
            className="shrink-0 rounded-full bg-rose-400 px-4 py-1.5 text-[13px] font-bold text-[#0b0d12]"
          >
            Enable
          </button>
        </div>
      )}
      {notifPerm === "denied" && (
        <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[12px] text-zinc-500">
          System notifications are blocked for this site — alerts will still
          appear in the feed below. Re-enable them in your browser's site
          settings.
        </p>
      )}

      {/* Rules */}
      <div className="flex items-center justify-between pb-1 pt-5">
        <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          alert rules
        </p>
        <p className="font-mono text-[11px] text-zinc-600">
          checked every minute
        </p>
      </div>

      <div className="space-y-2">
        {rules.map((r) => {
          const meta = RULE_META[r.type];
          return (
            <div
              key={r.id}
              className={`rounded-2xl border border-white/10 bg-[#12151d] px-4 py-3 ${
                r.enabled ? "" : "opacity-50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase ${typeAccent[r.type]}`}
                >
                  {meta.label}
                </span>
                <div className="flex items-center gap-2">
                  <Toggle on={r.enabled} onClick={() => toggleRule(r.id)} />
                  <button
                    onClick={() => removeRule(r.id)}
                    aria-label="delete rule"
                    className="rounded-full px-2 py-1 font-mono text-[13px] text-zinc-600 hover:text-rose-300"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {meta.needsThreshold && (
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="font-mono text-[12px] text-zinc-500">
                    at / above
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={r.threshold}
                    onChange={(e) =>
                      setThreshold(r.id, Number(e.target.value))
                    }
                    className="w-24 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[13px] text-zinc-100 outline-none focus:border-rose-400/50"
                  />
                  <span className="font-mono text-[12px] text-zinc-500">
                    {meta.unit}
                  </span>
                </div>
              )}
              <p className="mt-1.5 font-mono text-[11px] text-zinc-600">
                {meta.hint}
              </p>
            </div>
          );
        })}
      </div>

      {/* Add rule */}
      <div className="mt-3 rounded-2xl border border-dashed border-white/15 px-4 py-3">
        <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          new rule
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <select
            value={newType}
            onChange={(e) => {
              const t = e.target.value as AlertRuleType;
              setNewType(t);
              setNewThreshold(String(RULE_META[t].defaultThreshold));
            }}
            className="rounded-lg border border-white/10 bg-[#12151d] px-2.5 py-1.5 font-mono text-[13px] text-zinc-100 outline-none"
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
              className="w-24 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[13px] text-zinc-100 outline-none focus:border-rose-400/50"
            />
          )}
          <button
            onClick={() => {
              addRule(newType, Number(newThreshold) || 1);
              setNewThreshold(String(RULE_META[newType].defaultThreshold));
            }}
            className="rounded-full bg-rose-400 px-4 py-1.5 text-[13px] font-bold text-[#0b0d12]"
          >
            Add rule
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="flex items-center justify-between pb-1 pt-6">
        <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          fired alerts
        </p>
        {feed.length > 0 && (
          <button
            onClick={clearFeed}
            className="font-mono text-[11px] text-zinc-600 hover:text-zinc-300"
          >
            clear all
          </button>
        )}
      </div>
      {feed.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-[#12151d] px-4 py-8 text-center font-mono text-sm text-zinc-500">
          nothing fired yet — rules are checked every minute while this tab is
          open
        </p>
      ) : (
        <div className="space-y-2">
          {feed.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-white/10 bg-[#12151d] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-zinc-100">
                    {a.title}
                  </p>
                  <p className="mt-0.5 font-mono text-[12px] text-zinc-500">
                    {a.detail}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-zinc-600">{timeAgo(a.firedAt)}</span>
                    {a.link && (
                      <a
                        href={a.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-rose-300/90 hover:text-rose-200"
                      >
                        view on explorer →
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => dismissAlert(a.id)}
                  aria-label="dismiss alert"
                  className="shrink-0 rounded-full px-2 py-1 font-mono text-[13px] text-zinc-600 hover:text-zinc-300"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="px-1 py-4 font-mono text-[11px] leading-relaxed text-zinc-600">
        Rules live in this browser only — no account, nothing leaves your
        device.
      </p>
    </div>
  );
}
