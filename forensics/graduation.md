# Pons graduation mechanics — chain forensics

Robinhood Chain (4663). All verified on-chain 2026-09-30. RPC: `https://rpc.mainnet.chain.robinhood.com` (send `User-Agent: Mozilla/5.0`).

## Contracts

| Role | Address | Notes |
|---|---|---|
| `PonsV2LaunchDeployer` | `0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42` | Verified. Thin wrapper; `factory()` → the real factory |
| `PonsV2LaunchFactory` | `0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e` | Verified, full ABI on Blockscout. Emits all launch/graduation events |
| Example curve (LYNX) | `0xef6831539d09ee0b0c90ad507691b21e142341b4` | Not verified; 46 selectors, not a proxy |

## 1. Factory & creation event

Each launch deploys a fresh token + bonding-curve pair. The factory emits:

```
event TokenLaunched(
  address indexed token,
  address indexed curve,
  address indexed deployer,
  address pairToken,
  uint256 launchConfigId,
  uint256 graduationThreshold
)
topic0 = 0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607
```

This is the token enumeration feed for the Today tab: filter `address == factory`,
`topic0 == TokenLaunched`, `pairToken == USDG` for the USDG market (157 launches in a recent 300k-block window; native-paired launches use `pairToken == 0x0`).

## 2. What graduation is

**A net-raised threshold in quote tokens — not supply-sold.**

- USDG pairs: `graduationThreshold = 8,090,000,000` raw = **8,090 USDG** (6 decimals)
- Native pairs: `graduationThreshold = 4.2e18` = **4.2 native**
- Also readable per token: `getLaunchedToken(token)` → `graduationThreshold` (selector `0x3cf28b5a`), or global default: `pairTokenEconomics(pairToken)` → `(phantomQuote, graduationThreshold, decimals)` (selector `0x31082134`)
- `pairTokenEconomics(USDG)` = `(3,236,000,000 phantom, 8,090,000,000 threshold, 6 decimals)` — phantomQuote is virtual liquidity for pricing, not part of the threshold

Phase enum (`getLaunchedToken(token).phase`, uint8): `0 = NotGraduated, 1 = Swept, 2 = PoolCreated, 3 = Rescued`.
`graduate(token)` requires phase 0 and `curve.readyToGraduate()`. The pons site frames it as "tokens still climbing toward graduation" (no numeric threshold published — chain is source of truth).

## 3. Graduation event

```
event PoolGraduated(
  address indexed token,
  uint256 positionId,
  uint256 tokenAmount,
  uint256 pairTokenAmount
)
topic0 = 0x0a44ef75df69c534f43cd6c1aa3ef8983065fe5fe79ef9e79f6494e6f258c259
```

Emitted by the factory. 213 graduations in the last ~2M blocks. Observed a USDG graduation seeding `pairTokenAmount = 8090.00` — exactly the threshold, confirming threshold semantics.

Related: `LaunchSwept(address indexed token, uint256 quoteOut, uint256 tokenOut)`, topic `0xcdb72f157fd3666758a6ce201387ffb52038c7562e4fff352828da1096c4b6b4`.

## 4. Progress computation (exact recipe)

Curve trade events (emitted by each per-token curve contract):

```
event CurveBuy(address,address,uint256,uint256,uint256,uint256)
topic0 = 0xec36bf571f136799e8dc0b0b8bea4b04d8bd3d43de838aab0d5fc21d4cbfc455
  data w0 = quoteIn  (pair-token raw units — USDG 6 decimals)

event CurveSell(address,address,uint256,uint256,uint256,uint256)
topic0 = 0x8113d738abdcb6b38357e9d53a54a7157861a09031b453651f0fe7fe151f59df
  data w1 = quoteOut (pair-token raw units)
```

**Formula:**

```
raised   = Σ CurveBuy.w0  −  Σ CurveSell.w1      (over curve lifetime, from its creation block)
progress = raised / graduationThreshold
```

Per token you need: 2× `eth_getLogs` (buys + sells on the curve, from launch block → latest) + 1× `eth_call getLaunchedToken(token)` (threshold + phase; skip phase ≠ 0).

**Do NOT use** `curve.realQuoteReserve()` (selector `0x4f1f58fd`) for progress — it returns the *current* quote balance, which drops as fees are swept. Verified identity: `Σbuys − Σsells = balance + ΣsweptFees` holds to the wei.

### Worked example — LYNX

- Token `0xaa837e66C3271b183af6a75fCc70617507Ea1C99`, curve `0xef6831539d09ee0b0c90ad507691b21e142341b4`, launched block 76,460,047
- `getLaunchedToken`: threshold 8,090,000,000 · phase 0 (NotGraduated) · pairToken USDG
- Σ CurveBuy.w0 = 17,699.43 USDG (251 buys) · Σ CurveSell.w1 = 16,207.77 USDG (244 sells)
- raised = 1,491.66 USDG → **progress = 18.4%**
- Cross-check: curve USDG balance 256.30 + Σ FeesSwept (1,235.37) = 1,491.67 ✓

## 5. More tokens (method proof)

| Token | Curve | Buys | Sells | Net (USDG) | Progress |
|---|---|---|---|---|---|
| `0xfc8540c01025d970dd3d0761866350ac8bad7d64` | `0x9ad8048df31f5a593b1abc3ad8b68c490fa6cb64` | 202.31 | 194.30 | 8.01 | **0.1%** |
| `0xd75cea9b468b8c33ad1075b800b8e662d388b576` | `0xc7e50e5ad980a9cb337aed28aa865e218e5c6362` | 0 | 0 | 0 | **0.0%** (fresh) |
| `0x2919c789720e77c587fabc1158e43cc5a60414ae` | `0x35640efcfee758be0dfbcfee31204fb58c972a0b` | — | — | — | **graduated** (phase 2 = PoolCreated, seeded 8090.00) |

## Today-tab recipe

1. `eth_getLogs` on factory, `topic0 = TokenLaunched`, `pairToken == USDG` → (token, curve, threshold, launchBlock)
2. `eth_call getLaunchedToken(token)` per token → keep `phase == 0`
3. Per curve: `eth_getLogs` CurveBuy + CurveSell from launchBlock → `progress = (Σw0 − Σw1) / threshold`
4. Velocity: Σ CurveBuy.w0 over trailing 24h (~12.6k blocks at ~2s… measure, don't assume) → rank near-graduation tokens by it
5. `PoolGraduated` on the factory = graduation calendar entries (token, block → date, seeded amounts)
