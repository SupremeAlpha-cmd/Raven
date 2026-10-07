/**
 * Today slice: the graduation calendar.
 *
 * Reads pump.fun mechanics straight from Solana (the Pons-factory
 * equivalent):
 *  - CreateEvent on the pump program enumerates bonding-curve launches
 *  - the BondingCurve PDA account gives the graduated flag (`complete`)
 *    plus virtual SOL reserves → progress = net SOL raised / 85 SOL
 *  - CompleteEvent on the pump program = the graduation calendar itself
 *
 * Results are cached in-memory for 5 minutes — a full scan is hundreds
 * of RPC calls and graduations move slowly.
 *
 * Honest boundary (mirrors the old USDG-only rule): graduation progress
 * is computed for SOL-denominated curves. USDC-quoted curves are rare;
 * their trades still appear on the Flow tape.
 */

import {
  GRADUATION_NET_SOL_LAMPORTS,
  LAMPORTS_PER_SOL,
  PUMP_PROGRAM,
  bondingCurvePda,
  curveProgress,
  decodePumpEvents,
  getBondingCurve,
  getRecentSignatures,
  getTokenMeta,
  getTransactionsBatched,
  netSolRaised,
  type TradeEvent,
} from "./solana";

const MAX_CURVES = 25; // per-scan cap; most recent launches first
const CACHE_TTL_MS = 5 * 60_000;
const GRADUATION_SOL = GRADUATION_NET_SOL_LAMPORTS / LAMPORTS_PER_SOL; // 85

export interface NearGraduation {
  token: string;
  symbol: string;
  curve: string;
  progress: number; // 0..1
  raised: number; // SOL
  threshold: number; // SOL (85)
  velocity24h: number; // SOL of buys in the last 24h
}

export interface Graduation {
  token: string;
  symbol: string;
  blockNumber: number; // slot
  timestamp: number;
  pairAmount: number; // SOL seeded into the PumpSwap pool (~85)
  pair: "SOL" | "USDC";
}

let cache: { at: number; data: { nearing: NearGraduation[]; graduated: Graduation[] } } | null =
  null;

export async function getToday(): Promise<{
  nearing: NearGraduation[];
  graduated: Graduation[];
  stale: boolean;
}> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { ...cache.data, stale: false };
  }
  try {
    const data = await buildToday();
    cache = { at: Date.now(), data };
    return { ...data, stale: false };
  } catch (err) {
    // A transient RPC blip shouldn't blank the tab: graduations move slowly,
    // so slightly old data beats an error page. Only throw (→ 502) when
    // we've never succeeded once.
    if (cache) return { ...cache.data, stale: true };
    throw err;
  }
}

interface ScannedTrade extends TradeEvent {
  blockTime: number;
}

async function buildToday(): Promise<{
  nearing: NearGraduation[];
  graduated: Graduation[];
}> {
  const now = Math.floor(Date.now() / 1000);

  // One program-history scan feeds launches, graduations AND 24h velocity.
  // 350 signatures ≈ the recent pump.fun window; the 5-min cache absorbs
  // the fetch cost. Raise with HELIUS_API_KEY set.
  const sigs = await getRecentSignatures(PUMP_PROGRAM, 350);
  const ok = sigs.filter((s) => !s.err);
  const signatures = ok.map((s) => s.signature);
  const timeBySig = new Map(ok.map((s) => [s.signature, s.blockTime ?? null]));
  const slotBySig = new Map(ok.map((s) => [s.signature, s.slot]));

  const creates = new Map<string, { symbol: string; slot: number }>();
  const completes: { mint: string; slot: number; blockTime: number }[] = [];
  const tradesByMint = new Map<string, ScannedTrade[]>();

  const txBySig = await getTransactionsBatched(signatures, {
    label: "getTransactions(today)",
  });
  for (const [sig, tx] of txBySig) {
    const blockTime = tx.blockTime ?? timeBySig.get(sig) ?? now;
    const { trades, creates: ce, completes: co } = decodePumpEvents(
      tx.meta?.logMessages,
    );
    for (const c of ce) {
      // Signatures come newest-first: first sighting wins.
      if (!creates.has(c.mint)) {
        creates.set(c.mint, {
          symbol: c.symbol || c.mint.slice(0, 6),
          slot: slotBySig.get(sig) ?? 0,
        });
      }
    }
    for (const c of co) {
      completes.push({
        mint: c.mint,
        slot: slotBySig.get(sig) ?? 0,
        blockTime,
      });
    }
    for (const t of trades) {
      const list = tradesByMint.get(t.mint) ?? [];
      list.push({ ...t, blockTime });
      tradesByMint.set(t.mint, list);
    }
  }

  // 24h buy velocity per mint, from the same scan.
  const velocityByMint = new Map<string, number>();
  for (const [mint, trades] of tradesByMint) {
    let vel = 0;
    for (const t of trades) {
      if (t.isBuy && t.blockTime >= now - 86400) {
        vel += Number(t.solAmount) / LAMPORTS_PER_SOL;
      }
    }
    if (vel > 0) velocityByMint.set(mint, vel);
  }

  // Progress per recent launch, straight from the curve PDA.
  // Small concurrency to stay friendly to public RPC.
  const mints = [...creates.keys()].slice(0, 60);
  const nearing: NearGraduation[] = [];
  const CONC = 5;
  for (let i = 0; i < mints.length; i += CONC) {
    const batch = mints.slice(i, i + CONC);
    const states = await Promise.all(
      batch.map((mint) => getBondingCurve(mint).catch(() => null)),
    );
    for (let k = 0; k < batch.length; k++) {
      const state = states[k];
      if (!state || state.complete) continue; // graduated or gone
      const mint = batch[k];
      const meta = await getTokenMeta(mint);
      nearing.push({
        token: mint,
        symbol: meta.symbol,
        curve: bondingCurvePda(mint).toBase58(),
        progress: curveProgress(state),
        raised: Math.max(0, netSolRaised(state)),
        threshold: GRADUATION_SOL,
        velocity24h: velocityByMint.get(mint) ?? 0,
      });
      if (nearing.length >= MAX_CURVES) break;
    }
    if (nearing.length >= MAX_CURVES) break;
    if (i + CONC < mints.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  nearing.sort((a, b) => b.progress - a.progress);

  // Recent graduations (newest first, cap 20).
  const seen = new Set<string>();
  const graduated: Graduation[] = [];
  for (const c of completes) {
    if (seen.has(c.mint)) continue;
    seen.add(c.mint);
    const meta = await getTokenMeta(c.mint);
    graduated.push({
      token: c.mint,
      symbol: meta.symbol,
      blockNumber: c.slot,
      timestamp: c.blockTime,
      pairAmount: GRADUATION_SOL,
      pair: "SOL",
    });
    if (graduated.length >= 20) break;
  }

  return { nearing, graduated };
}
