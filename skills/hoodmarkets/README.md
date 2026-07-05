# hood.markets Bankr skill

Bankr-compatible agent skill for launching and trading on [hood.markets](https://hood.markets) (Robinhood Chain **4663**).

## Install (Bankr / Cursor)

```text
install the hoodmarkets skill from https://github.com/anondevv69/hoodmarkets/tree/main/skills/hoodmarkets
```

## Publish to BankrBot/skills

To list in the official Bankr catalog, open a PR to [BankrBot/skills](https://github.com/BankrBot/skills) copying this folder to `skills/hoodmarkets/` (same layout as [github-vesting](https://github.com/BankrBot/skills/tree/main/github-vesting)).

## API requirements

Production agent endpoints live on **`https://api.hood.markets`**:

- `GET /health`
- `GET /api/agent/briefing`
- `POST /api/agent/prepare-deploy`
- `POST /api/agent/prepare-buy`
- `POST /api/agent/prepare-sell`

Plus existing captcha, deploy, and claim routes documented in `api/docs/agent-api.md`.

## Contracts (V3 simple launch)

| Role | Address |
|------|---------|
| Factory | `0xC2A604fF131dDE9201838007A129ea28b85d00e8` |
| Vault | `0x770C6762e03b7AC2c718e0128F8f16Ad296AACC7` |
| LP locker | `0x34C912ba3C0dADf036b0a1f0E22aE76Cc36D900D` |
| Fraction deployer | `0x3a6C79aA075647eb221AFf346a0435930a7FB8CC` |
| Platform 5% | `0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98` |

See `known-contracts.json` for full pin list (V4 swap helper, fee locker, etc.).

## User flows

| Flow | Bankr submit? |
|------|----------------|
| Deploy token | No — server deploy after haiku JWT |
| Buy / sell (Pro tokens) | Yes — `prepare-*` → `/wallet/submit` chain 4663 |
| Claim fees | No — server claim after haiku JWT |
| Simple (V3) tokens | Trade on Uniswap / DexScreener |
