"use client";

import Link from "next/link";
import { useState } from "react";
import FlowTape from "@/components/FlowTape";
import TodayView from "@/components/TodayView";
import WalletsView from "@/components/WalletsView";
import AlertsView from "@/components/AlertsView";
import { AlertsProvider, useAlerts } from "@/components/AlertsContext";
import { ThemeToggle } from "@/components/ThemeToggle";

type Tab = "today" | "flow" | "wallets" | "alerts";

const tabs: { id: Tab; label: string; active: string; sc: string }[] = [
  {
    id: "today",
    label: "Today",
    active: "bg-amber-500 text-white shadow-[2px_2px_0_rgba(var(--raven-shadow),0.25)]",
    sc: "#f59e0b",
  },
  {
    id: "flow",
    label: "Flow",
    active: "bg-emerald-500 text-white shadow-[2px_2px_0_rgba(var(--raven-shadow),0.25)]",
    sc: "#10b981",
  },
  {
    id: "wallets",
    label: "Wallets",
    active: "bg-violet-500 text-white shadow-[2px_2px_0_rgba(var(--raven-shadow),0.25)]",
    sc: "#8b5cf6",
  },
  {
    id: "alerts",
    label: "Alerts",
    active: "bg-rose-500 text-white shadow-[2px_2px_0_rgba(var(--raven-shadow),0.25)]",
    sc: "#f43f5e",
  },
];

function AlertBadge() {
  const { unread } = useAlerts();
  if (unread === 0) return null;
  return (
    <span className="ml-1 rounded-md bg-(--raven-card)/25 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
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

  const active = tabs.find((t) => t.id === tab)!;

  return (
    <div className="min-h-screen bg-(--raven-paper) text-(--raven-ink)">
      {/* Watch console header */}
      <header className="border-b-2 border-(--raven-ink) bg-(--raven-paper)">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span
              className="scope-corners inline-block p-[5px]"
              style={{ ["--sc" as string]: active.sc }}
            >
              <img
                src="/logo.png"
                alt="Raven"
                className="h-10 w-10 rounded-xl"
              />
            </span>
            <div>
              <h1 className="text-xl font-black tracking-tight">RAVEN</h1>
              <p className="font-mono text-[10px] font-bold text-(--raven-muted)">
                ROBINHOOD CHAIN // LIVE TERMINAL
              </p>
            </div>
          </Link>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span className="raven-live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-mono text-[12px] font-black text-emerald-600 dark:text-emerald-400">
                ◉ LIVE
              </span>
            </div>
            {latestBlock !== null && (
              <div className="mt-0.5 font-mono text-[11px] font-bold text-(--raven-muted)">
                BLK {latestBlock.toLocaleString()}
              </div>
            )}
            <div className="mt-2 flex justify-end">
              <ThemeToggle />
            </div>
          </div>
        </div>
        {/* Tabs */}
        <nav className="mx-auto max-w-3xl px-4 pb-3">
          <div className="flex gap-1.5 rounded-xl border-2 border-(--raven-ink) bg-(--raven-card) p-1.5 shadow-[3px_3px_0_rgba(var(--raven-shadow),0.12)]">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2.5 text-sm font-black transition-all active:scale-[0.97] ${
                  tab === t.id
                    ? t.active
                    : "text-(--raven-muted) hover:bg-(--raven-soft) hover:text-(--raven-ink)"
                }`}
              >
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
