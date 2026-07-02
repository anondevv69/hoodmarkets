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

## User flows

| Flow | Bankr submit? |
|------|----------------|
| Deploy token | No — server deploy after haiku JWT |
| Buy / sell (Pro tokens) | Yes — `prepare-*` → `/wallet/submit` chain 4663 |
| Claim fees | No — server claim after haiku JWT |
| Simple (V3) tokens | Trade on Uniswap / DexScreener |
