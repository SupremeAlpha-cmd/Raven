/**
 * The Raven tape: decodes Swap events from the pons router into
 * trader-readable buy/sell records.
 *
 * We deliberately avoid decoding the router's complex path tuple —
 * instead we correlate each swap with the ERC-20 Transfers in the same
 * transaction, matched by log proximity to the swap event. Amounts come
 * from the transfers themselves (on-chain fact); the event's amount words
 * are only a matching hint, since their denomination isn't reliable.
 */

import {
  ROUTER,
  STABLES,
  SWAP_TOPIC,
  TRANSFER_TOPIC,
  addrFromTopic,
  getLatestBlock,
  getLogs,
  hexToBigInt,
  rpc,
  rpcBatch,
} from "./chain";

export type Direction = "buy" | "sell" | "swap";

export interface TapeEntry {
  txHash: string;
  blockNumber: number;
  timestamp: number; // estimated, seconds
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

interface Transfer {
  token: string;
  from: string;
  to: string;
  value: bigint;
  logIndex: number;
}

interface TokenMeta {
  symbol: string;
  decimals: number;
}

const metaCache = new Map<string, TokenMeta>();

function decodeAbiString(hex: string): string {
  // Standard ABI-encoded string: offset(32) length(32) data.
  // Some tokens return bytes32 instead — handle that too.
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length === 64) {
    return Buffer.from(clean, "hex").toString("utf8").replace(/\0+$/, "");
  }
  const len = parseInt(clean.slice(64, 128), 16);
  const data = clean.slice(128, 128 + len * 2);
  return Buffer.from(data, "hex").toString("utf8").replace(/\0+$/, "");
}

async function ethCall(to: string, data: string): Promise<string> {
  return rpc<string>("eth_call", [{ to, data }, "latest"]);
}

async function getTokenMeta(address: string): Promise<TokenMeta> {
  const key = address.toLowerCase();
  const cached = metaCache.get(key);
  if (cached) return cached;
  const fallback: TokenMeta = {
    symbol: address.slice(0, 6) + "…" + address.slice(-4),
    decimals: 18,
  };
  try {
    const [decHex, symHex] = await Promise.all([
      ethCall(address, "0x313ce567").catch(() => null), // decimals()
      ethCall(address, "0x95d89b41").catch(() => null), // symbol()
    ]);
    const meta: TokenMeta = {
      symbol:
        symHex && symHex !== "0x"
          ? decodeAbiString(symHex).trim().slice(0, 12) || fallback.symbol
          : fallback.symbol,
      decimals: decHex && decHex !== "0x" ? Number(hexToBigInt(decHex)) : 18,
    };
    if (meta.decimals > 36 || meta.decimals < 0) meta.decimals = 18;
    metaCache.set(key, meta);
    return meta;
  } catch {
    return fallback;
  }
}

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

function parseTransfer(log: {
  address: string;
  topics: string[];
  data: string;
  logIndex: string;
}): Transfer | null {
  if (log.topics.length < 3) return null;
  return {
    token: log.address.toLowerCase(),
    from: addrFromTopic(log.topics[1]),
    to: addrFromTopic(log.topics[2]),
    value: hexToBigInt(log.data),
    logIndex: Number(log.logIndex),
  };
}

/**
 * Fetch and decode the most recent swaps from the router.
 * @param blockSpan how many blocks back to scan (default 300)
 */
export async function getRecentSwaps(blockSpan = 300): Promise<{
  entries: TapeEntry[];
  latestBlock: number;
}> {
  const latest = await getLatestBlock();
  const from = latest - blockSpan;

  const [swapLogs, transferLogs, latestBlock, oldBlock] = await Promise.all([
    getLogs(from, latest, ROUTER, [SWAP_TOPIC]),
    getLogs(from, latest, null, [TRANSFER_TOPIC]),
    rpc<{ timestamp: string }>("eth_getBlockByNumber", ["latest", false]),
    rpc<{ timestamp: string }>("eth_getBlockByNumber", [
      "0x" + from.toString(16),
      false,
    ]),
  ]);

  // Average block time over the window, for timestamp estimates.
  const tLatest = parseInt(latestBlock.timestamp, 16);
  const tOld = parseInt(oldBlock.timestamp, 16);
  const avgBlockTime = blockSpan > 0 ? (tLatest - tOld) / blockSpan : 2;
  const tsFor = (block: number) =>
    Math.round(tLatest - (latest - block) * avgBlockTime);

  // Group transfers by tx hash.
  const transfersByTx = new Map<string, Transfer[]>();
  for (const log of transferLogs) {
    const t = parseTransfer(log);
    if (!t) continue;
    const list = transfersByTx.get(log.transactionHash) ?? [];
    list.push(t);
    transfersByTx.set(log.transactionHash, list);
  }

  // Trader identity comes from the transaction sender, NOT the event topics —
  // the router's indexed params are zero for most swaps. One batched call.
  const txHashes = [...new Set(swapLogs.map((l) => l.transactionHash))];
  const receipts = await rpcBatch<{ from: string; transactionHash: string }>(
    txHashes.map((h) => ({ method: "eth_getTransactionReceipt", params: [h] })),
  );
  const fromByTx = new Map<string, string>();
  receipts.forEach((r, i) => {
    if (r?.from) fromByTx.set(txHashes[i], r.from.toLowerCase());
  });

  const entries: TapeEntry[] = [];
  const metasNeeded = new Set<string>();

  interface RawEntry {
    txHash: string;
    blockNumber: number;
    timestamp: number;
    trader: string;
    direction: Direction;
    tokenIn: string;
    amountInRaw: bigint;
    tokenOut: string;
    amountOutRaw: bigint;
  }
  const raw: RawEntry[] = [];

  // A tx can carry several swaps — don't let two of them claim the same transfer.
  const claimedByTx = new Map<string, Set<number>>();

  for (const log of swapLogs) {
    // Trader = tx sender. Fall back to indexed topic only if it's non-zero.
    let trader = fromByTx.get(log.transactionHash);
    if (!trader && log.topics.length > 1) {
      const t = addrFromTopic(log.topics[1]);
      if (t !== "0x0000000000000000000000000000000000000000") trader = t;
    }
    if (!trader) continue;

    const data = log.data.startsWith("0x") ? log.data.slice(2) : log.data;
    if (data.length < 128) continue;
    const amountIn = hexToBigInt("0x" + data.slice(0, 64));
    const amountOut = hexToBigInt("0x" + data.slice(64, 128));
    if (amountIn === BigInt(0) || amountOut === BigInt(0)) continue;

    const txTransfers = transfersByTx.get(log.transactionHash) ?? [];
    const swapIdx = Number(log.logIndex);
    const routerLc = ROUTER.toLowerCase();
    const zero = "0x0000000000000000000000000000000000000000";
    const claimed = claimedByTx.get(log.transactionHash) ?? new Set<number>();
    const fresh = (t: Transfer) => !claimed.has(t.logIndex);
    // The transfers nearest the swap event are its legs. "Largest amount"
    // matching misattributes when a tx carries several swaps or a big
    // unrelated move — that produced phantom billion-dollar payouts.
    const byProximity = (cands: Transfer[]) =>
      cands.sort(
        (a, b) =>
          Math.abs(a.logIndex - swapIdx) - Math.abs(b.logIndex - swapIdx),
      );

    // tokenOut: the payout leg. Exact event-amount match first, then nearest.
    const outCands = byProximity(
      txTransfers.filter(
        (t) => t.to !== routerLc && t.to !== zero && t.from !== trader && fresh(t),
      ),
    );
    const outLeg =
      outCands.find((t) => t.to === trader && t.value === amountOut) ??
      outCands.find((t) => t.to === trader) ??
      outCands[0] ??
      null;

    // tokenIn: the spend leg. Exact event-amount match first, then nearest.
    // Falls back to the nearest payment into the router (covers ETH->WETH
    // deposits where no trader outflow exists).
    const inCands = byProximity(
      txTransfers.filter((t) => t.from === trader && fresh(t)),
    );
    const inLeg =
      inCands.find((t) => t.value === amountIn) ??
      inCands[0] ??
      byProximity(txTransfers.filter((t) => t.to === routerLc && fresh(t)))[0] ??
      null;

    if (!outLeg || !inLeg) continue;
    // Legs far from the swap event are dubious correlations, not trades.
    if (Math.abs(outLeg.logIndex - swapIdx) > 200) continue;
    if (Math.abs(inLeg.logIndex - swapIdx) > 200) continue;
    // Same token both sides = correlation failure, not a real trade.
    if (inLeg.token === outLeg.token) continue;
    claimed.add(outLeg.logIndex);
    claimed.add(inLeg.logIndex);
    claimedByTx.set(log.transactionHash, claimed);

    const tokenIn = inLeg.token;
    const tokenOut = outLeg.token;
    const direction: Direction = STABLES.has(tokenIn)
      ? "buy"
      : STABLES.has(tokenOut)
        ? "sell"
        : "swap";

    metasNeeded.add(tokenIn);
    metasNeeded.add(tokenOut);

    // Amounts come from the transfers themselves (on-chain fact), not the
    // event words — the event's denomination isn't reliable across swaps.
    raw.push({
      txHash: log.transactionHash,
      blockNumber: parseInt(log.blockNumber, 16),
      timestamp: tsFor(parseInt(log.blockNumber, 16)),
      trader,
      direction,
      tokenIn,
      amountInRaw: inLeg.value,
      tokenOut,
      amountOutRaw: outLeg.value,
    });
  }

  // Resolve metadata for tokens in this batch (cached across calls).
  const metas = new Map<string, TokenMeta>();
  await Promise.all(
    [...metasNeeded].map(async (a) => metas.set(a, await getTokenMeta(a))),
  );

  for (const r of raw) {
    const inMeta = metas.get(r.tokenIn)!;
    const outMeta = metas.get(r.tokenOut)!;
    // Backstop: no Pons trade moves a billion dollars in one leg.
    // Anything that large is a correlation artifact, not a trade.
    const inQuote =
      STABLES.has(r.tokenIn) &&
      Number(r.amountInRaw) / 10 ** inMeta.decimals > 1e9;
    const outQuote =
      STABLES.has(r.tokenOut) &&
      Number(r.amountOutRaw) / 10 ** outMeta.decimals > 1e9;
    if (inQuote || outQuote) continue;
    entries.push({
      txHash: r.txHash,
      blockNumber: r.blockNumber,
      timestamp: r.timestamp,
      trader: r.trader,
      direction: r.direction,
      tokenIn: r.tokenIn,
      tokenInSymbol: inMeta.symbol,
      amountIn: formatAmount(r.amountInRaw, inMeta.decimals),
      amountInRaw: r.amountInRaw.toString(),
      amountInDecimals: inMeta.decimals,
      tokenOut: r.tokenOut,
      tokenOutSymbol: outMeta.symbol,
      amountOut: formatAmount(r.amountOutRaw, outMeta.decimals),
      amountOutRaw: r.amountOutRaw.toString(),
      amountOutDecimals: outMeta.decimals,
    });
  }

  entries.sort((a, b) => b.blockNumber - a.blockNumber);
  return { entries, latestBlock: latest };
}
