# Hood.markets / hoodmarkets setup (web-only, Robinhood Chain)

**hoodmarkets** (`hood.markets`) = Privy website + this API on Railway. No bots, no Neynar.

Token factory contract names on-chain: **`HoodMarkets`**, **`HoodMarketsFeeLocker`**, **`HoodMarketsHook*V2`**, etc. (`PROTOCOL = "hoodmarkets"`). After redeploy, set `HOODMARKETS_*` addresses on Railway (legacy `LIQUID_*` still works as fallback).

## Repo strategy

| Piece | Repo | Host |
|--------|------|------|
| **API** (this repo) | Same `liquid-social-launcher` repo | New **Railway** project |
| **Website** (Privy + Vite) | **Separate** frontend repo (fork `privy-heart-landing`) | Vercel / Cloudflare → `hood.markets` |

You do **not** need a separate API repo — use a new Railway service from this repo with different env vars (`WEB_ONLY_MODE=true`).

---

## 1. Railway (API)

1. New Project → Deploy from GitHub → `liquid-social-launcher`
2. Add volume: mount path `/app/.data` (deployment catalog DB)
3. Set variables (copy from `.env.hood.example` in repo root)
4. Deploy → note public URL e.g. `https://hood-markets-api.up.railway.app`

### Required Railway variables

```env
WEB_ONLY_MODE=true
NODE_ENV=production

DEPLOYER_PRIVATE_KEY=0x...
ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com

HOODMARKETS_FACTORY=0xdeBc9bC5c3Ca697493a01e8ac503B590D209d8bD
HOODMARKETS_FEE_LOCKER=0xD588F6F8819Fc0B34fF72300Bb87b8c69C4cD454
HOODMARKETS_HOOK_DYNAMIC_FEE_V2=0x5de599D4363bb9308434351600c34C96D46868CC
HOODMARKETS_HOOK_STATIC_FEE_V2=0xCD9DD3fa11c53cf6aE3d4e4D3fdf7C1f790468cc
HOODMARKETS_LP_LOCKER_FEE_CONVERSION=0x34861965c8eFc302E794C8593404CF17c6e65fF0
HOODMARKETS_SNIPER_AUCTION_V2=0xcbbc3534a892a365c57023c34349300d360f6a1b
HOODMARKETS_UNIV4_ETH_DEV_BUY=0x39ddf0339f9dccef59457a3579de1789c38d5a40

PRIVY_APP_ID=...
PRIVY_APP_SECRET=...

WEB_DEPLOY_CORS_ORIGINS=https://hood.markets,https://www.hood.markets
WEB_DEPLOY_CORS_ALLOW_LOVABLE=false
LAUNCHER_WEB_URL=https://hood.markets

HOODMARKETS_DEPLOY_CONTEXT_PLATFORM=hoodmarkets
```

**Do not set** `NEYNAR_*`, `DISCORD_*`, `TELEGRAM_*` — not needed.

### Smoke test

```bash
curl https://YOUR-RAILWAY-URL.up.railway.app/
# expect: "webOnlyMode": true, "webDeploy": true
```

---

## 2. Privy (dashboard.privy.io)

Create a **new app** for Hood.markets:

1. **Chains** → add **Robinhood Chain** (chain ID **4663**)
2. **Domains** → allow:
   - `https://hood.markets`
   - `https://www.hood.markets`
   - (optional) `http://localhost:5173` for local dev
3. Copy **App ID** + **App Secret** → Railway env above

---

## 3. Frontend (separate repo)

Fork or clone a Privy launcher frontend, e.g. [privy-heart-landing](https://github.com/anondevv69/privy-heart-landing).

### Frontend env (Vercel / Cloudflare)

```env
VITE_PRIVY_APP_ID=your_privy_app_id
VITE_API_URL=https://YOUR-RAILWAY-URL.up.railway.app
VITE_CHAIN_ID=4663
```

Update the app to:

- Default wallet chain = **Robinhood (4663)**
- Branding = Hood.markets
- Remove Base / multi-chain picker if present

Deploy → connect custom domain **hood.markets** (and `www` CNAME).

---

## 4. DNS (hood.markets)

Typical layout:

| Record | Points to |
|--------|-----------|
| `hood.markets` | Vercel / Cloudflare (frontend) |
| `www` | same as apex or redirect |
| `api.hood.markets` | Railway (optional pretty API URL) |

If you use `api.hood.markets` for Railway, set `VITE_API_URL=https://api.hood.markets` and add that origin to `WEB_DEPLOY_CORS_ORIGINS`.

---

## 5. Optional later

- `ZEROX_API_KEY` — in-app swaps on Robinhood (if 0x supports 4663)
- `SUPABASE_*` or `LIGHTHOUSE_API_KEY` — token images on IPFS
- `PLATFORM_FEE_RECIPIENT` — take a % of LP fees

---

## Architecture

```
hood.markets (Privy UI)  →  Railway API  →  Robinhood contracts (4663)
```
