/**
 * Token lookup slice: paste a token (or curve) address, see how far its
 * bonding curve has gone.
 *
 * Reads Pons launch mechanics straight from the chain (see
 * forensics/graduation.md and lib/graduation.ts):
 *  - getLaunchedToken(token) → word 1 = curve, word 5 = graduationThreshold,
 *    word 6 = phase
 *  - progress = (Σ CurveBuy.w0 − Σ CurveSell.w1) / threshold  (quote raised)
 *
 * Honest boundaries: only USDG-paired curves get a progress number (that's
 * Raven's whole graduation framing); non-Pons addresses return found:false;
 * graduated tokens report their phase instead of a fake progress.
 */

import {
  CURVE_BUY_TOPIC,
  CURVE_SELL_TOPIC,
  FACTORY,
  GET_LAUNCHED_TOKEN,
  TOKEN_LAUNCHED_TOPIC,
  word,
  type NearGraduation,
} from "./graduation";
import { USDG, addrFromTopic, getLatestBlock, getLogs, rpc } from "./chain";
import { getTokenMeta } from "./tape";

// The RPC caps eth_getLogs at 10M blocks per request — one call covers any
// realistic curve age.
const TAPE_LOOKBACK = 10_000_000;

export const PHASE_LABELS: Record<number, string> = {
  0: "climbing",
  1: "swept",
  2: "pool created",
  3: "rescued",
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

interface LaunchInfo {
  token: string;
  curve: string;
  threshold: bigint;
  phase: number;
  pairToken: string;
}

async function launchedTokenCall(token: string): Promise<LaunchInfo | null> {
  const res = await rpc<string>("eth_call", [
    {
      to: FACTORY,
      data: GET_LAUNCHED_TOKEN + "0".repeat(24) + token.slice(2).toLowerCase(),
    },
    "latest",
  ]);
  if (!res || res === "0x") return null;
  const threshold = word(res, 5);
  if (threshold === BigInt(0)) return null; // not a Pons launch
  return {
    token: token.toLowerCase(),
    curve: ("0x" + word(res, 1).toString(16).padStart(40, "0")).toLowerCase(),
    threshold,
    phase: Number(word(res, 6)),
    pairToken: ("0x" + word(res, 4).toString(16).padStart(40, "0")).toLowerCase(),
  };
}

/** Resolve a curve address back to its token via the launch log. */
async function tokenForCurve(
  curve: string,
  latest: number,
): Promise<string | null> {
  const from = Math.max(0, latest - TAPE_LOOKBACK);
  const logs = await getLogs(from, latest, FACTORY, [
    TOKEN_LAUNCHED_TOPIC,
    null,
    "0x" + "0".repeat(24) + curve.slice(2).toLowerCase(),
  ]);
  if (logs.length === 0) return null;
  logs.sort(
    (a, b) => parseInt(b.blockNumber, 16) - parseInt(a.blockNumber, 16),
  );
  return addrFromTopic(logs[0].topics[1]);
}

export async function lookupToken(raw: string): Promise<LookupResult> {
  const address = raw.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    throw new Error("not an address — paste a 0x contract address");
  }

  // 1. Token first, curve second.
  let info = await launchedTokenCall(address);
  if (!info) {
    const latest = await getLatestBlock();
    const token = await tokenForCurve(address, latest);
    if (!token) return { found: false };
    info = await launchedTokenCall(token);
    if (!info) return { found: false };
  }

  const meta = await getTokenMeta(info.token);

  // 2. Graduated (or otherwise past phase 0): report the phase, no fake curve.
  if (info.phase !== 0) {
    return {
      found: true,
      graduated: true,
      token: info.token,
      symbol: meta.symbol,
      phase: info.phase,
      phaseLabel: PHASE_LABELS[info.phase] ?? `phase ${info.phase}`,
    };
  }

  // 3. Only USDG pairs get a progress number — that's Raven's graduation math.
  if (info.pairToken !== USDG.toLowerCase()) {
    throw new Error("not a USDG curve — Raven only tracks USDG graduations");
  }

  // 4. Progress from the curve's own tape, same math as the Today scan.
  const latest = await getLatestBlock();
  const from = Math.max(0, latest - TAPE_LOOKBACK);
  const [bLatest, bOld] = await Promise.all([
    rpc<{ timestamp: string }>("eth_getBlockByNumber", ["latest", false]),
    rpc<{ timestamp: string }>("eth_getBlockByNumber", [
      "0x" + (latest - 1000).toString(16),
      false,
    ]),
  ]);
  const avgBlockTime = Math.max(
    1,
    (parseInt(bLatest.timestamp, 16) - parseInt(bOld.timestamp, 16)) / 1000,
  );
  const blocks24h = Math.round(86400 / avgBlockTime);

  const [buys, sells] = await Promise.all([
    getLogs(from, latest, info.curve, [CURVE_BUY_TOPIC]),
    getLogs(from, latest, info.curve, [CURVE_SELL_TOPIC]),
  ]);
  let buySum = BigInt(0);
  let velSum = BigInt(0);
  for (const b of buys) {
    const w0 = word(b.data, 0);
    buySum += w0;
    if (parseInt(b.blockNumber, 16) >= latest - blocks24h) velSum += w0;
  }
  let sellSum = BigInt(0);
  for (const s of sells) sellSum += word(s.data, 1);
  const raised = buySum - sellSum;

  return {
    found: true,
    graduated: false,
    token: info.token,
    symbol: meta.symbol,
    curve: info.curve,
    progress: Number((raised * BigInt(10_000)) / info.threshold) / 10_000,
    raised: Number(raised) / 1e6,
    threshold: Number(info.threshold) / 1e6,
    velocity24h: Number(velSum) / 1e6,
  };
}
