# Railway Deployment Checklist

## Issue: "Application failed to respond"

This happens when the bot crashes on startup, usually due to missing environment variables.

## Required Environment Variables

Check that ALL of these are set in Railway:

### Core (Required)
- [ ] `DEPLOYER_PRIVATE_KEY` - Your deployer wallet key
- [ ] `NEYNAR_API_KEY` - Neynar API key
- [ ] `NEYNAR_SIGNER_UUID` - Neynar signer UUID
- [ ] `DISCORD_TOKEN` - Discord bot token
- [ ] `DISCORD_CLIENT_ID` - Discord client ID

### Supabase (Optional but recommended)
- [ ] `SUPABASE_URL` - Your Supabase URL
- [ ] `SUPABASE_ANON_KEY` - Supabase anon key
- [ ] `SUPABASE_BUCKET` - `token-images`

### Discord Channels (Optional)
- [ ] `DISCORD_DEBUG_CHANNEL_ID` - Debug channel ID (optional)
- [ ] `DISCORD_FEED_CHANNEL_ID` - Feed channel ID (optional)

### Other (Optional)
- [ ] `BASE_RPC_URL` - RPC URL (defaults to Base mainnet)
- [ ] `DEPLOY_BOND_ETH` - Deploy bond amount (defaults to 0.0001)
- [ ] `PLATFORM_FEE_RECIPIENT` - Platform fee wallet (optional)
- [ ] `PLATFORM_FEE_BPS` - Platform fee % (defaults to 200)
- [ ] `MAX_FEE_RECIPIENT_DEPLOYS_PER_EASTERN_DAY` - Web deploy: max tokens per fee wallet per Eastern day (default `1`; `0` = unlimited)
- [ ] `AGENT_DEPLOY_PAYMENT_TREASURY` - Base `0x` address to receive agent prepayment (enables HTTP 402 + ETH payment instead of EIP-191 deploy signature)
- [ ] `AGENT_DEPLOY_PAYMENT_WEI` - Min wei (default `0.0001` ether); optional raw wei integer string

## How to Fix "Application failed to respond"

### Step 1: Check Variables in Railway

1. Go to Railway dashboard
2. Click your **Liquid Launcher** service
3. Go to **Variables** tab
4. Verify all REQUIRED variables are set (not empty)

### Step 2: Check Logs

1. In Railway, go to **Logs** tab
2. Scroll to bottom to see startup errors
3. Common errors:
   - `Missing required environment variable: DEPLOYER_PRIVATE_KEY`
   - `Error: Cannot read properties of undefined`
   - `NEYNAR: Invalid signer UUID`

### Step 3: Redeploy

After fixing variables:

1. Go to **Deployments** tab
2. Click the failed deployment
3. Click **"Redeploy"** button
4. Wait for new build to complete (2-3 minutes)
5. Check logs for "listening on port 8080" message

### Step 4: Test Health Endpoint

Once deployed, test:

```bash
curl https://liquid-social-launcher-production.up.railway.app/

# Should return JSON like:
# {
#   "status": "ok",
#   "service": "liquid-social-launcher",
#   "platforms": { ... }
# }
```

## Variable Setup Guide

### DEPLOYER_PRIVATE_KEY

Your wallet's private key (pay for gas + deploy bond):

```
1. MetaMask / Web3 wallet
2. Account details → Export private key
3. Copy the hex string (starts with 0x)
4. Paste into DEPLOYER_PRIVATE_KEY
```

### NEYNAR_API_KEY & NEYNAR_SIGNER_UUID

Get from Neynar:

```
1. Go to https://hub.neynar.com/
2. Sign up / Log in
3. Create API key → Copy NEYNAR_API_KEY
4. Your account shows signer UUID → Copy NEYNAR_SIGNER_UUID
```

### DISCORD_TOKEN & DISCORD_CLIENT_ID

```
1. Go to https://discord.com/developers/applications
2. Create New Application
3. Go to "Bot" tab → Add Bot
4. Copy TOKEN → DISCORD_TOKEN
5. Go to "General Information" → Copy CLIENT ID → DISCORD_CLIENT_ID
6. Go to Bot → Privileged Gateway Intents → Toggle all ON
```

### SUPABASE

```
1. Create project at https://supabase.com
2. Settings → API → Copy Project URL → SUPABASE_URL
3. Copy "Anon Public" key → SUPABASE_ANON_KEY
4. Storage → Create bucket "token-images" → Toggle Public ON
5. Set SUPABASE_BUCKET=token-images
```

## Troubleshooting

### "Cannot read properties of undefined"

- Check all REQUIRED variables are set
- Verify no typos in variable names
- Make sure values aren't wrapped in quotes

### "NEYNAR: Invalid API key"

- Go to Neynar hub and regenerate if needed
- Copy the ENTIRE key (no spaces)
- Redeploy

### "Discord token invalid"

- Verify you copied DISCORD_TOKEN (not CLIENT_ID)
- Check bot hasn't been reset
- Generate new token if needed

### Still failing?

1. Delete all variables
2. Re-add only REQUIRED ones
3. Redeploy
4. Check logs
5. Add optional variables one by one

## Quick Checklist

Before Farcaster testing:

- [ ] All REQUIRED env vars are set
- [ ] No empty values (blank strings)
- [ ] DEPLOYER_PRIVATE_KEY is valid hex (0x + 64 chars)
- [ ] DISCORD_TOKEN exists and is fresh
- [ ] NEYNAR_API_KEY and NEYNAR_SIGNER_UUID are correct
- [ ] Redeployed after adding vars
- [ ] Health endpoint returns JSON (not 500 error)
- [ ] Logs show "listening on port 8080"

Once all checks pass, webhook will work! 🚀

