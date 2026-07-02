# hood.markets — Agent API

> Robinhood Chain (4663) · API: `https://api.hood.markets` · Web: `https://hood.markets`

Bankr agents: install skill from `skills/hoodmarkets/` in this repo.

## Step 1 — Solve haiku once, get a JWT (valid 8 hours)

```
GET https://api.hood.markets/api/agent-captcha/challenge
```

```
POST https://api.hood.markets/api/agent-captcha/verify
Content-Type: application/json

{
  "sessionId": "abc123",
  "response": "Tokens rise at dawn\nOn Robinhood tokens flow\nAgents hold the key",
  "agentFeeRecipient": "0xYOUR_WALLET"
}
```

Returns `{ "jwt": "eyJ...", "walletAddress": "0x...", "expiresIn": 28800 }`

> Haiku: exactly 3 lines separated by `\n`, must mention the topic word.

---

## Step 2a — Deploy a token

```
POST https://api.hood.markets/api/deploy
X-Agent-Captcha-JWT: <jwt>
Content-Type: application/json

{
  "name": "Token Name",
  "symbol": "SYM",
  "feeTarget": "agent_wallet",
  "clientKind": "agent",
  "agentProvider": "bankr",
  "launchMode": "simple",
  "imageUrl": "https://…"
}
```

- `launchMode`: `"simple"` (Uniswap V3, DexScreener) or `"pro"` (V4 hooks)
- Simple launches: **5%** hood.markets platform fee embedded in contract; **95%** to fee wallet

Or get the full checklist:

```
POST https://api.hood.markets/api/agent/prepare-deploy
{ "wallet": "0x…", "name": "…", "symbol": "…", "launchMode": "simple" }
```

---

## Step 2b — Buy / sell (Pro tokens)

```
POST https://api.hood.markets/api/agent/prepare-buy
{ "wallet": "0x…", "tokenAddress": "0x…", "amountEth": "0.01" }

POST https://api.hood.markets/api/agent/prepare-sell
{ "wallet": "0x…", "tokenAddress": "0x…", "amount": "1000000" }
```

Returns `transactions[]` for Bankr `POST https://api.bankr.bot/wallet/submit` with `chainId: 4663`.

Simple (V3) tokens (`poolId` starts with `v3:`) → use Uniswap / DexScreener instead.

---

## Step 2c — Claim fees (launcher pays gas)

```
POST https://api.hood.markets/api/agent/claim
X-Agent-Captcha-JWT: <jwt>
Content-Type: application/json

{ "tokenAddress": "0x…" }
```

---

## Briefing

```
GET https://api.hood.markets/api/agent/briefing?wallet=0x…
```

Lists tokens where the wallet is fee recipient.

---

## Contracts (Robinhood mainnet, chain 4663)

**Simple launch (V3)** — default `launchMode: "simple"`:

| Contract | Address |
|----------|---------|
| HoodMarketsV3 factory | `0xcFE4D69Ac8e5F79a95d99e991162902f68029f09` |
| HoodMarketsV3 vault | `0xe250a07229Bcf29a2cC02d6070beE82252F71C36` |
| HoodMarketsV3 LP locker | `0x209eFAA86568f0Ea0E25d1F0E62f92e81c51a72a` |
| Platform fee wallet (5%) | `0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98` |
| Contract owner | `0xFA45A3b8d1662E3432D1B5bE3F37e4923D1b796C` |

Simple fee split: **95%** fee wallet · **5%** platform (embedded in locker).

Pinned JSON for agents: `skills/hoodmarkets/known-contracts.json`

---

*Skill package: `skills/hoodmarkets/` · PR to [BankrBot/skills](https://github.com/BankrBot/skills) for catalog listing*
