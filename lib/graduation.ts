/**
 * Today slice: the graduation calendar.
 *
 * Reads Pons launch mechanics straight from the chain (see
 * forensics/graduation.md):
 *  - TokenLaunched on the factory enumerates bonding-curve launches
 *  - getLaunchedToken(token) gives phase + graduationThreshold
 *  - progress = (Σ CurveBuy.w0 − Σ CurveSell.w1) / threshold  (quote raised)
 *  - PoolGraduated on the factory = the graduation calendar itself
 *
 * Results are cached in-memory for 5 minutes — a full scan is dozens of
 * RPC calls and graduations move slowly.
 */

import {
  USDG,
  addrFromTopic,
  getLatestBlock,
  getLogs,
  hexToBigInt,
  rpc,
  rpcBatch,
} from "./chain";
import { getTokenMeta } from "./tape";

export const FACTORY = "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e";
const TOKEN_LAUNCHED_TOPIC =
  "0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607";
const POOL_GRADUATED_TOPIC =
  "0x0a44ef75df69c534f43cd6c1aa3ef8983065fe5fe79ef9e79f6494e6f258c259";
const CURVE_BUY_TOPIC =
  "0xec36bf571f136799e8dc0b0b8bea4b04d8bd3d43de838aab0d5fc21d4cbfc455";
const CURVE_SELL_TOPIC =
  "0x8113d738abdcb6b38357e9d53a54a7157861a09031b453651f0fe7fe151f59df";
const GET_LAUNCHED_TOKEN = "0x3cf28b5a"; // getLaunchedToken(address)

const SCAN_BLOCKS = 200_000; // launch + graduation lookback
const MAX_CURVES = 25; // per-scan cap; most recent launches first
const CACHE_TTL_MS = 5 * 60_000;

export interface NearGraduation {
  token: string;
  symbol: string;
  curve: string;
  progress: number; // 0..1
  raised: number; // USDG
  threshold: number; // USDG
  velocity24h: number; // USDG of buys in the last 24h
}

export interface Graduation {
  token: string;
  symbol: string;
  blockNumber: number;
  timestamp: number;
  pairAmount: number; // in pair-token units
  pair: "USDG" | "native";
}

function word(data: string, i: number): bigint {
  const clean = data.startsWith("0x") ? data.slice(2) : data;
  return hexToBigInt("0x" + clean.slice(i * 64, (i + 1) * 64));
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

async function buildToday(): Promise<{
  nearing: NearGraduation[];
  graduated: Graduation[];
}> {

  const latest = await getLatestBlock();
  const from = Math.max(0, latest - SCAN_BLOCKS);

  // Measured block time (don't assume).
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
  const tsFor = (block: number) =>
    Math.round(parseInt(bLatest.timestamp, 16) - (latest - block) * avgBlockTime);

  // 1. Enumerate launches.
  const launchLogs = await getLogs(from, latest, FACTORY, [TOKEN_LAUNCHED_TOPIC]);
  const launches = launchLogs
    .map((l) => ({
      token: addrFromTopic(l.topics[1]),
      curve: addrFromTopic(l.topics[2]),
      pairToken: ("0x" + word(l.data, 0).toString(16).padStart(40, "0")).toLowerCase(),
      blockNumber: parseInt(l.blockNumber, 16),
    }))
    .filter((l) => l.pairToken === USDG.toLowerCase())
    .sort((a, b) => b.blockNumber - a.blockNumber);

  // 2. Keep only ungraduated (phase 0), most recent first.
  // Phase checks go out in small chunks — the RPC 429s large batches.
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const infos: ({ phase: number; threshold: bigint } | null)[] = [];
  for (let i = 0; i < launches.length; i += 20) {
    const chunk = launches.slice(i, i + 20);
    // Raw struct: word 5 = graduationThreshold, word 6 = phase.
    const res = await rpcBatch<string>(
      chunk.map((l) => ({
        method: "eth_call",
        params: [
          {
            to: FACTORY,
            data: GET_LAUNCHED_TOKEN + "0".repeat(24) + l.token.slice(2),
          },
          "latest",
        ],
      })),
    );
    infos.push(
      ...res.map((r) =>
        !r || r === "0x"
          ? null
          : { threshold: word(r, 5), phase: Number(word(r, 6)) },
      ),
    );
    if (i + 20 < launches.length) await sleep(400);
  }
  const active = launches
    .map((l, i) => ({ ...l, info: infos[i] }))
    .filter((l) => l.info && l.info.phase === 0)
    .slice(0, MAX_CURVES);

  // 3. Progress + velocity per curve.
  const nearing: NearGraduation[] = [];
  for (const l of active) {
    const [buys, sells] = await Promise.all([
      getLogs(l.blockNumber, latest, l.curve, [CURVE_BUY_TOPIC]),
      getLogs(l.blockNumber, latest, l.curve, [CURVE_SELL_TOPIC]),
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
    const threshold = l.info!.threshold;
    if (threshold === BigInt(0)) continue;
    const meta = await getTokenMeta(l.token);
    nearing.push({
      token: l.token,
      symbol: meta.symbol,
      curve: l.curve,
      progress: Number((raised * BigInt(10_000)) / threshold) / 10_000,
      raised: Number(raised) / 1e6,
      threshold: Number(threshold) / 1e6,
      velocity24h: Number(velSum) / 1e6,
    });
  }
  nearing.sort((a, b) => b.progress - a.progress);

  // 4. Recent graduations (USDG and native pairs, labeled honestly).
  const gradLogs = await getLogs(from, latest, FACTORY, [POOL_GRADUATED_TOPIC]);
  const gradTokens = gradLogs.map((g) => addrFromTopic(g.topics[1]));
  const pairTokens: (string | null)[] = [];
  for (let i = 0; i < gradTokens.length; i += 20) {
    const chunk = gradTokens.slice(i, i + 20);
    const res = await rpcBatch<string>(
      chunk.map((t) => ({
        method: "eth_call",
        params: [
          {
            to: FACTORY,
            data: GET_LAUNCHED_TOKEN + "0".repeat(24) + t.slice(2),
          },
          "latest",
        ],
      })),
    );
    pairTokens.push(
      ...res.map((r) =>
        !r || r === "0x"
          ? null
          : "0x" + word(r, 4).toString(16).padStart(40, "0"),
      ),
    );
    if (i + 20 < gradTokens.length) await sleep(400);
  }
  const graduated: Graduation[] = [];
  for (let i = 0; i < gradLogs.length; i++) {
    const g = gradLogs[i];
    const token = gradTokens[i];
    const pair = pairTokens[i];
    const isUsdg = pair?.toLowerCase() === USDG.toLowerCase();
    const raw = word(g.data, 2);
    const meta = await getTokenMeta(token);
    graduated.push({
      token,
      symbol: meta.symbol,
      blockNumber: parseInt(g.blockNumber, 16),
      timestamp: tsFor(parseInt(g.blockNumber, 16)),
      pairAmount: Number(raw) / (isUsdg ? 1e6 : 1e18),
      pair: isUsdg ? "USDG" : "native",
    });
  }
  graduated.sort((a, b) => b.blockNumber - a.blockNumber);

  return { nearing, graduated: graduated.slice(0, 20) };
}
