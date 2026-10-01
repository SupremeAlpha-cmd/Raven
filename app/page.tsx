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
  {
    name: "Alerts",
    href: "/terminal",
    tag: "the tap on the shoulder",
    desc: "Graduation crossings, whale trades, new launches — your rules, checked every minute while the tab is open.",
    accent: "rose" as const,
  },
];

const accentStyles = {
  amber: {
    tag: "text-amber-700",
    ring: "hover:border-amber-300",
    bar: "bg-amber-400",
    arrow: "group-hover:text-amber-600",
  },
  emerald: {
    tag: "text-emerald-700",
    ring: "hover:border-emerald-300",
    bar: "bg-emerald-400",
    arrow: "group-hover:text-emerald-600",
  },
  violet: {
    tag: "text-violet-700",
    ring: "hover:border-violet-300",
    bar: "bg-violet-400",
    arrow: "group-hover:text-violet-600",
  },
  rose: {
    tag: "text-rose-700",
    ring: "hover:border-rose-300",
    bar: "bg-rose-400",
    arrow: "group-hover:text-rose-600",
  },
} as const;

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#fffdf7] text-[#1c1917]">
      {/* Nav */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Raven"
            className="h-8 w-8 rounded-[10px]"
          />
          <span className="text-lg font-bold tracking-tight">Raven</span>
        </div>
        <Link
          href="/terminal"
          className="rounded-full bg-[#1c1917] px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-stone-800 active:scale-[0.98]"
        >
          Open terminal
        </Link>
      </nav>

      {/* Hero */}
      <header className="mx-auto max-w-5xl px-5 pb-16 pt-10 text-center md:pt-16">
        <div className="inline-block -rotate-3 rounded-[2rem] bg-[#0b0d12] p-5 shadow-[0_8px_24px_rgba(28,25,23,0.25)]">
          <img
            src="/logo.png"
            alt="Raven eye"
            className="h-24 w-24 rounded-[1.4rem] md:h-28 md:w-28"
          />
        </div>
        <p className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-100/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
          Robinhood Chain · live terminal
        </p>
        <h1 className="mx-auto mt-5 max-w-3xl text-5xl font-bold leading-[1.02] tracking-tighter md:text-6xl">
          The tab that{" "}
          <span className="bg-gradient-to-r from-amber-500 via-emerald-500 to-violet-500 bg-clip-text text-transparent">
            never closes.
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-stone-600 md:text-lg">
          Raven watches Robinhood Chain so you don&apos;t have to —
          graduations, live trade flow, and wallet signals in one terminal.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/terminal"
            className="w-full rounded-2xl bg-amber-400 px-7 py-3.5 text-[15px] font-bold text-[#1c1917] shadow-[0_4px_16px_rgba(251,191,36,0.35)] transition-all hover:bg-amber-300 active:scale-[0.98] sm:w-auto"
          >
            Open the terminal
          </Link>
          <a
            href="https://github.com/SupremeAlpha-cmd/Raven"
            target="_blank"
            rel="noreferrer"
            className="w-full rounded-2xl border border-stone-300 bg-white px-7 py-3.5 text-[15px] font-semibold text-stone-600 transition-colors hover:border-amber-400 hover:text-amber-700 sm:w-auto"
          >
            GitHub
          </a>
        </div>
        <p className="mt-6 font-mono text-[11px] text-stone-500">
          no wallet · no signup · reads straight from public RPC
        </p>
      </header>

      {/* Views */}
      <section className="mx-auto max-w-5xl px-5 pb-16">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {views.map((v) => {
            const a = accentStyles[v.accent];
            return (
              <Link
                key={v.name}
                href={v.href}
                className={`group rounded-3xl border border-stone-200/80 bg-white p-6 shadow-[0_2px_16px_rgba(28,25,23,0.05)] transition-all hover:-translate-y-0.5 ${a.ring}`}
              >
                <div className={`h-1.5 w-10 rounded-full ${a.bar}`} />
                <p
                  className={`mt-4 font-mono text-[11px] uppercase tracking-wider ${a.tag}`}
                >
                  {v.tag}
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">
                  {v.name}
                </h2>
                <p className="mt-2.5 text-sm leading-relaxed text-stone-600">
                  {v.desc}
                </p>
                <p
                  className={`mt-5 text-sm font-semibold text-stone-400 transition-colors ${a.arrow}`}
                >
                  Open {v.name.toLowerCase()} →
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-stone-200/70 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
            How it works
          </p>
          <h2 className="mt-4 text-center text-3xl font-bold tracking-tighter">
            Straight from the chain.
          </h2>
          <div className="mt-10 grid gap-8 text-sm leading-relaxed text-stone-600 md:grid-cols-3">
            <div>
              <p className="font-mono text-[12px] font-semibold text-amber-700">
                01 — Index
              </p>
              <p className="mt-2">
                Raven reads Pons factory events and router swaps directly
                from Robinhood Chain&apos;s public RPC. No middlemen, no
                stale APIs.
              </p>
            </div>
            <div>
              <p className="font-mono text-[12px] font-semibold text-emerald-700">
                02 — Verify
              </p>
              <p className="mt-2">
                Graduation progress is computed from on-chain buys minus
                sells — the same math the curve uses. Nothing guessed.
              </p>
            </div>
            <div>
              <p className="font-mono text-[12px] font-semibold text-violet-700">
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

      {/* CTA band */}
      <section className="px-5 py-16">
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-[2.5rem] bg-amber-400 px-7 py-12 text-center shadow-[0_12px_40px_rgba(251,191,36,0.35)] sm:px-12">
            <img
              src="/logo.png"
              alt=""
              aria-hidden="true"
              className="mx-auto h-[72px] w-[72px] rotate-3 rounded-[1.2rem]"
            />
            <h2 className="mt-6 text-3xl font-bold tracking-tighter text-[#1c1917] sm:text-4xl">
              Keep the tab open.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[#1c1917]/70">
              Graduations, flow, wallets, and your alerts — one terminal,
              always watching.
            </p>
            <Link
              href="/terminal"
              className="mt-7 inline-block rounded-2xl bg-[#1c1917] px-8 py-4 text-[15px] font-bold text-white transition-all hover:bg-stone-800 active:scale-[0.98]"
            >
              Open the terminal
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200/70 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-5 py-8 text-center md:flex-row md:text-left">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Raven"
              className="h-6 w-6 rounded-lg"
            />
            <span className="text-sm font-semibold">Raven</span>
          </div>
          <p className="font-mono text-[11px] text-stone-500">
            built on Robinhood Chain · data from public RPC
          </p>
        </div>
      </footer>
    </div>
  );
}
