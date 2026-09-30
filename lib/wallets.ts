/**
 * Wallets slice: turns the swap tape into a per-wallet activity leaderboard.
 *
 * Honest labeling: this ranks wallets by *activity* (quote-denominated
 * volume + trade count) over the recent window. It does not claim
 * profitability — PnL needs price history, which comes later.
 */

import { STABLES } from "./chain";
import { getRecentSwaps } from "./tape";

export interface WalletStats {
  address: string;
  trades: number;
  buys: number;
  sells: number;
  /** quote-denominated volume (USDG/WETH legs), in native units */
  quoteVolume: number;
  topToken: string;
  lastActive: number; // estimated timestamp, seconds
}

function toUnits(raw: string, decimals: number): number {
  return Number(BigInt(raw)) / 10 ** decimals;
}

export async function getWalletLeaderboard(limit = 25): Promise<{
  wallets: WalletStats[];
  tradersSeen: number;
  latestBlock: number;
}> {
  const { entries, latestBlock } = await getRecentSwaps(300);
  const map = new Map<string, WalletStats & { tokenCounts: Map<string, number> }>();

  for (const e of entries) {
    let w = map.get(e.trader);
    if (!w) {
      w = {
        address: e.trader,
        trades: 0,
        buys: 0,
        sells: 0,
        quoteVolume: 0,
        topToken: "",
        lastActive: 0,
        tokenCounts: new Map(),
      };
      map.set(e.trader, w);
    }
    w.trades += 1;
    if (e.direction === "buy") w.buys += 1;
    if (e.direction === "sell") w.sells += 1;
    // Volume counts the quote-asset legs (what they spent or received).
    if (STABLES.has(e.tokenIn)) {
      w.quoteVolume += toUnits(e.amountInRaw, e.amountInDecimals);
    }
    if (STABLES.has(e.tokenOut)) {
      w.quoteVolume += toUnits(e.amountOutRaw, e.amountOutDecimals);
    }
    // Top token = the non-quote token they touched most.
    const meme = STABLES.has(e.tokenIn) ? e.tokenOutSymbol : e.tokenInSymbol;
    w.tokenCounts.set(meme, (w.tokenCounts.get(meme) ?? 0) + 1);
    if (e.timestamp > w.lastActive) w.lastActive = e.timestamp;
  }

  const wallets: WalletStats[] = [...map.values()].map((w) => {
    let top = "";
    let topN = 0;
    for (const [sym, n] of w.tokenCounts) {
      if (n > topN) {
        topN = n;
        top = sym;
      }
    }
    const { tokenCounts: _, ...rest } = w;
    return { ...rest, topToken: top || "—" };
  });

  wallets.sort((a, b) => b.quoteVolume - a.quoteVolume);
  return { wallets: wallets.slice(0, limit), tradersSeen: map.size, latestBlock };
}

export function formatVolume(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(2) + "K";
  if (v === 0) return "0";
  return v >= 100 ? v.toFixed(1) : v.toFixed(4);
}
