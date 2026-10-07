/**
 * Solana chain client for Raven — replaces lib/chain.ts (EVM).
 *
 * Reads straight from Solana mainnet-beta: the pump.fun bonding-curve
 * program is the launch factory AND the trade router, so one program
 * address feeds every view. No Blockscout, no eth_getLogs.
 *
 * Data model notes (pump.fun program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P):
 *  - TradeEvent  → the Flow tape (mint, solAmount, tokenAmount, isBuy, user)
 *  - CreateEvent → Today launches
 *  - CompleteEvent → Today graduations
 *  - BondingCurve PDA account → progress + graduated flag (no event math)
 *
 * RPC: uses HELIUS_API_KEY when set (Helius RPC), otherwise the public
 * mainnet-beta endpoint. Public RPC is rate-limited — keep per-poll
 * signature counts modest.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HELIUS_KEY = process.env.HELIUS_API_KEY?.trim();
export const RPC_URL = HELIUS_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
  : "https://api.mainnet-beta.solana.com";

/** pump.fun bonding-curve program: launches, curve trades, graduations. */
export const PUMP_PROGRAM = new PublicKey(
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
);
/** PumpSwap AMM: where graduated tokens trade (post-migration). */
export const PUMPSWAP_AMM = new PublicKey(
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
);

/** Quote assets — a trade touching one of these is a buy/sell. */
export const WSOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const QUOTES = new Set([WSOL_MINT, USDC_MINT]);

export const LAMPORTS_PER_SOL = 1_000_000_000;

/** pump.fun V1 curve economics (SOL-denominated). */
export const INITIAL_VIRTUAL_SOL_LAMPORTS = 30 * LAMPORTS_PER_SOL;
export const GRADUATION_NET_SOL_LAMPORTS = 85 * LAMPORTS_PER_SOL;

export const EXPLORER = "https://solscan.io";

// ---------------------------------------------------------------------------
// Connection (singleton, retrying)
// ---------------------------------------------------------------------------

let conn: Connection | null = null;

export function getConnection(): Connection {
  if (!conn) {
    conn = new Connection(RPC_URL, {
      commitment: "confirmed",
      // @solana/web3.js fetch wrapper; keep default otherwise
    });
  }
  return conn;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run an RPC call with retries on transient failures (429 / 5xx /
 * network blips), exponential backoff. Mirrors the old postRpc behavior.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
): Promise<T> {
  const MAX_ATTEMPTS = 3;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retriable =
        /429|503|502|500|timeout|ECONNRESET|ENOTFOUND|fetch failed/i.test(msg);
      if (!retriable || attempt === MAX_ATTEMPTS) {
        throw new Error(`${label} failed: ${msg}`);
      }
      await sleep(700 * 2 ** (attempt - 1));
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Signatures (the eth_getLogs replacement)
// ---------------------------------------------------------------------------

export interface SigInfo {
  signature: string;
  slot: number;
  blockTime: number | null | undefined;
  err: unknown;
}

/**
 * Recent transactions touching an address (program, mint, wallet…).
 * Solana has no chain-wide log filter — per-account history is the
 * primitive. `limit` caps at 1000 per call.
 */
export async function getRecentSignatures(
  address: PublicKey | string,
  limit = 300,
): Promise<SigInfo[]> {
  const c = getConnection();
  const sigs = await withRetry(
    () => c.getSignaturesForAddress(new PublicKey(address), { limit }),
    "getSignaturesForAddress",
  );
  return sigs.map((s) => ({
    signature: s.signature,
    slot: s.slot,
    blockTime: s.blockTime,
    err: s.err,
  }));
}

// ---------------------------------------------------------------------------
// Anchor event decoding
// ---------------------------------------------------------------------------

function discriminator(eventName: string): Buffer {
  return createHash("sha256").update(`event:${eventName}`).digest().slice(0, 8);
}

const TRADE_DISC = discriminator("TradeEvent");
const CREATE_DISC = discriminator("CreateEvent");
const COMPLETE_DISC = discriminator("CompleteEvent");

function readPubkey(buf: Buffer, off: number): string {
  return new PublicKey(buf.subarray(off, off + 32)).toBase58();
}
function readU64(buf: Buffer, off: number): bigint {
  return buf.readBigUInt64LE(off);
}
function readI64(buf: Buffer, off: number): bigint {
  return buf.readBigInt64LE(off);
}
function readString(buf: Buffer, off: number): { value: string; next: number } {
  const len = buf.readUInt32LE(off);
  const value = buf.subarray(off + 4, off + 4 + len).toString("utf8");
  return { value, next: off + 4 + len };
}

export interface TradeEvent {
  mint: string;
  solAmount: bigint; // lamports (SOL-quoted curves)
  tokenAmount: bigint; // raw token units
  isBuy: boolean;
  user: string; // base58 — the trader
  timestamp: number; // seconds
}

export interface CreateEvent {
  name: string;
  symbol: string;
  uri: string;
  mint: string;
  bondingCurve: string;
  user: string;
}

export interface CompleteEvent {
  user: string;
  mint: string;
  bondingCurve: string;
  timestamp: number;
}

/**
 * Decode pump.fun Anchor events from a transaction's program logs.
 * Returns every TradeEvent / CreateEvent / CompleteEvent found.
 */
export function decodePumpEvents(logMessages: string[] | null | undefined): {
  trades: TradeEvent[];
  creates: CreateEvent[];
  completes: CompleteEvent[];
} {
  const trades: TradeEvent[] = [];
  const creates: CreateEvent[] = [];
  const completes: CompleteEvent[] = [];
  if (!logMessages) return { trades, creates, completes };

  for (const line of logMessages) {
    // Modern Anchor emits events as "Program data:"; older programs used
    // "Program log:". Match both.
    const m = /^Program (?:log|data): ([A-Za-z0-9+/=]+)$/.exec(line.trim());
    if (!m) continue;
    let buf: Buffer;
    try {
      buf = Buffer.from(m[1], "base64");
    } catch {
      continue;
    }
    if (buf.length < 8) continue;
    const disc = buf.subarray(0, 8);
    const data = buf.subarray(8);

    try {
      if (disc.equals(TRADE_DISC) && data.length >= 89) {
        trades.push({
          mint: readPubkey(data, 0),
          solAmount: readU64(data, 32),
          tokenAmount: readU64(data, 40),
          isBuy: data[48] === 1,
          user: readPubkey(data, 49),
          timestamp: Number(readI64(data, 81)),
        });
      } else if (disc.equals(CREATE_DISC) && data.length > 12) {
        let off = 0;
        const name = readString(data, off); off = name.next;
        const symbol = readString(data, off); off = symbol.next;
        const uri = readString(data, off); off = uri.next;
        if (data.length < off + 96) continue;
        creates.push({
          name: name.value,
          symbol: symbol.value,
          uri: uri.value,
          mint: readPubkey(data, off),
          bondingCurve: readPubkey(data, off + 32),
          user: readPubkey(data, off + 64),
        });
      } else if (disc.equals(COMPLETE_DISC) && data.length >= 104) {
        completes.push({
          user: readPubkey(data, 0),
          mint: readPubkey(data, 32),
          bondingCurve: readPubkey(data, 64),
          timestamp: Number(readI64(data, 96)),
        });
      }
    } catch {
      // Malformed event payload — skip, don't kill the batch.
    }
  }
  return { trades, creates, completes };
}

// ---------------------------------------------------------------------------
// Bonding-curve PDA + account
// ---------------------------------------------------------------------------

/** Derive the bonding-curve PDA for a mint: seeds ["bonding-curve", mint]. */
export function bondingCurvePda(mint: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), new PublicKey(mint).toBuffer()],
    PUMP_PROGRAM,
  );
  return pda;
}

export interface BondingCurveState {
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
  creator: string;
}

/** Parse a BondingCurve account (81 bytes: 8 disc + 5×u64 + bool + pubkey). */
export function parseBondingCurve(data: Buffer): BondingCurveState | null {
  if (data.length < 81) return null;
  const d = data.subarray(8);
  return {
    virtualTokenReserves: readU64(d, 0),
    virtualSolReserves: readU64(d, 8),
    realTokenReserves: readU64(d, 16),
    realSolReserves: readU64(d, 24),
    tokenTotalSupply: readU64(d, 32),
    complete: d[40] === 1,
    creator: readPubkey(d, 41),
  };
}

export async function getBondingCurve(
  mint: string,
): Promise<BondingCurveState | null> {
  const c = getConnection();
  const info = await withRetry(
    () => c.getAccountInfo(bondingCurvePda(mint)),
    "getAccountInfo(bondingCurve)",
  );
  if (!info?.data) return null;
  return parseBondingCurve(Buffer.from(info.data));
}

/**
 * Net SOL raised on a SOL-denominated curve (lamports).
 * Progress = netRaised / GRADUATION_NET_SOL_LAMPORTS, clamped 0..1.
 */
export function curveProgress(state: BondingCurveState): number {
  const net =
    state.virtualSolReserves - BigInt(INITIAL_VIRTUAL_SOL_LAMPORTS);
  if (net <= BigInt(0)) return 0;
  const p = Number((net * BigInt(10_000)) / BigInt(GRADUATION_NET_SOL_LAMPORTS)) / 10_000;
  return Math.min(1, Math.max(0, p));
}

export function netSolRaised(state: BondingCurveState): number {
  const net =
    state.virtualSolReserves - BigInt(INITIAL_VIRTUAL_SOL_LAMPORTS);
  return Number(net) / LAMPORTS_PER_SOL;
}

// ---------------------------------------------------------------------------
// Batched transaction fetch (public RPC 429s large batches — keep chunks small)
// ---------------------------------------------------------------------------

/** getTransaction version cap: pump.fun traffic includes v1 transactions. */
export const TX_VERSION_OPTS = { maxSupportedTransactionVersion: 1 } as const;

/**
 * Fetch parsed transactions via a concurrency-limited pool of singular
 * getTransaction calls. The batch getTransactions endpoint is aggressively
 * rate-limited on public RPC; the singular endpoint with web3.js's own
 * 429 retries sustains ~10/s. With HELIUS_API_KEY set you can raise
 * concurrency.
 */
export async function getTransactionsBatched(
  signatures: string[],
  opts: { concurrency?: number; label?: string } = {},
): Promise<Map<string, any>> {
  const { concurrency = 6, label = "getTransaction" } = opts;
  const conn = getConnection();
  const out = new Map<string, any>();
  let i = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (i < signatures.length) {
      const idx = i++;
      const sig = signatures[idx];
      try {
        const tx = await withRetry(
          () => conn.getTransaction(sig, TX_VERSION_OPTS),
          label,
        );
        if (tx) out.set(sig, tx);
      } catch {
        // One unparseable tx shouldn't kill the batch — skip it.
      }
    }
  });
  await Promise.all(workers);
  return out;
}

// ---------------------------------------------------------------------------
// Address helpers
// ---------------------------------------------------------------------------

/** Validate a base58 Solana address (32–44 chars, base58 alphabet). */
export function isValidAddress(raw: string): boolean {
  const s = raw.trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return false;
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}

export function shortAddr(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

// ---------------------------------------------------------------------------
// Token metadata (Jupiter Token API, free, no key) + SOL price
// ---------------------------------------------------------------------------

export interface TokenMeta {
  symbol: string;
  decimals: number;
}

const metaCache = new Map<string, TokenMeta>();

const KNOWN_META: Record<string, TokenMeta> = {
  [WSOL_MINT]: { symbol: "SOL", decimals: 9 },
  [USDC_MINT]: { symbol: "USDC", decimals: 6 },
};

function metaFallback(mint: string): TokenMeta {
  return { symbol: shortAddr(mint).toUpperCase(), decimals: 6 };
}

export async function getTokenMeta(mint: string): Promise<TokenMeta> {
  const cached = metaCache.get(mint);
  if (cached) return cached;
  const known = KNOWN_META[mint];
  if (known) {
    metaCache.set(mint, known);
    return known;
  }
  const fallback = metaFallback(mint);
  try {
    const res = await fetch(`https://tokens.jup.ag/token/${mint}`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "raven-terminal/1.0" },
    });
    if (!res.ok) {
      metaCache.set(mint, fallback);
      return fallback;
    }
    const j = (await res.json()) as {
      symbol?: string;
      decimals?: number;
    };
    const meta: TokenMeta = {
      symbol:
        typeof j.symbol === "string" && j.symbol
          ? j.symbol.trim().slice(0, 12).toUpperCase() || fallback.symbol
          : fallback.symbol,
      decimals:
        typeof j.decimals === "number" && j.decimals >= 0 && j.decimals <= 18
          ? j.decimals
          : 6,
    };
    metaCache.set(mint, meta);
    return meta;
  } catch {
    metaCache.set(mint, fallback);
    return fallback;
  }
}

// --- SOL/USD price (Jupiter Price API v3, free, no key) ---

let priceCache: { at: number; price: number } | null = null;
const PRICE_TTL_MS = 60_000;

export async function getSolPrice(): Promise<number | null> {
  if (priceCache && Date.now() - priceCache.at < PRICE_TTL_MS) {
    return priceCache.price;
  }
  try {
    const res = await fetch(
      `https://api.jup.ag/price/v3?ids=${WSOL_MINT}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return priceCache?.price ?? null;
    const j = (await res.json()) as {
      data?: Record<string, { price?: number }>;
    };
    const price = j.data?.[WSOL_MINT]?.price;
    if (typeof price === "number" && price > 0) {
      priceCache = { at: Date.now(), price };
      return price;
    }
    return priceCache?.price ?? null;
  } catch {
    return priceCache?.price ?? null;
  }
}
