# hood.markets — Contracts & SDK

> **Developer hub:** [hood.markets/Dev](https://hood.markets/Dev)

> Robinhood Chain (**4663**) · Open infrastructure — deploy from any site, agent, or script.

| Resource | Link |
|----------|------|
| **Monorepo** | [github.com/anondevv69/hoodmarkets](https://github.com/anondevv69/hoodmarkets) |
| **TypeScript SDK** | [github.com/anondevv69/hoodmarkets-sdk](https://github.com/anondevv69/hoodmarkets-sdk) |
| **Agent API** | [hood.markets/agent.md](https://hood.markets/agent.md) |
| **Bankr skill** | [skills/hoodmarkets](https://github.com/anondevv69/hoodmarkets/tree/main/skills/hoodmarkets) |
| **V3 contract docs** | [docs/HOODMARKETS_V3.md](https://github.com/anondevv69/hoodmarkets/blob/main/docs/HOODMARKETS_V3.md) |

---

## Platform fees (only two)

| Fee | Split | When |
|-----|--------|------|
| **Uniswap swap / trading fees** | **5%** hood.markets platform · **95%** pro-rata to Holder NFT share holders | Embedded in `HoodMarketsV3LpLocker` at `claimTradingFees()` |
| **Share marketplace sales** (`buyShares`) | **5%** of listed price · **95%** to seller | When someone buys a share listing |

No platform fee on sends, batch airdrops (`airdropShares`), list/cancel escrow, mint/burn, or buyer-reward mints. **5% only on `buyShares` marketplace sales.**

---

## What you can do

### Launch & trade

| Action | How |
|--------|-----|
| **Deploy a token** | SDK `deployToken()`, factory `deployToken()`, or `POST https://api.hood.markets/api/deploy` |
| **Buy / sell the token** | [Uniswap on Robinhood Chain](https://app.uniswap.org/swap?chain=robinhood) — launch LP is **locked**; users swap, not “fund LP” |
| **List on DexScreener** | Automatic for simple (V3) launches |

### Holder NFTs (every simple launch)

Each token gets **1,000 ERC-1155 shares** = **10% of supply** vaulted at launch. All shares mint to the **fee recipient** wallet.

| Action | On-chain | Notes |
|--------|----------|--------|
| **Send shares** | `safeTransferFrom` | Full amount — no platform fee (v0.11+) |
| **Batch airdrop** | `airdropShares(recipients[], amounts[])` | **One tx**, full amounts (v0.10+ bytecode; v0.11+ no skim). hood.markets probes contract before batch. |
| **List shares for sale** | `listShares(amount, paymentToken, price)` | Escrow in contract |
| **Buy a listing** | `buyShares(listingId)` | **5%** platform on sale price |
| **Cancel listing** | `cancelListing(listingId)` | Shares return to seller |
| **Claim swap fees** | `claimTradingFees()` | One tx pays **all** share holders pro-rata (5%/95% split in locker first) |
| **Redeem vault** | `redeem(amount)` | Burn shares → withdraw underlying tokens (forfeit fee rights on burned shares) |
| **Buyer rewards** | `fundBuyerRewardPool` / `cancelBuyerRewardPool` / `issueBuyerShare` | Opt-in **post-launch** on token page (v0.9+) — not on hood.markets launch form |

### Web launch (hood.markets UI)

- **Someone else** fee recipient: **`0x…` wallet address only** — not `@handle` or profile URL.
- **Buyer rewards:** token page after launch — not at deploy.

Lookup fraction contract: `factory.fractionCollectionForToken(tokenAddress)`

### Agents & automation

| Action | API |
|--------|-----|
| Deploy | `POST /api/deploy` |
| Claim swap fees (gasless) | `POST /api/agent/claim` or `POST /api/agent/claim-for-recipient` |
| Token info + Uniswap link | `GET /api/agent/token-info` |
| Catalog | `GET /api/deployments` |

See [agent.md](https://hood.markets/agent.md) and Bankr skill `references/AGENT-API.md`.

---

## Contracts (Robinhood mainnet, v0.11.0)

Source of truth: [`contracts/deployed-hoodmarkets-v3-mainnet.json`](https://github.com/anondevv69/hoodmarkets/blob/main/contracts/deployed-hoodmarkets-v3-mainnet.json)

| Contract | Address |
|----------|---------|
| HoodMarketsV3 factory | `0x9BDdC8ddf28f5629C989A36Eb5bb6C73cBA60Df5` |
| HoodMarketsV3 vault | `0x856c6997A86752fB3E6A494AB93107B7A371A57f` |
| HoodMarketsV3 LP locker | `0x23a1c52F4E93B0283d12CC16c29Df119803E8745` |
| HoodMarketsV3 fraction deployer | `0x40A19d561b3200A2C9E1014248FcEB724c450692` |
| Platform fee wallet (5%) | `0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98` |
| Contract owner | `0xFA45A3b8d1662E3432D1B5bE3F37e4923D1b796C` |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| Uniswap V3 SwapRouter02 | `0xCaf681a66D020601342297493863E78C959E5cb2` |
| Uniswap V3 factory | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` |
| Uniswap V3 position manager | `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` |

**Pro launches (V4):** see [`contracts/deployed-robinhood-mainnet.json`](https://github.com/anondevv69/hoodmarkets/blob/main/contracts/deployed-robinhood-mainnet.json)

**Legacy V3 factories** (existing tokens keep their bytecode): v0.10 `0xf655…85C9`, v0.9 `0x3a94…76c8`, v0.8 `0xC2A6…00e8` — full list in [`skills/hoodmarkets/known-contracts.json`](https://github.com/anondevv69/hoodmarkets/blob/main/skills/hoodmarkets/known-contracts.json)

Explorer: [robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com)

---

## TypeScript SDK

```bash
npm install github:anondevv69/hoodmarkets-sdk viem
```

```ts
import { HoodMarkets, robinhood, ROBINHOOD_RPC_DEFAULT } from 'hoodmarkets-sdk';
import { createPublicClient, createWalletClient, http } from 'viem';

const publicClient = createPublicClient({
  chain: robinhood,
  transport: http(ROBINHOOD_RPC_DEFAULT),
});
const wallet = createWalletClient({
  account,
  chain: robinhood,
  transport: http(ROBINHOOD_RPC_DEFAULT),
});

const hm = new HoodMarkets({ wallet, publicClient });

// Deploy
const result = await hm.deployToken({
  name: 'My Token',
  symbol: 'MTK',
  image: 'ipfs://…',
  feeRecipient: account.address,
  devBuyEth: '0.001',
});
console.log(result.tokenAddress, result.uniswapSwapUrl);

// Trade link for users
console.log(hm.uniswapSwapUrl(result.tokenAddress));
```

### CLI

```bash
npx github:anondevv69/hoodmarkets-sdk deploy --name "My Token" --symbol "MTK" --image "ipfs://…"
npx github:anondevv69/hoodmarkets-sdk claim --token 0x…
```

Full SDK docs: [github.com/anondevv69/hoodmarkets-sdk](https://github.com/anondevv69/hoodmarkets-sdk)

---

## On-chain: claim trading fees

```ts
const fraction = await publicClient.readContract({
  address: '0x9BDdC8ddf28f5629C989A36Eb5bb6C73cBA60Df5',
  abi: factoryAbi,
  functionName: 'fractionCollectionForToken',
  args: [tokenAddress],
});

await wallet.writeContract({
  address: fraction,
  abi: fractionAbi,
  functionName: 'claimTradingFees',
});
```

Locker sends **5% WETH → platform**, **95% → fraction contract**, then pro-rata to all share holders. Legacy v0.6 tokens: `factory.claimRewards(token)` instead.

---

## Integration paths

### 1. SDK / direct on-chain

Point at HoodMarketsV3 factory above. Foundry source: [`contracts/src/v31/`](https://github.com/anondevv69/hoodmarkets/tree/main/contracts/src/v31)

### 2. hood.markets API (catalog + gasless deploy/claim)

- Preview: `POST https://api.hood.markets/api/deploy/preview`
- Catalog: `GET https://api.hood.markets/api/deployments`
- Agents: [agent.md](https://hood.markets/agent.md)

### 3. Fork & self-host

| Path | Purpose |
|------|---------|
| [`contracts/`](https://github.com/anondevv69/hoodmarkets/tree/main/contracts) | Foundry — deploy your own factory |
| [`api/`](https://github.com/anondevv69/hoodmarkets/tree/main/api) | Express launcher API |
| [`web/`](https://github.com/anondevv69/hoodmarkets/tree/main/web) | Reference frontend |

Deploy V3: `./scripts/deploy-hoodmarkets-v3.sh` from `contracts/`

---

## Redeploy factory

```bash
cd contracts
cp .env.robinhood.example .env.robinhood   # DEPLOYER_PRIVATE_KEY=0x…
./scripts/deploy-hoodmarkets-v3.sh
```

Update Railway `HOODMARKETS_V3_*` env vars — see [`api/RAILWAY_ENV_CHECKLIST.md`](https://github.com/anondevv69/hoodmarkets/blob/main/api/RAILWAY_ENV_CHECKLIST.md)

---

## Support

- SDK: [github.com/anondevv69/hoodmarkets-sdk/issues](https://github.com/anondevv69/hoodmarkets-sdk/issues)
- Contracts / API: [github.com/anondevv69/hoodmarkets](https://github.com/anondevv69/hoodmarkets)
- Agents: [agent.md](https://hood.markets/agent.md) · Bankr skill v17
