"use client";

import Link from "next/link";
import { useState } from "react";
import FlowTape from "@/components/FlowTape";
import TodayView from "@/components/TodayView";
import WalletsView from "@/components/WalletsView";

type Tab = "today" | "flow" | "wallets";

const tabs: { id: Tab; label: string; active: string; dot: string }[] = [
  {
    id: "today",
    label: "Today",
    active: "bg-amber-400/15 text-amber-200",
    dot: "bg-amber-400",
  },
  {
    id: "flow",
    label: "Flow",
    active: "bg-emerald-400/15 text-emerald-200",
    dot: "bg-emerald-400",
  },
  {
    id: "wallets",
    label: "Wallets",
    active: "bg-violet-400/15 text-violet-200",
    dot: "bg-violet-400",
  },
];

export default function Raven() {
  const [tab, setTab] = useState<Tab>("flow");
  const [latestBlock, setLatestBlock] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#0b0d12] text-zinc-100">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Raven" className="h-9 w-9" />
            <div>
              <h1 className="text-lg font-bold tracking-tight">Raven</h1>
              <p className="text-[11px] text-zinc-500">
                Robinhood Chain · live terminal
              </p>
            </div>
          </Link>
          <div className="text-right font-mono text-[11px] text-zinc-500">
            <div className="flex items-center justify-end gap-1.5">
              <span className="raven-live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-300">live</span>
            </div>
            {latestBlock !== null && (
              <div className="mt-0.5">#{latestBlock.toLocaleString()}</div>
            )}
          </div>
        </div>
        {/* Tabs */}
        <nav className="mx-auto max-w-3xl px-4 pb-3">
          <div className="flex gap-1.5 rounded-full bg-white/5 p-1.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === t.id
                    ? t.active
                    : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    tab === t.id ? t.dot : "bg-zinc-700"
                  }`}
                />
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl pb-10">
        {tab === "flow" && <FlowTape onBlock={setLatestBlock} />}
        {tab === "today" && <TodayView />}
        {tab === "wallets" && <WalletsView onBlock={setLatestBlock} />}
      </main>
    </div>
  );
}
