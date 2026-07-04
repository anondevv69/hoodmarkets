# hood.markets — Agent API

> Robinhood Chain (4663) · API: `https://api.hood.markets` · Web: `https://hood.markets`

Bankr agents: install skill from `skills/hoodmarkets/` in this repo.

## Step 1 — Auth

**X / Twitter agents** — confirm with the user in-thread, then deploy with channel tag (no haiku):

```http
x-wallet-address: 0xYOUR_WALLET
x-agent-channel: x
```

Body: `"agentChannel": "x"` on `prepare-deploy` and `/api/deploy`.

**Non-X agents (API, automation)** — solve haiku once, get a JWT (valid 8 hours):

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
{ "wallet": "0x…", "name": "…", "symbol": "…", "launchMode": "simple", "agentChannel": "x", "tweetImageUrl": "https://pbs.twimg.com/…" }
```

`agentChannel: "x"` → `captchaRequired: false`, `confirmSummary` + `confirmReplyHint` (includes logo from tweet). Omit for haiku flow.

**400** if no image — attach a photo to the tweet or pass `tweetImageUrl` / `imageUrl`.

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

**Simple (V3)** and **Pro (V4)** use the same endpoint — the API routes to the correct contract.

| Launch | Contract action |
|--------|-----------------|
| Simple (V3) | `HoodMarketsV3.claimRewards(token)` @ `0x4c18e43F8B8b63f42a944b98b8af29f576c7Ffa8` |
| Pro (V4) | LP locker collect → fee locker `claim(feeOwner, WETH)` |

```
POST https://api.hood.markets/api/agent/claim
X-Agent-Captcha-JWT: <jwt>
Content-Type: application/json

{ "tokenAddress": "0x…" }
```

Response: `feeModel`, `launchType`, `txHash`, `explorerUrl`. V3 may omit `feeAmountEth` when amount is not read from logs.

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
| HoodMarketsV3 factory | `0x4c18e43F8B8b63f42a944b98b8af29f576c7Ffa8` |
| HoodMarketsV3 vault | `0x1b84cBb1837F17d6d433195b7e57E869b3522848` |
| HoodMarketsV3 LP locker | `0x5296C54C3f5D8d0e0ced4A95BC6B85d6Db715AD5` |
| HoodMarketsV3 fraction deployer | `0x77Aea5d5EAae608d932bfD1e99fCf83e983c3641` |
| Platform fee wallet (5%) | `0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98` |
| Contract owner | `0xFA45A3b8d1662E3432D1B5bE3F37e4923D1b796C` |

Simple fee split: **95%** fee wallet · **5%** platform (embedded in locker).

Pinned JSON for agents: `skills/hoodmarkets/known-contracts.json`

---

*Skill package: `skills/hoodmarkets/` · PR to [BankrBot/skills](https://github.com/BankrBot/skills) for catalog listing*
