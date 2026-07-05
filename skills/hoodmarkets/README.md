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
| Factory | `0xf65536Eb3354Ad7e77E1b0d0F7bEBFa1C88885C9` |
| Vault | `0xB38BC03B373e7dFD43727A5f6aF3b588b441121b` |
| LP locker | `0x3e51b0D25AA990d2e6C17b29D644F8eb0Ed2913A` |
| Fraction deployer | `0x6542CdAaBdD69E3c830b162bB7946d24bcdA156c` |
| Platform 5% | `0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98` |

See `known-contracts.json` for full pin list (V4 swap helper, fee locker, etc.).

## User flows

| Flow | Bankr submit? |
|------|----------------|
| Deploy token | No — server deploy after haiku JWT |
| Buy / sell (Pro tokens) | Yes — `prepare-*` → `/wallet/submit` chain 4663 |
| Claim fees | No — server claim after haiku JWT |
| Simple (V3) tokens | Trade on Uniswap / DexScreener |
