/**
 * Token lookup slice: paste a mint address, see how far its
 * bonding curve has gone.
 *
 * Reads pump.fun mechanics straight from Solana:
 *  - the BondingCurve PDA gives the graduated flag (`complete`)
 *    plus virtual SOL reserves → progress = net SOL raised / 85 SOL
 *  - 24h velocity from the mint's own signature history (TradeEvents)
 *
 * Honest boundaries: only SOL-denominated curves get a progress number
 * (that's Raven's whole graduation framing); non-pump.fun mints return
 * found:false; graduated tokens report "graduated" instead of a progress.
 */

import {
  GRADUATION_NET_SOL_LAMPORTS,
  LAMPORTS_PER_SOL,
  bondingCurvePda,
  curveProgress,
  decodePumpEvents,
  getBondingCurve,
  getRecentSignatures,
  getTransactionsBatched,
  isValidAddress,
  netSolRaised,
} from "./solana";
import { getTokenMeta } from "./tape";
import type { NearGraduation } from "./graduation";

export const PHASE_LABELS: Record<number, string> = {
  0: "climbing",
  1: "graduated",
};

export type LookupResult =
  | { found: false }
  | {
      found: true;
      graduated: true;
      token: string;
      symbol: string;
      phase: number;
      phaseLabel: string;
    }
  | ({
      found: true;
      graduated: false;
    } & NearGraduation);

const GRADUATION_SOL = GRADUATION_NET_SOL_LAMPORTS / LAMPORTS_PER_SOL; // 85

export async function lookupToken(raw: string): Promise<LookupResult> {
  const mint = raw.trim();
  if (!isValidAddress(mint)) {
    throw new Error("not an address — paste a base58 mint address");
  }

  // 1. The curve PDA either exists (pump.fun launch) or it doesn't.
  const state = await getBondingCurve(mint).catch(() => null);
  if (!state) return { found: false };

  const meta = await getTokenMeta(mint);
  const curve = bondingCurvePda(mint).toBase58();

  // 2. Graduated: report it, no fake progress curve.
  if (state.complete) {
    return {
      found: true,
      graduated: true,
      token: mint,
      symbol: meta.symbol,
      phase: 1,
      phaseLabel: PHASE_LABELS[1],
    };
  }

  // 3. 24h buy velocity from the mint's own history (targeted, cheap).
  const now = Math.floor(Date.now() / 1000);
  let velocity = 0;
  try {
    const sigs = await getRecentSignatures(mint, 200);
    const okSigs = sigs.filter((s) => !s.err).map((s) => s.signature);
    const txBySig = await getTransactionsBatched(okSigs, {
      label: "getTransactions(lookup)",
    });
    for (const [, tx] of txBySig) {
      const blockTime = tx.blockTime ?? now;
      if (blockTime < now - 86400) continue;
      const { trades } = decodePumpEvents(tx.meta?.logMessages);
      for (const t of trades) {
        if (t.mint === mint && t.isBuy) {
          velocity += Number(t.solAmount) / LAMPORTS_PER_SOL;
        }
      }
    }
  } catch {
    // Velocity is a nice-to-have; progress is the point.
  }

  return {
    found: true,
    graduated: false,
    token: mint,
    symbol: meta.symbol,
    curve,
    progress: curveProgress(state),
    raised: Math.max(0, netSolRaised(state)),
    threshold: GRADUATION_SOL,
    velocity24h: velocity,
  };
}
