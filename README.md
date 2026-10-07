# Raven

**Raven watches the chain so you don't have to.**

Tokens on pump.fun move fast. Something can go from quiet to gaining serious traction in a matter of minutes, and keeping up with everything on-chain isn't easy.

Raven is a live terminal for Solana that tracks bonding curves, graduations, and smart-wallet activity as it happens.

- **Today** shows you what's moving, what's nearing graduation, and where momentum is building.
- **Flow** lets you follow buys and sells in real time.
- **Wallets** shows what profitable wallets have been doing.

Instead of constantly checking different places to see what you missed, Raven gives you one place to keep an eye on the chain.

**Raven doesn't predict. It watches what's happening — and puts it in front of you.**

## How it works

One indexing engine feeds all three views. It reads `TradeEvent`s straight from the pump.fun program (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`) via Solana RPC — each event already carries mint, amounts, direction and trader, so no correlation step is needed — and serves it up through API routes. The frontend polls every 30 seconds — the tab that never closes.

- Solana mainnet-beta · RPC `https://api.mainnet-beta.solana.com` (or Helius with `HELIUS_API_KEY`)
- `lib/solana.ts` — RPC client, program IDs, event decoders, curve math
- `lib/tape.ts` — swap decoder (Flow)
- `lib/wallets.ts` — wallet activity aggregation (Wallets)
- `app/api/tape`, `app/api/wallets` — data endpoints

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable | Required | What |
|---|---|---|
| `HELIUS_API_KEY` | No | Helius RPC key. Without it Raven uses the public mainnet-beta endpoint, which is rate-limited — polls are slower and scans shallower. Set it for production. |

## Status

- [x] Flow — live buy/sell tape
- [x] Wallets — most-active wallet leaderboard
- [ ] Today — graduation calendar (in progress)

## Deploy

Import the repo on Vercel — no environment variables needed.
