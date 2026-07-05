# hood.markets — Contracts & SDK

> **Developer hub:** [hood.markets/Dev](https://hood.markets/Dev)

> **For agents:** Copy this file or point your agent at `https://hood.markets/sdk.md` — contract addresses, SDK usage, and integration paths below.

> Robinhood Chain (4663) · Use our **Uniswap V3** factories on **your own website** or fork the repo and run your own launchpad.

hood.markets is open infrastructure: deploy tokens from any frontend, agent, or script. You do not need to use hood.markets UI — point at the same on-chain contracts (or redeploy your own stack from the repo).

| Resource | Link |
|----------|------|
| **SDK (GitHub)** | [github.com/anondevv69/hoodmarkets-sdk](https://github.com/anondevv69/hoodmarkets-sdk) |
| **Agent reference (this file)** | [hood.markets/sdk.md](https://hood.markets/sdk.md) |
| **Contracts / monorepo** | [github.com/anondevv69/hoodmarkets](https://github.com/anondevv69/hoodmarkets) |
| **Agent API** | [hood.markets/agent.md](https://hood.markets/agent.md) |

---

## Launch model

All hood.markets tokens deploy through **HoodMarkets V3** — Uniswap V3 pools on Robinhood Chain.

| | |
|---|---|
| **Pool** | Uniswap V3 |
| **Trade** | [Uniswap on Robinhood Chain](https://app.uniswap.org/swap?chain=robinhood) |
| **Fee split** | **95%** to your fee recipient · **5%** platform (on-chain in locker) |
| **API / agents** | `launchMode: "simple"` (default) |

---

## Contracts (Robinhood mainnet)

Source of truth: [`deployed-robinhood-mainnet.json`](https://github.com/anondevv69/hoodmarkets-sdk/blob/main/deployed-robinhood-mainnet.json)

| Contract | Address |
|----------|---------|
| HoodMarketsV3 factory (v0.8.0) | `0xC2A604fF131dDE9201838007A129ea28b85d00e8` |
| HoodMarketsV3 vault | `0x770C6762e03b7AC2c718e0128F8f16Ad296AACC7` |
| HoodMarketsV3 LP locker | `0x34C912ba3C0dADf036b0a1f0E22aE76Cc36D900D` |
| HoodMarketsV3 fraction deployer | `0x3a6C79aA075647eb221AFf346a0435930a7FB8CC` |
| Platform fee wallet (5%) | `0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98` |
| Contract owner | `0xFA45A3b8d1662E3432D1B5bE3F37e4923D1b796C` |
| Uniswap V3 SwapRouter02 | `0xCaf681a66D020601342297493863E78C959E5cb2` |

WETH: `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` · Explorer: [robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com)

---

## TypeScript SDK

Install from GitHub until the npm package is published:

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

const wallet = createWalletClient({ account, chain: robinhood, transport: http(ROBINHOOD_RPC_DEFAULT) });

const hm = new HoodMarkets({ wallet, publicClient });

const result = await hm.deployToken({
  name: 'My Token',
  symbol: 'MTK',
  image: 'ipfs://…',
  feeRecipient: account.address,
  devBuyEth: '0.001',
});

console.log(result.tokenAddress);
console.log(result.uniswapSwapUrl);
```

### CLI

```bash
npx github:anondevv69/hoodmarkets-sdk deploy --name "My Token" --symbol "MTK" --image "ipfs://…"
npx github:anondevv69/hoodmarkets-sdk claim --token 0x…
```

Full docs: [github.com/anondevv69/hoodmarkets-sdk](https://github.com/anondevv69/hoodmarkets-sdk)

---

## Integration paths

### 1. SDK / on-chain (your site, our contracts)

- Install **`hoodmarkets-sdk`** and deploy with `HoodMarkets.deployToken()`.
- Or call `deployToken` on the factory directly with viem/wagmi/ethers.

### 2. hood.markets API (hosted preview + catalog)

- **Preview / config:** `POST https://api.hood.markets/api/deploy/preview`
- **Public catalog:** `GET https://api.hood.markets/api/deployments`
- **Agents:** [`/agent.md`](/agent.md)

Your site can stay fully custom; the API is optional glue for config generation and indexing.

### 3. Fork & self-host

Clone the monorepo and run your own stack:

| Path | Purpose |
|------|---------|
| [`contracts/`](https://github.com/anondevv69/hoodmarkets/tree/main/contracts) | Foundry — HoodMarkets V3 factory, vault, locker |
| [`api/`](https://github.com/anondevv69/hoodmarkets/tree/main/api) | Express launcher API |
| [`web/`](https://github.com/anondevv69/hoodmarkets/tree/main/web) | Reference frontend (Vite + Privy) |

---

## Trading on third-party sites

Link users to Uniswap on Robinhood Chain:

```
https://app.uniswap.org/swap?chain=robinhood&outputCurrency=0xTOKEN
```

Or use `hm.uniswapSwapUrl(tokenAddress, '0.005')` from the SDK.

---

## Claim fees

```ts
await hm.claimRewards('0xYourToken');
```

Or via the hood.markets API: `POST https://api.hood.markets/api/agent/claim` — see [`/agent.md`](/agent.md).

---

## Support

- SDK issues: [github.com/anondevv69/hoodmarkets-sdk](https://github.com/anondevv69/hoodmarkets-sdk/issues)
- Contracts / API: [github.com/anondevv69/hoodmarkets](https://github.com/anondevv69/hoodmarkets)
- Agent automation: [agent.md](/agent.md)
