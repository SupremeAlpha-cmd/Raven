/**
 * Raven alerts: configurable notification rules evaluated against the data
 * the terminal already fetches (no new data sources, no backend).
 *
 * Rule types (MVP — three, deliberately not a rules engine):
 *  - graduation: a token crosses X% graduation progress (Today data)
 *  - whale:      a single buy/sell above X USDG (Flow tape data)
 *  - launch:     a new token launch appears on the curves (Today data)
 *
 * Rules + fired alerts + dedup state persist in localStorage. The engine
 * is pure: evaluate() takes the latest poll results and the persistent
 * dedup sets, and returns newly fired alerts.
 */

import type { NearGraduation } from "./graduation";
import type { TapeEntry } from "./tape";

export type AlertRuleType = "graduation" | "whale" | "launch";

export interface AlertRule {
  id: string;
  type: AlertRuleType;
  /** graduation: percent (0-100). whale: USDG amount. launch: unused. */
  threshold: number;
  enabled: boolean;
}

export interface FiredAlert {
  id: string;
  ruleId: string;
  type: AlertRuleType;
  title: string;
  detail: string;
  link: string | null;
  firedAt: number; // ms epoch
}

export const EXPLORER = "https://robinhoodchain.blockscout.com";
export const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";

const LS_RULES = "raven:alert-rules";
const LS_KEYS = "raven:alert-keys";
const LS_FEED = "raven:alert-feed";
const LS_SEEN = "raven:alert-seen-tokens";
const FEED_CAP = 50;

export const RULE_META: Record<
  AlertRuleType,
  {
    label: string;
    hint: string;
    unit: string;
    defaultThreshold: number;
    needsThreshold: boolean;
  }
> = {
  graduation: {
    label: "Graduation crossing",
    hint: "Fire when a token's curve progress crosses this %",
    unit: "%",
    defaultThreshold: 90,
    needsThreshold: true,
  },
  whale: {
    label: "Whale trade",
    hint: "Fire on a single buy or sell at/above this USDG size",
    unit: "USDG",
    defaultThreshold: 1000,
    needsThreshold: true,
  },
  launch: {
    label: "New launch",
    hint: "Fire when a new token appears on the bonding curves",
    unit: "",
    defaultThreshold: 0,
    needsThreshold: false,
  },
};

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function defaultRules(): AlertRule[] {
  return [
    { id: uid("rule"), type: "graduation", threshold: 90, enabled: true },
    { id: uid("rule"), type: "whale", threshold: 1000, enabled: true },
    { id: uid("rule"), type: "launch", threshold: 0, enabled: true },
  ];
}

/** USDG value of a tape entry, or null when neither leg is USDG. */
export function usdgValue(e: TapeEntry): number | null {
  const inIsUsdg = e.tokenIn.toLowerCase() === USDG;
  const outIsUsdg = e.tokenOut.toLowerCase() === USDG;
  if (!inIsUsdg && !outIsUsdg) return null;
  const raw = inIsUsdg ? e.amountInRaw : e.amountOutRaw;
  const decimals = inIsUsdg ? e.amountInDecimals : e.amountOutDecimals;
  try {
    return Number(BigInt(raw)) / 10 ** decimals;
  } catch {
    return null;
  }
}

function fmtUsdg(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}

/**
 * Evaluate graduation + whale rules against fresh poll data.
 * firedKeys is the persistent dedup set (mutated in place):
 *  - graduation keys re-arm when progress falls 5 points below threshold
 *  - whale keys are per-txHash and never re-arm
 */
export function evaluateAlerts(
  rules: AlertRule[],
  nearing: NearGraduation[],
  entries: TapeEntry[],
  firedKeys: Set<string>,
): FiredAlert[] {
  const out: FiredAlert[] = [];
  const now = Date.now();

  for (const rule of rules) {
    if (!rule.enabled) continue;

    if (rule.type === "graduation") {
      for (const t of nearing) {
        const pct = t.progress * 100;
        const key = `grad:${rule.id}:${t.token.toLowerCase()}`;
        if (pct >= rule.threshold) {
          if (!firedKeys.has(key)) {
            firedKeys.add(key);
            out.push({
              id: uid("alert"),
              ruleId: rule.id,
              type: "graduation",
              title: `$${t.symbol} crossed ${rule.threshold}% graduation`,
              detail: `now at ${pct.toFixed(1)}% — ${fmtUsdg(t.raised)} / ${fmtUsdg(t.threshold)} USDG raised`,
              link: `${EXPLORER}/token/${t.token}`,
              firedAt: now,
            });
          }
        } else if (pct < rule.threshold - 5) {
          firedKeys.delete(key); // re-arm if it dips back down
        }
      }
    }

    if (rule.type === "whale") {
      for (const e of entries) {
        if (e.direction !== "buy" && e.direction !== "sell") continue;
        const v = usdgValue(e);
        if (v === null || v < rule.threshold) continue;
        const key = `whale:${e.txHash}`;
        if (!firedKeys.has(key)) {
          firedKeys.add(key);
          const token =
            e.direction === "buy" ? e.tokenOutSymbol : e.tokenInSymbol;
          out.push({
            id: uid("alert"),
            ruleId: rule.id,
            type: "whale",
            title: `Whale ${e.direction}: ${fmtUsdg(v)} USDG on $${token}`,
            detail: `${e.amountIn} ${e.tokenInSymbol} → ${e.amountOut} ${e.tokenOutSymbol}`,
            link: `${EXPLORER}/tx/${e.txHash}`,
            firedAt: now,
          });
        }
      }
    }
  }

  return out;
}

/**
 * Detect launches the user hasn't seen before.
 * Pass seeded=false on the very first poll so the existing list is
 * recorded silently instead of firing for every token at once.
 */
export function detectLaunches(
  nearing: NearGraduation[],
  seen: Set<string>,
  seeded: boolean,
): FiredAlert[] {
  const out: FiredAlert[] = [];
  const now = Date.now();
  for (const t of nearing) {
    const k = t.token.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    if (seeded) {
      out.push({
        id: uid("alert"),
        ruleId: "launch",
        type: "launch",
        title: `New launch: $${t.symbol}`,
        detail: `bonding curve at ${(t.progress * 100).toFixed(1)}% — ${fmtUsdg(t.raised)} USDG raised so far`,
        link: `${EXPLORER}/token/${t.token}`,
        firedAt: now,
      });
    }
  }
  return out;
}

// ---------- localStorage persistence (client-only, failure-safe) ----------

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — alerts still work for this session
  }
}

export function loadRules(): AlertRule[] | null {
  const r = read<AlertRule[] | null>(LS_RULES, null);
  return Array.isArray(r) ? r : null;
}
export function saveRules(rules: AlertRule[]): void {
  write(LS_RULES, rules);
}
export function loadKeys(): Set<string> {
  return new Set(read<string[]>(LS_KEYS, []));
}
export function saveKeys(keys: Set<string>): void {
  write(LS_KEYS, [...keys]);
}
export function loadFeed(): FiredAlert[] {
  const f = read<FiredAlert[]>(LS_FEED, []);
  return Array.isArray(f) ? f.slice(0, FEED_CAP) : [];
}
export function saveFeed(feed: FiredAlert[]): void {
  write(LS_FEED, feed.slice(0, FEED_CAP));
}
export function loadSeenTokens(): Set<string> {
  return new Set(read<string[]>(LS_SEEN, []));
}
export function saveSeenTokens(seen: Set<string>): void {
  write(LS_SEEN, [...seen]);
}
