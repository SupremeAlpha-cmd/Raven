# Raven

**Raven watches the chain so you don't have to.**

Tokens on Pons move fast. Something can go from quiet to gaining serious traction in a matter of minutes, and keeping up with everything on-chain isn't easy.

Raven is a live terminal for Robinhood Chain that tracks bonding curves, graduations, and smart-wallet activity as it happens.

- **Today** shows you what's moving, what's nearing graduation, and where momentum is building.
- **Flow** lets you follow buys and sells in real time.
- **Wallets** shows what profitable wallets have been doing.

Instead of constantly checking different places to see what you missed, Raven gives you one place to keep an eye on the chain.

**Raven doesn't predict. It watches what's happening — and puts it in front of you.**

## How it works

One indexing engine feeds all three views. It reads `Swap` events straight from the Pons router contract (`0x65050a9b7e5075a2ba5ced7b1b64ee66262c40dc`) via the Robinhood Chain RPC, correlates each swap with its ERC-20 transfers to identify tokens, traders, and direction, and serves it up through API routes. The frontend polls every 30 seconds — the tab that never closes.

- Chain ID `4663` · RPC `https://rpc.mainnet.chain.robinhood.com`
- `lib/chain.ts` — RPC client and chain constants
- `lib/tape.ts` — swap decoder (Flow)
- `lib/wallets.ts` — wallet activity aggregation (Wallets)
- `app/api/tape`, `app/api/wallets` — data endpoints

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Status

- [x] Flow — live buy/sell tape
- [x] Wallets — most-active wallet leaderboard
- [ ] Today — graduation calendar (in progress)

## Deploy

Import the repo on Vercel — no environment variables needed.
