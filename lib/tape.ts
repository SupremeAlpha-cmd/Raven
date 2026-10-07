/**
 * The Raven tape: pump.fun TradeEvents decoded into trader-readable
 * buy/sell records.
 *
 * Strictly simpler than the EVM version — every TradeEvent already carries
 * mint, solAmount, tokenAmount, isBuy, user and timestamp, so there is no
 * swap↔transfer correlation step and no receipt lookup. Trader identity is
 * the event's `user` (== the tx fee payer).
 */

import {
  PUMP_PROGRAM,
  QUOTES,
  USDC_MINT,
  WSOL_MINT,
  decodePumpEvents,
  getRecentSignatures,
  getTokenMeta,
  getTransactionsBatched,
  withRetry,
  type TokenMeta,
  type TradeEvent,
} from "./solana";

export type Direction = "buy" | "sell" | "swap";

export interface TapeEntry {
  txHash: string;
  blockNumber: number;
  timestamp: number; // seconds, exact (blockTime)
  trader: string;
  direction: Direction;
  tokenIn: string;
  tokenInSymbol: string;
  amountIn: string; // human-readable
  amountInRaw: string; // decimal string, for aggregation
  amountInDecimals: number;
  tokenOut: string;
  tokenOutSymbol: string;
  amountOut: string; // human-readable
  amountOutRaw: string; // decimal string, for aggregation
  amountOutDecimals: number;
}

// Re-exported so graduation/lookup keep their existing import path.
export { getTokenMeta };
export type { TokenMeta };

const QUOTE_DECIMALS: Record<string, number> = {
  [WSOL_MINT]: 9,
  [USDC_MINT]: 6,
};
const QUOTE_SYMBOL: Record<string, string> = {
  [WSOL_MINT]: "SOL",
  [USDC_MINT]: "USDC",
};

function formatAmount(raw: bigint, decimals: number): string {
  const neg = raw < BigInt(0);
  const abs = neg ? -raw : raw;
  const base = BigInt(10) ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  // Small amounts get more decimal places so they don't render as "0".
  const fracDigits = whole === BigInt(0) ? 8 : 4;
  const fracStr = frac
    .toString()
    .padStart(decimals, "0")
    .slice(0, fracDigits)
    .replace(/0+$/, "");
  const prefix = neg ? "-" : "";
  if (whole >= BigInt(1_000_000)) {
    return prefix + (Number(whole) / 1_000_000).toFixed(2) + "M";
  }
  if (whole >= BigInt(1_000)) {
    return prefix + (Number(whole) / 1_000).toFixed(2) + "K";
  }
  if (whole === BigInt(0) && !fracStr) return "<0.00000001";
  return prefix + whole.toString() + (fracStr ? "." + fracStr : "");
}

interface RawTrade {
  signature: string;
  slot: number;
  blockTime: number;
  trade: TradeEvent;
  quoteMint: string;
}

/**
 * Detect the quote mint of a trade from the transaction's token balances.
 * USDC-quoted curves move USDC in the tx; SOL-quoted curves move native
 * SOL (no SPL delta). No extra RPC — the balances ride along with the tx.
 */
function detectQuoteMint(tx: {
  meta?: {
    preTokenBalances?: { mint: string; uiTokenAmount: { amount: string } }[];
    postTokenBalances?: { mint: string; uiTokenAmount: { amount: string } }[];
  } | null;
}): string {
  const meta = tx.meta;
  if (!meta) return WSOL_MINT;
  const pre = new Map<string, bigint>();
  const post = new Map<string, bigint>();
  for (const b of meta.preTokenBalances ?? []) {
    if (b.mint !== USDC_MINT) continue;
    try {
      pre.set(b.mint, BigInt(b.uiTokenAmount.amount));
    } catch { /* ignore */ }
  }
  for (const b of meta.postTokenBalances ?? []) {
    if (b.mint !== USDC_MINT) continue;
    try {
      post.set(b.mint, (post.get(b.mint) ?? BigInt(0)) + BigInt(b.uiTokenAmount.amount));
    } catch { /* ignore */ }
  }
  for (const [mint, amt] of pre) {
    if ((post.get(mint) ?? BigInt(0)) !== amt) return USDC_MINT;
  }
  for (const [mint, amt] of post) {
    if (!pre.has(mint) && amt !== BigInt(0)) return USDC_MINT;
  }
  return WSOL_MINT;
}

/**
 * Fetch and decode the most recent pump.fun curve trades.
 * @param limit how many recent program transactions to scan (default 120 —
 *   tuned for public-RPC rate limits; raise with HELIUS_API_KEY set)
 */
export async function getRecentSwaps(limit = 120): Promise<{
  entries: TapeEntry[];
  latestBlock: number;
}> {
  const sigs = await getRecentSignatures(PUMP_PROGRAM, limit);
  const ok = sigs.filter((s) => !s.err);
  const signatures = ok.map((s) => s.signature);
  const slotBySig = new Map(ok.map((s) => [s.signature, s.slot]));
  const timeBySig = new Map(
    ok.map((s) => [s.signature, s.blockTime ?? null]),
  );

  const txBySig = await getTransactionsBatched(signatures, {
    label: "getTransactions(tape)",
  });

  const raw: RawTrade[] = [];
  for (const [sig, tx] of txBySig) {
    const logs: string[] | null | undefined =
      tx?.meta?.logMessages ?? tx?.meta?.["logMessages"];
    const { trades } = decodePumpEvents(logs);
    if (trades.length === 0) continue;
    const blockTime =
      tx.blockTime ?? timeBySig.get(sig) ?? Math.floor(Date.now() / 1000);
    const quoteMint = detectQuoteMint(tx);
    for (const trade of trades) {
      raw.push({
        signature: sig,
        slot: slotBySig.get(sig) ?? 0,
        blockTime,
        trade,
        quoteMint,
      });
    }
  }

  // Resolve metadata for tokens in this batch (cached across calls).
  const metasNeeded = new Set<string>();
  for (const r of raw) metasNeeded.add(r.trade.mint);
  const metas = new Map<string, TokenMeta>();
  await Promise.all(
    [...metasNeeded].map(async (m) => metas.set(m, await getTokenMeta(m))),
  );

  const entries: TapeEntry[] = [];
  for (const r of raw) {
    const t = r.trade;
    const qDec = QUOTE_DECIMALS[r.quoteMint] ?? 9;
    const qSym = QUOTE_SYMBOL[r.quoteMint] ?? "SOL";
    const mMeta = metas.get(t.mint)!;

    const isBuy = t.isBuy;
    const tokenIn = isBuy ? r.quoteMint : t.mint;
    const tokenOut = isBuy ? t.mint : r.quoteMint;
    const amountInRaw = isBuy ? t.solAmount : t.tokenAmount;
    const amountOutRaw = isBuy ? t.tokenAmount : t.solAmount;
    const inDecimals = isBuy ? qDec : mMeta.decimals;
    const outDecimals = isBuy ? mMeta.decimals : qDec;
    const inSymbol = isBuy ? qSym : mMeta.symbol;
    const outSymbol = isBuy ? mMeta.symbol : qSym;

    if (amountInRaw === BigInt(0) || amountOutRaw === BigInt(0)) continue;

    // Backstop: no pump.fun trade moves a billion dollars in one leg.
    const inQuoteUsd =
      QUOTES.has(tokenIn) && Number(amountInRaw) / 10 ** inDecimals > 1e9;
    const outQuoteUsd =
      QUOTES.has(tokenOut) && Number(amountOutRaw) / 10 ** outDecimals > 1e9;
    if (inQuoteUsd || outQuoteUsd) continue;

    entries.push({
      txHash: r.signature,
      blockNumber: r.slot,
      timestamp: r.blockTime,
      trader: t.user,
      direction: isBuy ? "buy" : "sell",
      tokenIn,
      tokenInSymbol: inSymbol,
      amountIn: formatAmount(amountInRaw, inDecimals),
      amountInRaw: amountInRaw.toString(),
      amountInDecimals: inDecimals,
      tokenOut,
      tokenOutSymbol: outSymbol,
      amountOut: formatAmount(amountOutRaw, outDecimals),
      amountOutRaw: amountOutRaw.toString(),
      amountOutDecimals: outDecimals,
    });
  }

  entries.sort((a, b) => b.blockNumber - a.blockNumber);
  const latestBlock = ok.length > 0 ? Math.max(...ok.map((s) => s.slot)) : 0;
  return { entries, latestBlock };
}
