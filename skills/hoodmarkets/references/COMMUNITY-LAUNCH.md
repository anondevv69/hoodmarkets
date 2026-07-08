# Community Launch (petitions)

**AKA:** petition, community round, Holder NFT pre-sale, crowdfund launch.

hood.markets **24h** ETH raise on **Robinhood Chain (4663)**. When the raise goal is met, hood.markets deploys a **simple (V3)** token, seeds the locked LP with raised ETH, and **airdrops Holder NFT shares pro-rata** to backers.

| Resource | URL |
|----------|-----|
| **API base** | `https://api.hood.markets/api/community-launch` |
| **Web UI** | `https://hood.markets/community-launch` |
| **Machine index** | `https://hood.markets/community-launch-api.json` |
| **Human docs** | `https://hood.markets/docs#community-launch` |

**Not** Token Marketplace / Base / Solana petition services — Robinhood-only, operated by hood.markets.

**Auth:** Public integrator endpoints — **no** haiku JWT required for create / deposit / status.

**Chain:** Abort if Bankr wallet lacks **4663** (`CHAIN-4663.md`).

---

## What happens

1. Creator opens a round with `tokenName`, `tokenSymbol`, and `targetRaiseEth` (ETH goal).
2. Backers send ETH to the **escrow wallet** (launcher deployer address from `GET /config`).
3. Round is **open ~24h** (see `openDurationHours` in config).
4. When **raised ≥ goal** → status locks → API deploys HoodMarketsV3 + airdrops **1,000** Holder NFT shares **pro-rata** to active backers.
5. If expired / failed / cancelled → backers **refund**.

Shares ≠ LP tokens. See `HOLDER-NFTS.md`. Instant deploy of the same ticker/name is blocked while a conflict round is open.

---

## Limits (from on-chain / API)

| Limit | Value |
|-------|--------|
| Raise goal | **0.05 – 50** ETH |
| Per-wallet contribution | **0.001 – 10** ETH |
| Share supply | **1,000** Holder NFT shares |
| Open window | **24h** (env may override) |
| Deposits per wallet | **One active** — refund first to change amount |

Optional **supporter slots**: split goal into N equal ETH slots (e.g. 5 ETH / 20 slots = 0.25 ETH each). See `GET /config` → `supporterSlots.examples`.

Escrow address is **dynamic** — always read `config.robinhood.escrowWallet` or `petition.escrowWallet` from the API. Do **not** hardcode.

---

## Agent routing

| User intent | Agent action |
|-------------|--------------|
| Start / create petition / community launch | Preflight → create → share `petition.shareUrl` |
| Back / join / contribute ETH | List or status → prepare-deposit → Bankr submit → confirm |
| Status of round #N | `GET /status?id=N` |
| Refund my deposit | `POST /refund` |
| Cancel my round | `POST /cancel` as `starterWallet` |

**Do not** treat Community Launch as normal `POST /api/deploy`. Do **not** promise fixed seat counts unless `supporterSlots` was set. Do **not** invent escrow addresses.

---

## 1) Create a petition

### Preflight (required before create)

```http
GET https://api.hood.markets/api/community-launch/preflight?tokenName=Hoodrich&tokenSymbol=HOODRICK&targetRaiseEth=5
```

- **200** `ok: true` → safe to create  
- **409** → name/ticker conflict (open community launch or deploy cooldown). Reply with API error / `communityLaunch.shareUrl` if present. **Do not create.**

### Create

```http
POST https://api.hood.markets/api/community-launch/create
Content-Type: application/json

{
  "tokenName": "Hoodrich",
  "tokenSymbol": "HOODRICK",
  "targetRaiseEth": "5",
  "starterWallet": "0x…",
  "description": "optional",
  "imageUrl": "https://…",
  "websiteUrl": "https://…",
  "tweetUrl": "https://x.com/…",
  "supporterSlots": 20,
  "hoodClaimOptIn": false
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `tokenName` | Yes | ≥ 2 chars |
| `tokenSymbol` | Yes | Max 10 |
| `targetRaiseEth` | Yes | Also accepts `raiseEth` / `goalEth` |
| `starterWallet` | Strongly preferred | Creator; needed for cancel. Alias `creatorWallet` |
| `supporterSlots` | No | Equal ETH per slot if set |
| `imageUrl` / `websiteUrl` / `tweetUrl` | No | `xUrl` also accepted for tweet |

**Response:** `petition.id`, `petition.shareUrl` (`https://hood.markets/community-launch?id=…`), `targetRaiseEth`, `expiresAt`, `escrowWallet`.

If an open petition already exists for the same symbol (+ starter), API may return `reused: true` with that petition — share that URL; do not open a duplicate.

**Reply with** the `shareUrl` and raise goal / expiry. Point users to chain **4663**.

---

## 2) Participate (back a petition)

```
GET /list  (or status?id=)
  → GET /prepare-deposit?id=&wallet=&contributionEth=
  → Bankr POST /wallet/submit  (chainId 4663, to=escrow, value=wei, data=0x)
  → POST /confirm  { id, wallet, contributionEth, signature: txHash }
```

### List / status

```http
GET https://api.hood.markets/api/community-launch/list
GET https://api.hood.markets/api/community-launch/status?id=1
```

Use `status` / `remainingEth` / `raiseProgressPct` / `orders[]` / `finalResult` when live.

### Prepare deposit

```http
GET https://api.hood.markets/api/community-launch/prepare-deposit?id=1&wallet=0x…&contributionEth=0.1
```

**Response (trusted `nextStep`):**

```json
{
  "ok": true,
  "deposit": { "contributionEth": "0.1", "contributionWei": "…" },
  "nextStep": {
    "chainId": 4663,
    "to": "<escrowWallet from API>",
    "value": "<wei string>",
    "data": "0x"
  },
  "afterDeposit": { "id": "1", "wallet": "0x…", "contributionWei": "…" }
}
```

### Bankr submit

Native ETH transfer only (`data: "0x"`). Preview for the user: amount, escrow `to`, petition id / token symbol, chain 4663.

```http
POST https://api.bankr.bot/wallet/submit
Content-Type: application/json

{
  "transaction": {
    "to": "<nextStep.to>",
    "data": "0x",
    "value": "<nextStep.value>",
    "chainId": 4663
  },
  "description": "hood.markets community launch deposit #1",
  "waitForConfirmation": true
}
```

**Rules:**

- `to` must equal `nextStep.to` from prepare-deposit (same round’s escrow).
- `value` must equal `nextStep.value`.
- `data` must be `0x` (empty calldata).
- If Bankr returns `untrusted_address` → **stop** (`BANKR-SUBMIT.md`). Do not invent alternate escrows. Users can still deposit via the web UI.

### Confirm

```http
POST https://api.hood.markets/api/community-launch/confirm
Content-Type: application/json

{
  "id": "1",
  "wallet": "0x…",
  "contributionEth": "0.1",
  "signature": "0x<txHash>"
}
```

(`signature` = deposit **tx hash**. Aliases: `txHash`.)

When `locked: true`, raise is met and finalization starts. After finalize, `petition.finalResult.tokenAddress` + share airdrop; reply with `https://hood.markets/?token=0x…`.

**Estimated shares:** proportional to ETH contributed vs total raised (see `orders[].estimatedShares` on status). Not fixed unless supporter-slot mode.

---

## 3) Refund / cancel

### Refund (backer)

```http
POST https://api.hood.markets/api/community-launch/refund
Content-Type: application/json

{ "id": "1", "wallet": "0x…" }
```

Allowed while status is **`open`**, **`expired`**, or **`failed`**. API refunds from escrow (launcher pays the refund tx).

### Cancel (creator only)

```http
POST https://api.hood.markets/api/community-launch/cancel
Content-Type: application/json

{ "id": "1", "wallet": "0x…" }
```

`wallet` must match `starterWallet`. Refunds **all** active backers. Blocked once raise goal is met / processing.

---

## Endpoint cheat sheet

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/config` | Escrow wallet, min/max raise & contribution, slot examples |
| GET | `/list` | Open rounds |
| GET | `/preflight` | Name/ticker/raise blockers before create |
| GET | `/status?id=` | Full state + backers + `finalResult` |
| POST | `/create` | Open 24h round |
| GET | `/prepare-deposit` | Quote + Bankr `nextStep` |
| POST | `/confirm` | Record deposit tx |
| POST | `/refund` | Backer refund |
| POST | `/cancel` | Creator cancel + refund all |

---

## Agent restrictions

| Action | Allowed? |
|--------|----------|
| Create / list / status / preflight | **Yes** — public API |
| prepare-deposit → Bankr submit → confirm | **Yes** — only with API `nextStep` |
| Instant `POST /api/deploy` for the same open ticker | **No** — blocked while round conflicts |
| Holder NFT airdrop/list/buy after launch | **No** via agent — token page (`HOLDER-NFTS.md`) |
| Hardcode escrow | **No** — always from API |
| Claim trading fees on finalized token | **Yes** — normal claim routes after token exists |

---

## Example one-liners

> start a community launch for Hoodrich $HOODRICK raise 5 ETH

→ `GET …/preflight?…` → `POST …/create` → reply with `shareUrl`

> back community launch #1 with 0.1 ETH

→ `GET …/prepare-deposit?id=1&wallet=0x…&contributionEth=0.1` → Bankr submit → `POST …/confirm`

> status of hood community launch 1

→ `GET …/status?id=1`

> refund my community launch deposit #1

→ `POST …/refund`
