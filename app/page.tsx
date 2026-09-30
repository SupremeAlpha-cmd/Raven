"use client";

import { useState } from "react";
import FlowTape from "@/components/FlowTape";
import TodayView from "@/components/TodayView";
import WalletsView from "@/components/WalletsView";

type Tab = "today" | "flow" | "wallets";

export default function Raven() {
  const [tab, setTab] = useState<Tab>("flow");
  const [latestBlock, setLatestBlock] = useState<number | null>(null);

  const tabs: { id: Tab; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "flow", label: "Flow" },
    { id: "wallets", label: "Wallets" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Raven</h1>
            <p className="text-xs text-zinc-500">Robinhood Chain · live terminal</p>
          </div>
          <div className="text-right font-mono text-[11px] text-zinc-500">
            <div className="flex items-center justify-end gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              live
            </div>
            {latestBlock !== null && <div>#{latestBlock.toLocaleString()}</div>}
          </div>
        </div>
        {/* Tabs */}
        <nav className="mx-auto flex max-w-3xl gap-1 px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-zinc-900 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl">
        {tab === "flow" && <FlowTape onBlock={setLatestBlock} />}
        {tab === "today" && <TodayView />}
        {tab === "wallets" && <WalletsView onBlock={setLatestBlock} />}
      </main>
    </div>
  );
}
