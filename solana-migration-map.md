# Raven: Robinhood Chain → Solana Migration Map

**Status:** IMPLEMENTED 2026-10-07 (commit `cbca86e` on branch `solana`).
Data layer rewritten for pump.fun on Solana; all 4 API routes verified live
against mainnet. See commit message for details. Open questions §6 still
stand for Javin/Bobby (notably: Helius key provisioning, Robinhood
deployment fate, domain rename).

**Original planning status:** planning document, not implementation. Branch `solana` created 2026-10-06 (Bobby's call).
**Rule:** do not write migration code until this map is reviewed.

---

## 1. Current architecture (EVM) — read from the code

Raven is a Next.js 16 app. One stateless indexing engine (direct RPC polling, no DB) feeds three views via API routes. The frontend polls every 30s.

### 1.1 Data layer — `lib/`

| File | Role | EVM-specific dependencies |
|---|---|---|
| `lib/chain.ts` | RPC client + chain constants | `https://rpc.mainnet.chain.robinhood.com`, chain ID 4663; `eth_getLogs`, `eth_call`, `eth_blockNumber`, `eth_getBlockByNumber`, `eth_getTransactionReceipt`, JSON-RPC batching; `ROUTER = 0x65050a9b7e5075a2ba5ced7b1b64ee66262c40dc`; `SWAP_TOPIC`, `TRANSFER_TOPIC` (keccak event selectors); `addrFromTopic` (address = last 20 bytes of a 32-byte topic); `USDG = 0x5fc5360d…`, `WETH = 0x0bd7d3…`, `STABLES` set |
| `lib/tape.ts` | **Flow** — swap decoder | Scans 300 blocks of `Swap` logs from ROUTER + *all* `Transfer` logs chain-wide; correlates swaps↔transfers by tx hash + log-index proximity; trader = `eth_getTransactionReceipt.from` (router's indexed params are zero); token symbol/decimals via `eth_call` (`decimals()` = `0x313ce567`, `symbol()` = `0x95d89b41`, handles bytes32 fallback); buy/sell/swap classification via STABLES; $1B sanity backstop |
| `lib/graduation.ts` | **Today** — graduation calendar | `FACTORY = 0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e`; `TokenLaunched` logs enumerate launches (filtered to USDG pair); `getLaunchedToken(token)` (`0x3cf28b5a`) → word 5 = `graduationThreshold`, word 6 = `phase`; per-curve `CurveBuy`/`CurveSell` logs → progress = (Σ buy.w0 − Σ sell.w1) / threshold; `PoolGraduated` logs = the calendar; 5-min in-memory cache; measured avg block time for 24h velocity + timestamps |
| `lib/lookup.ts` | Token lookup (paste address → curve progress) | Same factory mechanics; resolves curve→token via launch logs; `PHASE_LABELS` (climbing/swept/pool created/rescued) |
| `lib/wallets.ts` | **Wallets** — activity leaderboard | Pure aggregation over tape entries: trades, buys, sells, quote-denominated volume, top token, last active; sorted by volume. No chain calls of its own |
| `lib/alerts.ts` | Client-side alert rules | Evaluated in-browser against polled data (graduation %, whale size, new launch); `EXPLORER = https://robinhoodchain.blockscout.com` for links |

### 1.2 API routes — `app/api/`

`tape`, `wallets`, `today`, `lookup` — thin wrappers, `force-dynamic`, `Cache-Control: no-store`. No auth, no DB.

### 1.3 UI — `components/` + `app/`

`TodayView`, `FlowTape`, `WalletsView`, `AlertsView` (+`AlertsContext`), `TokenLookup`, `ThemeToggle`, `raven-ui`; landing `app/page.tsx`; terminal `app/terminal/page.tsx` (4 tabs). **No wallet-connect code exists** — the site is explicitly "no wallet · no signup · reads straight from public RPC". (Memory once mentioned SIWE; it is not in the codebase.)

### 1.4 Chain-specific surface (everything that must change)

- RPC endpoint, chain ID, all contract addresses, all event topics, `eth_*` RPC methods
- Address format (`0x…` → base58), decimals handling (per-token `decimals()` → SPL mint decimals)
- Quote assets (USDG/WETH → SOL/USDC)
- Trader identity (tx receipt `from` → tx `accountKeys[0]` fee payer)
- Timestamps (measured avg block time → `getBlockTime`, slots ~400ms)
- Explorer links (Blockscout → Solscan)
- Landing/metadata copy ("Robinhood Chain" ×7 in `app/page.tsx` + `app/layout.tsx`)
- `TokenLookup` placeholder/validation (`0x…` address regex)

---

## 2. Solana equivalents (per data source)

### 2.1 Chain client (`lib/chain.ts` → `lib/solana.ts`)

| EVM | Solana |
|---|---|
| `https://rpc.mainnet.chain.robinhood.com` | Solana mainnet-beta RPC (public, or Helius/QuickNode RPC for reliability) |
| `eth_getLogs` / topics | **No log filtering by topic.** Options: `getSignaturesForAddress` (per-account history), `logsSubscribe` websocket (real-time program logs), or Helius webhooks (push) |
| `eth_call` | `getAccountInfo` / `getMultipleAccountsInfo` (read program accounts directly) |
| `eth_getTransactionReceipt` → trader | Transaction `accountKeys[0]` = fee payer = trader (no extra call needed) |
| `eth_getBlockByNumber` → timestamp | `getBlockTime(slot)` — exact, no estimation hack needed |
| Address `0x…` | Base58 pubkey |

**Verified program IDs (2026-10-06):**
| Program | ID | Role |
|---|---|---|
| pump.fun bonding curve | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Token creation, bonding-curve buy/sell — the Pons-factory equivalent |
| PumpSwap AMM | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Post-graduation pools (graduated tokens trade here) |
| Metaplex Token Metadata | `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x4s` | Token name/symbol/URI (replaces `symbol()` eth_call) |
| SPL Token | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` | Mint decimals (replaces `decimals()` eth_call) |

### 2.2 Today / graduation (`lib/graduation.ts`)

| EVM (Pons) | Solana (pump.fun) |
|---|---|
| `TokenLaunched` factory event → enumerate launches | `CreateEvent` on the pump program → new launches (via Helius webhook or `getSignaturesForAddress` on the program) |
| `getLaunchedToken(token)` → phase + `graduationThreshold` | Read the **BondingCurve PDA** account directly: `complete: bool` = graduated; virtual reserves give progress |
| Progress = (Σ CurveBuy.w0 − Σ CurveSell.w1) / threshold (USDG raised) | Progress = market cap / ~$69k graduation line, **or** SOL in curve / graduation threshold. ⚠️ Verify exact semantics: pump.fun graduation is market-cap-based (~$69,420), not a fixed SOL number |
| `PoolGraduated` factory event → calendar | `CompleteEvent` on the pump program, or the `migrate` instruction → graduated list |
| 24h velocity from CurveBuy logs | 24h buy volume from `TradeEvent` logs |
| Quote asset: USDG (6 dec) | ⚠️ **Decision needed:** pump.fun V2 added **USDC quote-mint** support — curves can be SOL- or USDC-denominated. Track both or SOL-only? |

### 2.3 Flow / tape (`lib/tape.ts`)

| EVM | Solana |
|---|---|
| Single router (`0x6505…`) emits all `Swap` events | **No single router.** Two realistic paths: |
| Chain-wide `Transfer` correlation by tx hash + log proximity | **(A) Bonding-curve flow:** `TradeEvent` on the pump program already carries mint, solAmount, tokenAmount, isBuy, user, timestamp — *no correlation needed*, strictly simpler than EVM |
| Trader from tx receipt | Trader = `TradeEvent.user` or tx fee payer |
| Token meta via `eth_call` | Token meta via Metaplex metadata PDA **or** Jupiter Token API (free, no key) / Birdeye (key) |
| Buy/sell via USDG/WETH legs | Buy/sell via SOL/USDC legs (`isBuy` flag exists directly on TradeEvent) |
| | **(B) Broad DEX flow:** Helius Enhanced Transactions API or Birdeye trade APIs for non-pump swaps (Jupiter aggregator, Raydium). Needed only if Flow should cover more than memecoin curves |

### 2.4 Wallets (`lib/wallets.ts`)

Logic transfers almost as-is: aggregate flow entries → trades/buys/sells/volume/top-token/last-active. Changes: base58 addresses, quote assets SOL/USDC, volume in SOL or USD (needs a SOL price feed — Jupiter Price API is free). "Smart-wallet" depth (currently activity-only, honestly labeled) could later use Birdeye trader endpoints.

### 2.5 Lookup (`lib/lookup.ts`)

Paste a mint address (base58, not `0x…`) → fetch its BondingCurve PDA → progress/phase. Curve→token resolution becomes trivial (the PDA links both). Phase labels need re-mapping (`complete` flag → graduated; pre-migration states).

### 2.6 Alerts (`lib/alerts.ts`)

Rule engine transfers as-is (pure functions over `NearGraduation`/`TapeEntry` shapes — keep those interfaces stable). Only `EXPLORER` changes: Blockscout → `https://solscan.io`.

---

## 3. What transfers vs what gets rewritten

**Transfers as-is (no chain logic):**
- All four views' components (`TodayView`, `FlowTape`, `WalletsView`, `AlertsView`) — they render `NearGraduation`, `TapeEntry`, `WalletStats` shapes; keep the interfaces, swap the suppliers
- `TokenLookup` UI shell (validation regex changes)
- Alerts engine + context (pure logic; only explorer URL changes)
- Theme, brand, landing structure, terminal tab shell
- API route *shape* (`/api/tape`, `/api/wallets`, `/api/today`, `/api/lookup`) — same URLs, same JSON shapes

**Must be rewritten:**
- `lib/chain.ts` → Solana RPC client (or Helius client)
- `lib/tape.ts` → TradeEvent-based flow builder (simpler than EVM — no transfer correlation)
- `lib/graduation.ts` → BondingCurve-PDA-based graduation tracker
- `lib/lookup.ts` → mint-based lookup
- `lib/wallets.ts` → minor (address format, quote assets, SOL price)
- Landing/metadata copy (7+ "Robinhood Chain" references)
- Explorer links (Blockscout → Solscan)

**New infrastructure (doesn't exist today):**
- Helius API key management (currently zero env vars; "Deploy — no environment variables needed" breaks)
- If webhooks: a receiving endpoint + persistence (Upstash Redis or Postgres) — the current design is stateless RPC polling; webhooks need a store
- SOL/USD price feed (Jupiter Price API, free)

---

## 4. Recommended Solana data stack

| Layer | Choice | Why |
|---|---|---|
| **Primary data** | **Helius** — webhooks on the pump program (`CreateEvent`/`TradeEvent`/`CompleteEvent`) + Enhanced Transactions API for backfill | Single source for all three views; parsed events (no manual Anchor deserialization); webhooks = true real-time for the "tab that never closes" |
| **Token metadata fallback** | **Jupiter Token API v2** (free, no key) | Name/symbol/decimals without PDA math; Birdeye as backup (needs key) |
| **SOL price** | **Jupiter Price API** (free) | Quote-volume in USD for the Wallets view |
| **RPC** | Helius RPC (comes with the key) or public mainnet-beta | Reliability; public RPC is rate-limited |
| **Client lib** | `@solana/web3.js` | Still the most documented; `@solana/kit` is the future but thinner docs — revisit |
| **pump.fun math** | `@pump-fun/pump-sdk` or manual PDA derivation | BondingCurve PDA derivation + reserve math; verify against onchain state |
| **State (if webhooks)** | Upstash Redis | Webhook ingestion needs somewhere to land; Redis fits the ephemeral tape/today-cache model |
| **Explorer links** | Solscan (`https://solscan.io/tx/…`, `/token/…`) | Standard Solana explorer |

**Why Helius over alternatives:** Birdeye is excellent for *token-centric* data (price, trades per token) but Raven is *program-centric* (all launches, all curve trades) — Helius webhooks on the pump program match the current `eth_getLogs`-on-factory/router architecture 1:1. Shyft is a credible alternative; QuickNode Streams likewise. Helius has the most mature pump.fun parsing.

**Uncertainties (verify before building):**
- Exact pump.fun graduation semantics (market-cap vs SOL threshold) — check a live BondingCurve account
- `TradeEvent`/`CreateEvent`/`CompleteEvent` field layouts — confirm via Helius parsed tx or IDL
- Helius free-tier webhook/credit limits vs Raven's poll cadence
- Whether PumpSwap AMM (`pAMM…`) flow should be included in Flow or out of scope

---

## 5. Phased plan

**Phase 1 — Foundation** (`lib/solana.ts`, constants)
Replace `lib/chain.ts`: Solana RPC client, program IDs, quote-asset set (SOL/USDC), base58 helpers, `getBlockTime` timestamps, token metadata via Jupiter/Metaplex. Keep the exported *shape* similar (a `getRecent…`-style surface) so API routes barely change. Token-metadata cache ports directly.

**Phase 2 — Today (graduation)**
BondingCurve-PDA tracker: enumerate recent `CreateEvent`s, read curve accounts (`complete` flag, reserves), compute progress + 24h velocity, `CompleteEvent` calendar. Keep `NearGraduation`/`Graduation` interfaces identical → `TodayView` untouched. Resolve the SOL-vs-USDC quote question first.

**Phase 3 — Flow (tape)**
`TradeEvent` ingestion → `TapeEntry` (same interface: txHash→signature, blockNumber→slot, trader, direction via `isBuy`, amounts). Start with polling (`getSignaturesForAddress` + `getTransaction` batch, or Helius Enhanced Transactions); graduate to webhooks if latency matters. `FlowTape` untouched.

**Phase 4 — Wallets**
Re-point aggregation at the new tape; base58 addresses; SOL/USD volumes via Jupiter price. `WalletsView` untouched.

**Phase 5 — Cutover polish**
Alerts explorer → Solscan; landing copy (`app/page.tsx`, `app/layout.tsx`); lookup validation → base58; 5-min Today cache → keep or Redis; rate-limit/backoff behavior re-tuned for Helius; decide the Robinhood deployment's fate (sunset vs dual-run).

**Build order rationale:** Today first (it's the differentiated view — graduation calendar is Raven's moat), then Flow (largest volume, simplest per-event shape), then Wallets (pure function of Flow).

---

## 6. Open questions (need Javin/Bobby)

1. **Scope of launches:** pump.fun only, or also Raydium LaunchLab / letsbonk.fun / Jupiter Studio? (Each is a different program = different ingestion.)
2. **Quote assets:** SOL-denominated curves only, or include USDC-quoted (pump.fun V2)? 
3. **Graduation definition:** pump.fun → PumpSwap migration only, or track Raydium migrations too?
4. **Data architecture:** keep the current stateless polling model (Helius/Birdeye REST per request, costs credits per poll) or move to webhooks + Redis/Postgres (real-time, new infra)?
5. **Helius key:** who provisions and pays? Free tier vs growth — check limits against a 30s poll × 3 views.
6. **Robinhood version:** sunset it, freeze it, or run both chains side-by-side (tabs? toggle)?
7. **Branding/domain:** `raven-hood.site` is Robinhood-branded — rename for Solana?
8. **Wallet connect:** still "no wallet, no signup", or add Solana wallet adapter now that it's a rewrite? (No connect code exists today.)
9. **Alerts:** keep the three client-side rules, or expand (e.g., graduation alerts need the new semantics)?
10. **Timeline/owner:** who builds — Javin, the TPS team, or Kirasa? (Affects Phase 1 library choice: `@solana/web3.js` for familiarity vs `@solana/kit`.)

---

*Sources checked 2026-10-06: pump.fun program IDs verified against multiple protocol references (bonding curve `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`, PumpSwap AMM `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`); graduation ≈ $69k market cap; pump.fun V2 USDC quote-mint support noted. Event layouts (`TradeEvent`/`CreateEvent`/`CompleteEvent`) and exact graduation semantics should be confirmed against a live transaction before implementation.*
