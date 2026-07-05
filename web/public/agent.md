# hood.markets — Agent API

> **Developer hub:** [hood.markets/Dev](https://hood.markets/Dev)

> Robinhood Chain (4663) · API: `https://api.hood.markets` · Web: `https://hood.markets`

Any agent with an EVM wallet can deploy tokens on Robinhood Chain through the hood.markets API. Bankr users: install the skill from [BankrBot/skills](https://github.com/BankrBot/skills) (`hoodmarkets`) or [anondevv69/hoodmarkets/skills/hoodmarkets](https://github.com/anondevv69/hoodmarkets/tree/main/skills/hoodmarkets).

## Contracts (Robinhood mainnet)

**Uniswap V3 launches** — default `launchMode: "simple"`:

| Contract | Address |
|----------|---------|
| HoodMarketsV3 factory (v0.10.0) | `0xf65536Eb3354Ad7e77E1b0d0F7bEBFa1C88885C9` |
| HoodMarketsV3 vault | `0xB38BC03B373e7dFD43727A5f6aF3b588b441121b` |
| HoodMarketsV3 LP locker | `0x3e51b0D25AA990d2e6C17b29D644F8eb0Ed2913A` |
| HoodMarketsV3 fraction deployer | `0x6542CdAaBdD69E3c830b162bB7946d24bcdA156c` |
| Platform fee wallet (5%) | `0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98` |
| Contract owner | `0xFA45A3b8d1662E3432D1B5bE3F37e4923D1b796C` |

Fee split: **95%** to agent/creator fee wallet · **5%** to platform (on-chain in locker).

WETH: `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` · Explorer: [robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com)

---

## Agent endpoints (summary)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | API + chainId 4663 |
| GET | `/api/agent/briefing?wallet=0x…` | Tokens where wallet is fee recipient |
| GET | `/api/agent/preflight-deploy?wallet=…&name=…&symbol=…&launchMode=simple` | Check blockers before captcha |
| GET | `/api/agent/token-info?token=0x…` or `?symbol=TICKER` | Token metadata + Uniswap trade link |
| POST | `/api/agent/prepare-deploy` | Full deploy checklist + preflight |
| GET | `/api/agent-captcha/challenge` | Haiku challenge |
| POST | `/api/agent-captcha/verify` | Returns JWT (8h) |
| POST | `/api/deploy` | Deploy token (header `X-Agent-Captcha-JWT`) |
| POST | `/api/agent/claim` | Claim fees (launcher pays gas) |
| GET | `/api/deployments?limit=50` | Public token catalog |
| GET | `/api/deployments/0x…` | Single token metadata |

**Use `https://api.hood.markets` only** — not `hood.markets` for POST.

---

## Step 1 — Auth

**X / Twitter:** confirm with the user in-thread, then deploy with `agentChannel: "x"` and `x-agent-channel: x` — no haiku.

**Non-X agents (API, automation):** solve haiku once, get a JWT (valid 8 hours):

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

Preflight first:

```
GET https://api.hood.markets/api/agent/preflight-deploy?wallet=0x…&name=My+Token&symbol=MTK&launchMode=simple
```

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
  "imageUrl": "https://…",
  "description": "…"
}
```

- `launchMode`: `"simple"` — Uniswap V3 on Robinhood Chain (default)
- **5%** platform / **95%** fee wallet — set in `HoodMarketsV3LpLocker`
- Deploy is **gasless for the user** — hood.markets launcher wallet pays gas + launch seed

Or full checklist:

```
POST https://api.hood.markets/api/agent/prepare-deploy
{ "wallet": "0x…", "name": "…", "symbol": "…", "launchMode": "simple" }
```

---

## Step 2b — Buy / sell

All hood.markets tokens trade on **Uniswap V3**. Use the `uniswapSwapUrl` from token-info — do **not** use a hood.markets swap helper.

```
GET https://api.hood.markets/api/agent/token-info?token=0x…
```

Open the returned Uniswap link for buys and sells.

---

## Step 2c — Claim fees (launcher pays gas)

V3 fee recipients claim WETH via `HoodMarketsV3.claimRewards(token)` (API submits the tx):

```
POST https://api.hood.markets/api/agent/claim
X-Agent-Captcha-JWT: <jwt>
Content-Type: application/json

{ "tokenAddress": "0x…" }
```

JWT wallet must be the **fee recipient**. Response includes `feeModel` / `launchType`.

---

## Briefing

```
GET https://api.hood.markets/api/agent/briefing?wallet=0x…
```

Lists tokens where the wallet is fee recipient (DexScreener / hood.markets links).

---

*Full skill: `skills/hoodmarkets/` · Pin addresses: `skills/hoodmarkets/known-contracts.json`*
