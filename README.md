# hood.markets

Token launchpad on **Robinhood Chain (4663)** — factory, API, and web UI.

- **Website:** [hood.markets](https://hood.markets)
- **Contracts:** Uniswap v4 + `HoodMarkets` factory (Robinhood mainnet)
- **Stack:** Privy auth, Railway API, Vercel frontend

## Repository layout

| Path | Description |
|------|-------------|
| [`contracts/`](contracts/) | Foundry — `HoodMarkets` factory + protocol modules |
| [`api/`](api/) | Node/Express launcher API (`WEB_ONLY_MODE`) |
| [`web/`](web/) | Vite + Privy frontend |
| [`docs/`](docs/) | Deploy and Railway setup |

## Robinhood mainnet (4663)

Latest deployed addresses (`contracts/deployed-robinhood-mainnet.json`):

| Contract | Address |
|----------|---------|
| HoodMarkets | `0xdeBc9bC5c3Ca697493a01e8ac503B590D209d8bD` |
| HoodMarketsFeeLocker | `0xD588F6F8819Fc0B34fF72300Bb87b8c69C4cD454` |
| HoodMarketsHookDynamicFeeV2 | `0x5de599D4363bb9308434351600c34C96D46868CC` |
| HoodMarketsHookStaticFeeV2 | `0xCD9DD3fa11c53cf6aE3d4e4D3fdf7C1f790468cc` |
| HoodMarketsLpLockerFeeConversion | `0x34861965c8eFc302E794C8593404CF17c6e65fF0` |
| HoodMarketsUniv4EthDevBuy | `0x39ddf0339f9dccef59457a3579de1789c38d5a40` |
| HoodMarketsSniperAuctionV2 | `0xcbbc3534a892a365c57023c34349300d360f6a1b` |

Explorer: [robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com)

## Quick start

### Contracts

```bash
cd contracts
git submodule update --init --recursive
cp .env.robinhood.example .env.robinhood   # set DEPLOYER_PRIVATE_KEY locally only
forge build
./scripts/deploy-robinhood.sh              # full stack deploy
./scripts/verify-robinhood.sh              # Blockscout verification
```

### API (local)

```bash
cd api
cp .env.hood.example .env
npm install
npm run dev:backend
```

Set `HOODMARKETS_*` contract addresses in `.env` (see `.env.hood.example`).

### Web (local)

```bash
cd web
cp .env.example .env   # VITE_PRIVY_APP_ID, VITE_API_URL
npm install
npm run dev
```

## Production

Deploy from this monorepo — no separate frontend repo.

| Service | Host | Repo path | Root directory |
|---------|------|-----------|----------------|
| **API** | Railway → `api.hood.markets` | [`api/`](api/) | `api` |
| **Web** | Vercel → `hood.markets` | [`web/`](web/) | `web` |

**GitHub:** [github.com/anondevv69/hoodmarkets](https://github.com/anondevv69/hoodmarkets)

See [docs/HOOD_MARKETS_SETUP.md](docs/HOOD_MARKETS_SETUP.md) for env vars, migration from `liquid-social-launcher`, and smoke tests.

## License

MIT — see [contracts/LICENSE](contracts/LICENSE).
