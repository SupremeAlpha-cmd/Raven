import Link from "next/link";

const views = [
  {
    name: "Today",
    href: "/terminal",
    tag: "the graduation calendar",
    desc: "Every bonding curve on Pons, ranked by how close it is to the 8,090 USDG graduation line — and how fast it's moving.",
  },
  {
    name: "Flow",
    href: "/terminal",
    tag: "the live tape",
    desc: "Every buy and sell on the chain as it happens, on a 30-second tape. No noise, just flow.",
  },
  {
    name: "Wallets",
    href: "/terminal",
    tag: "the money in motion",
    desc: "The most active wallets on Robinhood Chain, ranked by size. Watch where the money moves first.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-100">
      {/* Nav */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Raven" className="h-7 w-7" />
          <span className="text-lg font-bold tracking-tight">Raven</span>
        </div>
        <Link
          href="/terminal"
          className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-white"
        >
          Open terminal
        </Link>
      </nav>

      {/* Hero */}
      <header className="mx-auto max-w-5xl px-6 pb-20 pt-16 text-center md:pt-24">
        <img
          src="/logo.png"
          alt="Raven eye"
          className="mx-auto h-24 w-24 md:h-28 md:w-28"
        />
        <h1 className="mt-8 text-5xl font-bold tracking-tight md:text-7xl">
          RAVEN
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-400 md:text-xl">
          Raven watches the chain so you don&apos;t have to.
        </p>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-500">
          What&apos;s happening on Robinhood Chain today — graduations, live
          trade flow, and wallet signals, in one terminal that never closes.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link
            href="/terminal"
            className="rounded-md bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-300"
          >
            Open the terminal
          </Link>
          <a
            href="https://github.com/SupremeAlpha-cmd/Raven"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-zinc-800 px-6 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
          >
            GitHub
          </a>
        </div>
        <p className="mt-6 font-mono text-[11px] text-zinc-600">
          no wallet · no signup · reads straight from public RPC
        </p>
      </header>

      {/* Views */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          {views.map((v) => (
            <Link
              key={v.name}
              href={v.href}
              className="group rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-6 transition-colors hover:border-zinc-600"
            >
              <p className="font-mono text-[11px] uppercase tracking-wider text-emerald-400/90">
                {v.tag}
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">
                {v.name}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {v.desc}
              </p>
              <p className="mt-5 text-sm font-medium text-zinc-500 transition-colors group-hover:text-zinc-200">
                Open {v.name.toLowerCase()} →
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-zinc-800/60">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-xl font-bold tracking-tight">
            Straight from the chain
          </h2>
          <div className="mt-8 grid gap-8 text-sm leading-relaxed text-zinc-400 md:grid-cols-3">
            <div>
              <p className="font-mono text-[12px] text-zinc-200">01 — Index</p>
              <p className="mt-2">
                Raven reads Pons factory events and router swaps directly
                from Robinhood Chain&apos;s public RPC. No middlemen, no
                stale APIs.
              </p>
            </div>
            <div>
              <p className="font-mono text-[12px] text-zinc-200">02 — Verify</p>
              <p className="mt-2">
                Graduation progress is computed from on-chain buys minus
                sells — the same math the curve uses. Nothing guessed.
              </p>
            </div>
            <div>
              <p className="font-mono text-[12px] text-zinc-200">03 — Watch</p>
              <p className="mt-2">
                The tape polls every 30 seconds. Keep the tab open and the
                chain comes to you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-8 text-center md:flex-row md:text-left">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Raven" className="h-5 w-5" />
            <span className="text-sm font-semibold">Raven</span>
          </div>
          <p className="font-mono text-[11px] text-zinc-600">
            built on Robinhood Chain · data from public RPC
          </p>
        </div>
      </footer>
    </div>
  );
}
