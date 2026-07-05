# hood.markets

Token launchpad on **Robinhood Chain (4663)** — factory, API, web UI, and Bankr agent skill.

- **Website:** [hood.markets](https://hood.markets)
- **API:** [api.hood.markets](https://api.hood.markets)
- **Dev docs:** [hood.markets/Dev](https://hood.markets/Dev) · [sdk.md](https://hood.markets/sdk.md) · [agent.md](https://hood.markets/agent.md)
- **GitHub:** [github.com/anondevv69/hoodmarkets](https://github.com/anondevv69/hoodmarkets)

## HoodMarkets V3 (simple launch, v0.11.0)

Default launch mode — Uniswap V3 + embedded **1,000-share Holder NFT** vault.

| Contract | Address |
|----------|---------|
| Factory | `0x9BDdC8ddf28f5629C989A36Eb5bb6C73cBA60Df5` |
| Vault | `0x856c6997A86752fB3E6A494AB93107B7A371A57f` |
| LP locker | `0x23a1c52F4E93B0283d12CC16c29Df119803E8745` |
| Fraction deployer | `0x40A19d561b3200A2C9E1014248FcEB724c450692` |
| Platform 5% | `0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98` |

JSON: [`contracts/deployed-hoodmarkets-v3-mainnet.json`](contracts/deployed-hoodmarkets-v3-mainnet.json) · Docs: [`docs/HOODMARKETS_V3.md`](docs/HOODMARKETS_V3.md)

**Platform fees (only two):** swap trading fees 5%/95% to holders · share marketplace sales 5% of price.

## Repository layout

| Path | Description |
|------|-------------|
| [`contracts/`](contracts/) | Foundry — HoodMarkets V3 + V4 protocol |
| [`api/`](api/) | Node/Express launcher API |
| [`web/`](web/) | Vite + Privy frontend |
| [`docs/`](docs/) | Deploy, Railway, V3 reference |
| [`skills/hoodmarkets/`](skills/hoodmarkets/) | **Bankr agent skill v16** |

## Bankr agents

```text
install the hoodmarkets skill from https://github.com/anondevv69/hoodmarkets/tree/main/skills/hoodmarkets
```

See [`skills/hoodmarkets/SKILL.md`](skills/hoodmarkets/SKILL.md) and [`web/public/agent.md`](web/public/agent.md).

PR to [BankrBot/skills](https://github.com/BankrBot/skills) for official catalog listing.

## Pro launches (V4)

| Contract | Address |
|----------|---------|
| HoodMarkets factory | `0xdeBc9bC5c3Ca697493a01e8ac503B590D209d8bD` |
| Swap helper | `0x6373285F77ad0a3f5a441439B3D23d16B79aA585` |

Full list: [`contracts/deployed-robinhood-mainnet.json`](contracts/deployed-robinhood-mainnet.json)

## Quick start

```bash
# Contracts (V3 redeploy)
cd contracts && cp .env.robinhood.example .env.robinhood
./scripts/deploy-hoodmarkets-v3.sh

# API
cd api && cp .env.hood.example .env && npm install && npm run dev:backend

# Web
cd web && cp .env.example .env && npm install && npm run dev
```

## Production

| Service | Host | Root |
|---------|------|------|
| API | Railway → `api.hood.markets` | `api/` |
| Web | Vercel → `hood.markets` | `web/` |

Env checklist: [`api/RAILWAY_ENV_CHECKLIST.md`](api/RAILWAY_ENV_CHECKLIST.md)

## License

MIT — see [contracts/LICENSE](contracts/LICENSE).
