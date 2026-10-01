"use client";

import Link from "next/link";
import { useState } from "react";
import FlowTape from "@/components/FlowTape";
import TodayView from "@/components/TodayView";
import WalletsView from "@/components/WalletsView";
import AlertsView from "@/components/AlertsView";
import { AlertsProvider, useAlerts } from "@/components/AlertsContext";

type Tab = "today" | "flow" | "wallets" | "alerts";

const tabs: { id: Tab; label: string; active: string; dot: string }[] = [
  {
    id: "today",
    label: "Today",
    active: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
  },
  {
    id: "flow",
    label: "Flow",
    active: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
  },
  {
    id: "wallets",
    label: "Wallets",
    active: "bg-violet-100 text-violet-800",
    dot: "bg-violet-500",
  },
  {
    id: "alerts",
    label: "Alerts",
    active: "bg-rose-100 text-rose-800",
    dot: "bg-rose-500",
  },
];

function AlertBadge() {
  const { unread } = useAlerts();
  if (unread === 0) return null;
  return (
    <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
      {unread > 99 ? "99+" : unread}
    </span>
  );
}

function Terminal() {
  const [tab, setTab] = useState<Tab>("flow");
  const [latestBlock, setLatestBlock] = useState<number | null>(null);
  const { markRead } = useAlerts();

  const selectTab = (id: Tab) => {
    setTab(id);
    if (id === "alerts") markRead();
  };

  return (
    <div className="min-h-screen bg-[#fffdf7] text-[#1c1917]">
      {/* Header */}
      <header className="border-b border-stone-200/70 bg-[#fffdf7]/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Raven"
              className="h-9 w-9 rounded-[10px]"
            />
            <div>
              <h1 className="text-lg font-bold tracking-tight">Raven</h1>
              <p className="text-[11px] text-stone-500">
                Robinhood Chain · live terminal
              </p>
            </div>
          </Link>
          <div className="text-right font-mono text-[11px] text-stone-500">
            <div className="flex items-center justify-end gap-1.5">
              <span className="raven-live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-bold text-emerald-600">live</span>
            </div>
            {latestBlock !== null && (
              <div className="mt-0.5">#{latestBlock.toLocaleString()}</div>
            )}
          </div>
        </div>
        {/* Tabs */}
        <nav className="mx-auto max-w-3xl px-4 pb-3">
          <div className="flex gap-1.5 rounded-full border border-stone-200/70 bg-white p-1.5 shadow-[0_2px_12px_rgba(28,25,23,0.06)]">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === t.id
                    ? t.active
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    tab === t.id ? t.dot : "bg-stone-300"
                  }`}
                />
                {t.label}
                {t.id === "alerts" && <AlertBadge />}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl pb-10">
        {tab === "flow" && <FlowTape onBlock={setLatestBlock} />}
        {tab === "today" && <TodayView />}
        {tab === "wallets" && <WalletsView onBlock={setLatestBlock} />}
        {tab === "alerts" && <AlertsView />}
      </main>
    </div>
  );
}

export default function Raven() {
  return (
    <AlertsProvider>
      <Terminal />
    </AlertsProvider>
  );
}
