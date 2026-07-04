# hood.markets — Contracts & SDK

> Robinhood Chain (4663) · Use our on-chain factories on **your own website** or fork the repo and run your own launchpad.

hood.markets is open infrastructure: deploy tokens from any frontend, agent, or script. You do not need to use hood.markets UI — point at the same contracts (or redeploy your own stack from the repo).

**GitHub:** [github.com/anondevv69/hoodmarkets](https://github.com/anondevv69/hoodmarkets)

---

## Launch modes

| Mode | Pool | Trade | Best for |
|------|------|-------|----------|
| **Simple** (`launchMode: "simple"`) | Uniswap V3 | [Uniswap on Robinhood Chain](https://app.uniswap.org/swap?chain=robinhood) | Default — lower gas, familiar AMM |
| **Pro** (`launchMode: "pro"`) | Uniswap V4 + hooks | hood.markets swap helper or Universal Router | Custom hooks, dev-buy, sniper auction |

---

## Contracts (Robinhood mainnet)

Source of truth: [`contracts/deployed-robinhood-mainnet.json`](https://github.com/anondevv69/hoodmarkets/blob/main/contracts/deployed-robinhood-mainnet.json)

### Simple (V3)

| Contract | Address |
|----------|---------|
| HoodMarketsV3 factory | `0xcFE4D69Ac8e5F79a95d99e991162902f68029f09` |
| HoodMarketsV3 vault | `0xe250a07229Bcf29a2cC02d6070beE82252F71C36` |
| HoodMarketsV3 LP locker | `0x209eFAA86568f0Ea0E25d1F0E62f92e81c51a72a` |
| Platform fee wallet (5%) | `0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98` |

Fee split: **95%** to your fee recipient · **5%** platform (on-chain in locker).

### Pro (V4)

| Contract | Address |
|----------|---------|
| HoodMarkets factory | `0xdeBc9bC5c3Ca697493a01e8ac503B590D209d8bD` |
| Fee locker | `0xD588F6F8819Fc0B34fF72300Bb87b8c69C4cD454` |
| Hook (static fee) | `0xCD9DD3fa11c53cf6aE3d4e4D3fdf7C1f790468cc` |
| Hook (dynamic fee) | `0x5de599D4363bb9308434351600c34C96D46868CC` |
| LP locker | `0x34861965c8eFc302E794C8593404CF17c6e65fF0` |
| Swap helper (ETH ↔ token) | `0x6373285F77ad0a3f5a441439B3D23d16B79aA585` |

WETH: `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` · Explorer: [robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com)

---

## TypeScript SDK

**npm:** [`liquid-sdk`](https://www.npmjs.com/package/liquid-sdk) — factory ABIs, deployment config builders, and Pro (V4) helpers.

```bash
npm install liquid-sdk viem
```

### Pro deploy (wallet → factory)

```ts
import { createWalletClient, custom } from 'viem';
import { LiquidFactoryAbi } from 'liquid-sdk';

// Build deploymentConfig off-chain (see hood.markets API /deploy/preview or liquid-sdk builders)
await walletClient.writeContract({
  address: '0xdeBc9bC5c3Ca697493a01e8ac503B590D209d8bD',
  abi: LiquidFactoryAbi,
  functionName: 'deployToken',
  args: [deploymentConfig],
  value: msgValueWei,
});
```

### Simple deploy (V3)

V3 uses `HoodMarketsV3` factory ABI in the repo — see [`web/src/lib/hoodmarketsV3Abi.ts`](https://github.com/anondevv69/hoodmarkets/blob/main/web/src/lib/hoodmarketsV3Abi.ts) and [`web/src/lib/walletDeploy.ts`](https://github.com/anondevv69/hoodmarkets/blob/main/web/src/lib/walletDeploy.ts) for a working wallet flow.

```ts
await walletClient.writeContract({
  address: '0xcFE4D69Ac8e5F79a95d99e991162902f68029f09',
  abi: HOODMARKETS_V3_ABI,
  functionName: 'deployToken',
  args: [v3DeploymentConfig],
  value: msgValueWei,
});
```

---

## Integration paths

### 1. On-chain only (your site, our contracts)

- Add Robinhood Chain (4663) to the user wallet.
- Call `deployToken` on the V3 or V4 factory from your frontend (viem/wagmi/ethers).
- Copy deployment-config building from [`web/src/lib/`](https://github.com/anondevv69/hoodmarkets/tree/main/web/src/lib) or use the preview API below to get serialized configs.

### 2. hood.markets API (hosted preview + catalog)

- **Preview / config:** `POST https://api.hood.markets/api/deploy/preview` (see [`api/docs/`](https://github.com/anondevv69/hoodmarkets/tree/main/api/docs))
- **Public catalog:** `GET https://api.hood.markets/api/deployments`
- **Agents:** [`/agent.md`](/agent.md)

Your site can stay fully custom; the API is optional glue for config generation and indexing.

### 3. Fork & self-host

Clone the monorepo and run your own stack:

| Path | Purpose |
|------|---------|
| [`contracts/`](https://github.com/anondevv69/hoodmarkets/tree/main/contracts) | Foundry — factory, hooks, lockers |
| [`api/`](https://github.com/anondevv69/hoodmarkets/tree/main/api) | Express launcher API |
| [`web/`](https://github.com/anondevv69/hoodmarkets/tree/main/web) | Reference frontend (Vite + Privy) |

Redeploy contracts with `./scripts/deploy-robinhood.sh`, set env vars, and ship your own domain. No separate SDK repo required — fork once and customize.

---

## Trading on third-party sites

- **Simple (V3):** link to Uniswap — `https://app.uniswap.org/swap?chain=robinhood&outputCurrency=0xTOKEN`
- **Pro (V4):** use swap helper `buy` / `sell` or Universal Router (see [`web/src/lib/robinhoodSwap.ts`](https://github.com/anondevv69/hoodmarkets/blob/main/web/src/lib/robinhoodSwap.ts))

---

## Support

- Issues & examples: [github.com/anondevv69/hoodmarkets](https://github.com/anondevv69/hoodmarkets)
- Agent automation: [agent.md](/agent.md)
