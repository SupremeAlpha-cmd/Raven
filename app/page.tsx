import Link from "next/link";

const views = [
  {
    name: "Today",
    href: "/terminal",
    tag: "the graduation calendar",
    desc: "Every bonding curve on Pons, ranked by how close it is to the 8,090 USDG graduation line — and how fast it's moving.",
    accent: "amber" as const,
  },
  {
    name: "Flow",
    href: "/terminal",
    tag: "the live tape",
    desc: "Every buy and sell on the chain as it happens, on a 30-second tape. No noise, just flow.",
    accent: "emerald" as const,
  },
  {
    name: "Wallets",
    href: "/terminal",
    tag: "the money in motion",
    desc: "The most active wallets on Robinhood Chain, ranked by size. Watch where the money moves first.",
    accent: "violet" as const,
  },
];

const accentStyles = {
  amber: {
    tag: "text-amber-400",
    ring: "hover:border-amber-400/40",
    bar: "bg-amber-400",
    arrow: "group-hover:text-amber-300",
  },
  emerald: {
    tag: "text-emerald-400",
    ring: "hover:border-emerald-400/40",
    bar: "bg-emerald-400",
    arrow: "group-hover:text-emerald-300",
  },
  violet: {
    tag: "text-violet-400",
    ring: "hover:border-violet-400/40",
    bar: "bg-violet-400",
    arrow: "group-hover:text-violet-300",
  },
} as const;

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0b0d12] text-zinc-100">
      {/* Nav */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Raven" className="h-8 w-8" />
          <span className="text-lg font-bold tracking-tight">Raven</span>
        </div>
        <Link
          href="/terminal"
          className="rounded-full bg-zinc-100 px-5 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-white"
        >
          Open terminal
        </Link>
      </nav>

      {/* Hero */}
      <header className="mx-auto max-w-5xl px-5 pb-16 pt-14 text-center md:pt-20">
        <img
          src="/logo.png"
          alt="Raven eye"
          className="mx-auto h-24 w-24 md:h-28 md:w-28"
        />
        <h1 className="mx-auto mt-8 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          The tab that{" "}
          <span className="bg-gradient-to-r from-amber-300 via-emerald-300 to-violet-300 bg-clip-text text-transparent">
            never closes.
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-400 md:text-lg">
          Raven watches Robinhood Chain so you don&apos;t have to —
          graduations, live trade flow, and wallet signals in one terminal.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/terminal"
            className="w-full rounded-full bg-zinc-100 px-7 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-white sm:w-auto"
          >
            Open the terminal
          </Link>
          <a
            href="https://github.com/SupremeAlpha-cmd/Raven"
            target="_blank"
            rel="noreferrer"
            className="w-full rounded-full border border-white/15 px-7 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:border-white/30 hover:text-white sm:w-auto"
          >
            GitHub
          </a>
        </div>
        <p className="mt-6 font-mono text-[11px] text-zinc-500">
          no wallet · no signup · reads straight from public RPC
        </p>
      </header>

      {/* Views */}
      <section className="mx-auto max-w-5xl px-5 pb-16">
        <div className="grid gap-4 md:grid-cols-3">
          {views.map((v) => {
            const a = accentStyles[v.accent];
            return (
              <Link
                key={v.name}
                href={v.href}
                className={`group rounded-2xl border border-white/10 bg-[#12151d] p-6 transition-all hover:-translate-y-0.5 hover:bg-[#171b25] ${a.ring}`}
              >
                <div className={`h-1 w-10 rounded-full ${a.bar}`} />
                <p
                  className={`mt-4 font-mono text-[11px] uppercase tracking-wider ${a.tag}`}
                >
                  {v.tag}
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">
                  {v.name}
                </h2>
                <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
                  {v.desc}
                </p>
                <p
                  className={`mt-5 text-sm font-semibold text-zinc-500 transition-colors ${a.arrow}`}
                >
                  Open {v.name.toLowerCase()} →
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <h2 className="text-xl font-bold tracking-tight">
            Straight from the chain
          </h2>
          <div className="mt-8 grid gap-8 text-sm leading-relaxed text-zinc-400 md:grid-cols-3">
            <div>
              <p className="font-mono text-[12px] font-semibold text-amber-300">
                01 — Index
              </p>
              <p className="mt-2">
                Raven reads Pons factory events and router swaps directly
                from Robinhood Chain&apos;s public RPC. No middlemen, no
                stale APIs.
              </p>
            </div>
            <div>
              <p className="font-mono text-[12px] font-semibold text-emerald-300">
                02 — Verify
              </p>
              <p className="mt-2">
                Graduation progress is computed from on-chain buys minus
                sells — the same math the curve uses. Nothing guessed.
              </p>
            </div>
            <div>
              <p className="font-mono text-[12px] font-semibold text-violet-300">
                03 — Watch
              </p>
              <p className="mt-2">
                The tape polls every 30 seconds. Keep the tab open and the
                chain comes to you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-5 py-8 text-center md:flex-row md:text-left">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Raven" className="h-5 w-5" />
            <span className="text-sm font-semibold">Raven</span>
          </div>
          <p className="font-mono text-[11px] text-zinc-500">
            built on Robinhood Chain · data from public RPC
          </p>
        </div>
      </footer>
    </div>
  );
}
