---
name: hoodmarkets
description: Launch, buy, sell, and claim fees for hood.markets tokens on Robinhood Chain (4663) via api.hood.markets. Use for hoodmarkets, hood.markets, $hood, launch token, deploy token, buy token, sell token, claim fees, Bankr Robinhood. NEVER use hood.markets for API POST — use api.hood.markets.
tags: [hoodmarkets, hood, bankr, robinhood, defi, token-launcher, uniswap]
version: 3
---

# hood.markets — Bankr agent skill

Launch and trade tokens on **[hood.markets](https://hood.markets)** (Robinhood Chain, chain ID **4663**). Bankr supports Robinhood — users can deploy, swap, and claim through `@bankrbot` when this skill is installed.

## CRITICAL — API host (read first)

| Role | URL |
|------|-----|
| **Agent API** | `https://api.hood.markets` |
| **Web UI** | `https://hood.markets` |

```
GET  https://api.hood.markets/health
GET  https://api.hood.markets/api/agent/briefing?wallet=0x…
GET  https://api.hood.markets/api/agent/preflight-deploy?wallet=0x…&name=…&symbol=…
GET  https://api.hood.markets/api/agent/token-info?token=0x…
POST https://api.hood.markets/api/agent/prepare-deploy
POST https://api.hood.markets/api/agent/prepare-buy
POST https://api.hood.markets/api/agent/prepare-sell
POST https://api.hood.markets/api/deploy          (after haiku JWT)
POST https://api.hood.markets/api/agent/claim      (after haiku JWT)
```

**NEVER** call `https://hood.markets/api/...` for agent POST — the website is frontend-only.

See `references/API-HOST.md` before any HTTP call.

---

## Install

```text
install the hoodmarkets skill from https://github.com/anondevv69/hoodmarkets/tree/main/skills/hoodmarkets
```

Or from Bankr skill catalog once published to [BankrBot/skills](https://github.com/BankrBot/skills).

---

## What users mean

| Term | Meaning |
|------|---------|
| **Launch / deploy** | Create a new token + liquidity pool on Robinhood |
| **Simple launch** | Uniswap V3 via `0xcFE4…9f09` factory — DexScreener-friendly; **5%** platform / **95%** creator |
| **Pro launch** | Uniswap V4 hooks — one-click buy/sell on hood.markets |
| **Buy / sell** | Swap ETH ↔ hood.markets token (Pro tokens via swap helper + Bankr submit) |
| **Claim fees** | Pull WETH trading fees to creator wallet (launcher pays gas) |

---

## Mandatory routing

```
if message mentions hoodmarkets / hood.markets / launch token on robinhood /
   buy $TICKER / sell token / claim fees / deploy on hood:
  1. use_skill("hoodmarkets")
  2. Read references/API-HOST.md — use ONLY https://api.hood.markets
  3. Resolve linked wallet → x-wallet-address header
  4. **Deploy:** call `preflight-deploy` first — if blocked, reply with `replyHint` (ticker taken, daily limit, etc.)
  5. Call references/AGENT-API.md endpoint BEFORE replying
  6. Format reply locally — references/RESPONSE-SAFETY.md
  7. Deploy: preflight ok → `prepare-deploy` with tweet image (`tweetImageUrl` / `tweetText`) + `agentChannel: "x"` on X → show `confirmReplyHint` (logo included) → deploy after yes; else haiku JWT
  8. Buy/sell: `token-info` → if Pro, prepare-buy|prepare-sell → validate txs → Bankr /wallet/submit
  9. Claim: haiku JWT → POST /api/agent/claim (server broadcasts, no submit)
```

**Tweet = DM** — same pipeline on `@bankrbot` intake.

---

## Agent API (reads)

Pass wallet via `?wallet=0x…` or header `x-wallet-address: 0x…`.

| User says | Call |
|-----------|------|
| my tokens / my launches / briefing | `GET https://api.hood.markets/api/agent/briefing?wallet=0x…` |
| launch / deploy token | `GET preflight-deploy` → if ok, `POST prepare-deploy` with `agentChannel: "x"` on X, else haiku flow |
| is $TICKER simple or pro / how to swap | `GET https://api.hood.markets/api/agent/token-info?symbol=TICKER` |
| buy TOKEN / buy 0x… with ETH | `token-info` → if Pro: `POST prepare-buy` |
| sell TOKEN / sell amount | `token-info` → if Pro: `POST prepare-sell` |
| list all tokens (public) | `GET https://api.hood.markets/api/deployments?limit=50` |
| token swap config | `GET https://api.hood.markets/api/tokens/0x…/swap-config` |

See **`references/AGENT-API.md`** for bodies and response fields.

---

## Deploy flow (server-side — no Bankr submit)

Deploy is **gasless for the user** — hood.markets launcher wallet pays gas + launch seed.

### On X / Twitter (`agentChannel: "x"`)

1. From the **original tweet**, pass the logo into `prepare-deploy`:
   - **`tweetImageUrl`** — first attached photo (`pbs.twimg.com/...`) — preferred on X
   - **`tweetText`** — full tweet text (fallback: extract inline image URL)
   - **`tweet`** — Twitter API object if available (`extended_entities.media`)
   - **`imageUrl`** — explicit HTTPS URL if user pasted one in the tweet
2. Call `POST /api/agent/prepare-deploy` with `agentChannel: "x"`, wallet, name, symbol, and image fields above.
3. Use **`confirmSummary`** / **`confirmReplyHint`** (or `steps[0].summary` / `steps[0].replyHint`) in your confirm message — **must include the logo URL** from the tweet.
4. Wait for user **yes/confirm**, then deploy — **no haiku**:

```http
POST https://api.hood.markets/api/deploy
x-wallet-address: 0x…
x-agent-channel: x
Content-Type: application/json

{
  "name": "My Token",
  "symbol": "MTK",
  "feeTarget": "agent_wallet",
  "clientKind": "agent",
  "agentProvider": "bankr",
  "agentChannel": "x",
  "launchMode": "simple",
  "imageUrl": "https://…",
  "wallet": "0x…"
}
```

### Non-X agents (API, cron, cloud — automatable)

Use **haiku JWT** — no in-thread confirm step:

1. `GET https://api.hood.markets/api/agent-captcha/challenge`
2. `POST https://api.hood.markets/api/agent-captcha/verify` with haiku + `agentFeeRecipient: <Bankr wallet>`
3. `POST https://api.hood.markets/api/deploy` with header `X-Agent-Captcha-JWT: <jwt>`:

```json
{
  "name": "My Token",
  "symbol": "MTK",
  "feeTarget": "agent_wallet",
  "clientKind": "agent",
  "agentProvider": "bankr",
  "launchMode": "simple",
  "imageUrl": "https://…",
  "description": "…"
}
```

- `launchMode`: `"simple"` (V3, DexScreener) or `"pro"` (V4, hood.markets swap UI)
- Fee recipient = wallet from captcha JWT (Bankr linked wallet)
- **Simple:** 5% platform / 95% creator — embedded in `HoodMarketsV3LpLocker`

Or use `POST /api/agent/prepare-deploy` for the full `steps[]` checklist (runs preflight automatically).

### Preflight (before captcha)

Check ticker/name taken, wallet deploy limits, and launch mode **before** asking the user to solve the haiku:

```http
GET https://api.hood.markets/api/agent/preflight-deploy?wallet=0x…&name=My+Token&symbol=MTK&launchMode=simple
```

- **409** + `blocks[]` → do not deploy; reply with `replyHint` (e.g. ticker taken, wallet daily limit)
- **200** + optional `warnings[]` → can deploy; warn if fees would route to burn

See `streaming-hints.json` for V3 vs Pro detection and error codes.

---

## Buy / sell flow (Bankr wallet submit)

1. `GET /api/agent/token-info?token=0x…` or `?symbol=TICKER` — read `launchType` and `swapMode`
2. **Simple (V3):** reply with `uniswapSwapUrl` — do not call prepare-buy/sell
3. **Pro (V4):** `POST prepare-buy` or `prepare-sell`
4. **`references/TX-VALIDATION.md`** — validate every item in `transactions[]` against `known-contracts.json`
3. Submit via Bankr (chain **4663**):

```http
POST https://api.bankr.bot/wallet/submit
X-API-Key: …
Content-Type: application/json

{
  "transaction": {
    "to": "0x…",
    "data": "0x…",
    "value": "0",
    "chainId": 4663
  },
  "description": "hood.markets: buy MTK",
  "waitForConfirmation": true
}
```

4. **Pro tokens only** for prepare-buy/sell (V4 swap helper). **Simple (V3)** tokens → use Uniswap link from API response.

If Bankr returns `untrusted_address` → **stop** per `references/BANKR-SUBMIT.md`. Do not bypass via web UI.

---

## Claim fees

```
POST https://api.hood.markets/api/agent/claim
X-Agent-Captcha-JWT: <jwt>
Content-Type: application/json

{ "tokenAddress": "0x…" }
```

Launcher broadcasts claim and pays gas. JWT wallet must be the **fee recipient** for that token.

---

## Example one-liners

> launch $PEPE on hoodmarkets simple mode with image https://…

→ prepare-deploy (`agentChannel: "x"` on X: confirm first, no haiku; else haiku) → deploy → reply with `https://hood.markets/?token=0x…`

> buy 0.01 ETH of 0x4895… on hood

→ prepare-buy → validate → `/wallet/submit` → confirm on Blockscout

> claim fees for my token MTK

→ captcha JWT → POST /api/agent/claim with tokenAddress or symbol

---

## Files

| File | Purpose |
|------|---------|
| `references/API-HOST.md` | Correct API base URL + allowlist |
| `references/AGENT-API.md` | Endpoint reference |
| `references/TX-VALIDATION.md` | Validate txs before Bankr submit |
| `references/BANKR-SUBMIT.md` | Bankr security scan rules |
| `references/RESPONSE-SAFETY.md` | Format replies locally |
| `references/ONE-LINE-INTENTS.md` | Tweet → API mapping |
| `streaming-hints.json` | V3 vs Pro detection + preflight error codes |
| `known-contracts.json` | Pinned Robinhood addresses |
