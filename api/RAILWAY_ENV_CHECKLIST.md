# Railway deployment checklist (hood.markets API)

Service: **api.hood.markets** · Repo: **anondevv69/hoodmarkets** · Root directory: **`api`**

## "Application failed to respond" (502)

The API process is not running. Browsers often report this as a **CORS error** — fix the 502 first.

### Step 1: Root directory

In Railway → **Settings → Root Directory** → must be **`api`**.

The monorepo has no root `package.json`. Deploying from repo root will fail to build/start.

### Step 2: Required variables (`WEB_ONLY_MODE=true`)

- [ ] `WEB_ONLY_MODE=true`
- [ ] `NODE_ENV=production`
- [ ] `DEPLOYER_PRIVATE_KEY` — deployer wallet (0x + 64 hex chars)
- [ ] `ROBINHOOD_RPC_URL` — `https://rpc.mainnet.chain.robinhood.com`
- [ ] `HOODMARKETS_FACTORY` — from `contracts/deployed-robinhood-mainnet.json`
- [ ] `HOODMARKETS_FEE_LOCKER`
- [ ] `HOODMARKETS_HOOK_DYNAMIC_FEE_V2`
- [ ] `HOODMARKETS_HOOK_STATIC_FEE_V2`
- [ ] `HOODMARKETS_LP_LOCKER_FEE_CONVERSION`
- [ ] `HOODMARKETS_SNIPER_AUCTION_V2`
- [ ] `HOODMARKETS_UNIV4_ETH_DEV_BUY`
- [ ] `PRIVY_APP_ID`
- [ ] `PRIVY_APP_SECRET`
- [ ] `AGENT_CAPTCHA_JWT_SECRET` — HS256 secret for Bankr/agent haiku JWT (`openssl rand -hex 32`). Required for `POST /api/agent-captcha/verify`, agent deploy, and agent claim.

**Not required** for web-only: `NEYNAR_*`, `DISCORD_*`, `TELEGRAM_*`.

### Step 3: Volume

Mount path: **`/app/.data`** (persists deployment catalog SQLite DB).

### Step 4: CORS (browser deploys from Vercel)

- [ ] `WEB_DEPLOY_CORS_ALLOW_VERCEL=true` (default — allows `https://*.vercel.app`)
- [ ] `WEB_DEPLOY_CORS_ORIGINS=https://hood.markets,https://www.hood.markets`
- [ ] `LAUNCHER_WEB_URL=https://hood.markets`

### Step 5: Logs and redeploy

1. Railway → **Logs** → scroll to startup error
2. Fix variables → **Deployments → Redeploy**
3. Wait for `🚀 Liquid Social Launcher running on port …` (or hood-markets-api in health JSON)

### Step 6: Health check

```bash
curl https://api.hood.markets/
```

Expected:

```json
{
  "status": "ok",
  "service": "hood-markets-api",
  "webOnlyMode": true,
  "platforms": { "webDeploy": true }
}
```

CORS check:

```bash
curl -sI -H "Origin: https://hood.markets" https://api.hood.markets/api/web-deploy-config
```

Expected header: `access-control-allow-origin: https://hood.markets`

---

## Optional variables

- `LIGHTHOUSE_API_KEY` — IPFS logo uploads from Launch tab
- `PLATFORM_FEE_RECIPIENT` / `PLATFORM_FEE_BPS` — platform LP fee share
- `ZEROX_API_KEY` — in-app swaps (if supported on 4663)
- `DEPLOY_BOND_ETH` — dev buy ETH (default ~0.0001)

---

## Full setup guide

See [`docs/HOOD_MARKETS_SETUP.md`](../docs/HOOD_MARKETS_SETUP.md) in the repo root.
