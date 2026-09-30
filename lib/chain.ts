/**
 * Chain constants + tiny RPC client for Raven.
 *
 * Reads straight from the Robinhood Chain RPC — no Blockscout dependency
 * (its API is Cloudflare-challenged for server-side calls).
 */

export const RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
export const CHAIN_ID = 4663;

/** Pons router: every swap on the chain flows through here. */
export const ROUTER = "0x65050a9b7e5075a2ba5ced7b1b64ee66262c40dc";

/** Quote assets — a swap touching one of these is a buy/sell, not a swap. */
export const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
export const WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
export const STABLES = new Set([USDG.toLowerCase(), WETH.toLowerCase()]);

export const SWAP_TOPIC =
  "0x8619026a40d38bedb4002fe511cea4bc4a9b336710efe8f21a61869a7ee0f02a";
export const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36";

export interface RpcLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
}

export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`RPC ${method} failed: ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(`RPC ${method} error: ${json.error.message}`);
  return json.result as T;
}

export async function rpcBatch<T>(
  calls: { method: string; params: unknown[] }[],
): Promise<(T | null)[]> {
  const body = calls.map((c, i) => ({
    jsonrpc: "2.0",
    id: i,
    method: c.method,
    params: c.params,
  }));
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`RPC batch failed: ${res.status}`);
  const json = (await res.json()) as { id: number; result?: T }[];
  const out: (T | null)[] = new Array(calls.length).fill(null);
  for (const r of json) {
    if (r.id >= 0 && r.id < out.length) out[r.id] = r.result ?? null;
  }
  return out;
}

export async function getLogs(
  fromBlock: number,
  toBlock: number,
  address: string | null,
  topics: string[],
): Promise<RpcLog[]> {
  const filter: Record<string, unknown> = {
    fromBlock: "0x" + fromBlock.toString(16),
    toBlock: "0x" + toBlock.toString(16),
    topics,
  };
  if (address) filter.address = address;
  return rpc<RpcLog[]>("eth_getLogs", [filter]);
}

export async function getLatestBlock(): Promise<number> {
  const hex = await rpc<string>("eth_blockNumber", []);
  return parseInt(hex, 16);
}

export function addrFromTopic(topic: string): string {
  return ("0x" + topic.slice(-40)).toLowerCase();
}

export function hexToBigInt(hex: string): bigint {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!clean) return BigInt(0);
  return BigInt("0x" + clean);
}
