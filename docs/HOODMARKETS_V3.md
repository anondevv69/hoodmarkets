# HoodMarkets V3 simple launcher

DexScreener- and Uniswap-friendly token launches on **Robinhood Chain (4663)** using **Uniswap V3** pools (1% swap fee).

Forked from upstream v3.1 launchpad contracts and rebranded as **HoodMarkets** — no Clanker labels in our `src/v31/` code.

## Fee split (embedded in contract)

| Recipient | Share | Configurable by creator? |
|-----------|-------|---------------------------|
| **hood.markets platform** | **5%** of swap fees | No — set in `HoodMarketsV3LpLocker.TEAM_REWARD` |
| **Holder NFT share holders** | **95%** of swap fees (pro-rata by share count) | Routed to fraction contract at launch |

The 5% platform wallet is set at locker deploy (`HOODMARKETS_PLATFORM_FEE_RECIPIENT`). The locker **owner** can change the default platform wallet via `updateTeamRecipient()`.

## Embedded 1000-share fraction (v0.5.0+)

Every token launched through **HoodMarkets V3 v0.5.0+** automatically:

| Step | On-chain behavior |
|------|-------------------|
| **Vault** | **10%** of the 100B supply (`FRACTION_VAULT_PERCENTAGE = 10`) |
| **Fraction collection** | New `HoodMarketsV3TokenFraction` ERC-1155 per token (id `#0`, supply **1000**) |
| **Initial holder** | All 1,000 shares go to the fee recipient (`creatorAdmin`) at launch — send, sell, or airdrop via ERC-1155 transfer |
| **Trading fees (95%)** | Routed to the fraction contract; anyone calls `claimTradingFees()` once to pay all share holders pro-rata |
| **Share marketplace** | `listShares` / `buyShares` / `cancelListing` — on-chain escrow; ETH (or ERC-20) to seller in one tx |
| **Pool** | Remaining **90%** seeds the Uniswap V3 pool |

## Buyer reward pool (v0.6 contract — optional, not used in UI yet)

The v0.6 factory supports escrowing X shares for automated first-buyer rewards (`buyerRewardShareCount`). **hood.markets launches with X = 0 today** — all 1,000 shares go to the fee recipient, who distributes manually (airdrop, OTC, scripts, etc.). API endpoints exist for a future automation pass; default product flow is wallet-controlled transfers.

**v0.5.0 tokens** and **v0.6 with X=0** behave the same for holders: fee recipient starts with all shares.

There is **no SDK toggle** and **no optional vault config** — legacy `vaultConfig` values revert with `LegacyVaultDisabled`. Integrators call `deployToken` exactly as before; fractions are created inside the factory.

Lookup: `fractionCollectionForToken(tokenAddress)` on the factory, or `fractionCollection` in the `TokenCreated` event.

**Deployed on mainnet 4663 (2026-07-04 v0.6.0).** Railway `HOODMARKETS_V3_*` env vars point at the v0.6 factory.

### v0.7 fraction contract (redeploy required)

New `HoodMarketsV3TokenFraction` bytecode adds:

- **`claimTradingFees()`** — one permissionless tx pulls LP fees and pays **every** share holder pro-rata (not caller-only).
- **`listShares` / `buyShares` / `cancelListing`** — on-chain marketplace; seller escrows shares, buyer pays ETH in one tx.

**Existing v0.6 tokens keep old behavior.** Redeploy V3 stack (see below), update Railway `HOODMARKETS_V3_*`, redeploy API + web. New launches only.

## Deployed addresses (mainnet 4663)

| Contract | Address |
|----------|---------|
| HoodMarketsV3 factory (v0.6.0) | `0x7E2905ddF3Dca96117A9e9d50F2924C1E7FE7Be1` |
| HoodMarketsV3Vault | `0xdad973Ec5f0B56D64326dB78de9d90Aa9acDB842` |
| HoodMarketsV3LpLocker | `0x48BCd46147a74A186913d41aE0e7210C03910fA5` |
| HoodMarketsV3FractionDeployer | `0x722AfdFa376844497783A1EAb3B3490Ff8eb8bB2` |
| Platform fee recipient (5%) | `0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98` |
| Contract owner | `0xFA45A3b8d1662E3432D1B5bE3F37e4923D1b796C` |

**Previous factory (v0.5.0):** `0x4c18e43F8B8b63f42a944b98b8af29f576c7Ffa8`

**Previous factory (v0.3.1):** `0xcFE4D69Ac8e5F79a95d99e991162902f68029f09`

**Earlier test factory:** `0xa77911C301b30283ca3dBc32812839AdF443b39f`

Robinhood Uniswap V3 infra:

| Contract | Address |
|----------|---------|
| V3 Factory | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` |
| V3 Position Manager | `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` |
| V3 SwapRouter02 | `0xCaf681a66D020601342297493863E78C959E5cb2` |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |

## Contract deploy

```bash
cd contracts
# .env.robinhood: DEPLOYER_PRIVATE_KEY, ROBINHOOD_RPC_URL, WETH, plus:
# UNISWAP_V3_FACTORY, UNISWAP_V3_POSITION_MANAGER, UNISWAP_V3_SWAP_ROUTER
# HOODMARKETS_PLATFORM_FEE_RECIPIENT=<hoodfees treasury — 5% of swap fees>
# HOODMARKETS_OWNER=<admin wallet — defaults to deployer if unset>
forge script script/robinhood/10_DeployHoodMarketsV3.s.sol:DeployHoodMarketsV3 \
  --rpc-url "$ROBINHOOD_RPC_URL" --broadcast --slow
```

## API / Railway env

Add to `api.hood.markets` (alongside existing V4 vars):

```env
HOODMARKETS_V3_FACTORY=0x7E2905ddF3Dca96117A9e9d50F2924C1E7FE7Be1
HOODMARKETS_V3_VAULT=0xdad973Ec5f0B56D64326dB78de9d90Aa9acDB842
HOODMARKETS_V3_LP_LOCKER=0x48BCd46147a74A186913d41aE0e7210C03910fA5
HOODMARKETS_V3_FRACTION_DEPLOYER=0x722AfdFa376844497783A1EAb3B3490Ff8eb8bB2
HOODMARKETS_V3_PLATFORM_FEE_RECIPIENT=0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98
HOODMARKETS_DEFAULT_LAUNCH_MODE=simple
```

### Changing wallets

| Role | Env var | Notes |
|------|---------|-------|
| **Deployer** (pays gas + launch seed) | `DEPLOYER_PRIVATE_KEY` | Fund this wallet on Robinhood |
| **Platform 5% fees** | `HOODMARKETS_PLATFORM_FEE_RECIPIENT` at deploy, or `updateTeamRecipient` on locker | New tokens use updated default |
| **V4 platform slice** (optional) | `PLATFORM_FEE_RECIPIENT` + `PLATFORM_FEE_BPS` | Pro launches only |

## Web launch modes

- **Simple** (default): `launchMode: "simple"` → HoodMarkets V3
- **Pro**: `launchMode: "pro"` → existing HoodMarkets V4 hook stack

## Claiming V3 fees

Anyone triggers **`claimTradingFees()`** on the token’s Holder NFT contract (`fractionCollectionForToken`). One transaction pulls swap fees from the LP and pays every share holder pro-rata. The hood.markets site and `POST /api/deployments/:token/claim-fees` broadcast this from the launcher wallet.

## Redeploy V3 (v0.7+)

From `contracts/` with `.env.robinhood` funded:

```bash
forge test --match-contract HoodMarketsV3TokenFractionTest

forge script script/robinhood/10_DeployHoodMarketsV3.s.sol:DeployHoodMarketsV3 \
  --rpc-url "$ROBINHOOD_RPC_URL" --broadcast --slow -vvv
```

Copy logged addresses into Railway (`api/RAILWAY_ENV_CHECKLIST.md`):

- `HOODMARKETS_V3_FACTORY`
- `HOODMARKETS_V3_VAULT`
- `HOODMARKETS_V3_LP_LOCKER`
- `HOODMARKETS_V3_FRACTION_DEPLOYER` (implicit in factory init — log line `HoodMarketsV3FractionDeployer`)
- Keep `HOODMARKETS_V3_PLATFORM_FEE_RECIPIENT` unless changing treasury

Then **Redeploy Railway API** and **Vercel web**. Optional: verify new factory on Blockscout (`contracts/scripts/verify-robinhood.sh` pattern for V3 contracts).

**Do not** mark the old factory `deprecated` until you are ready — existing tokens stay on the old fraction bytecode forever.

## Move admin to a Gnosis Safe (later)

All three V3 contracts use OpenZeppelin `Ownable`. After you deploy a Safe on Robinhood Chain (4663), transfer admin in one script:

```bash
# .env.robinhood: DEPLOYER_PRIVATE_KEY = current owner (0xFA45…)
HOODMARKETS_V3_FACTORY=<deployed>
HOODMARKETS_V3_VAULT=<deployed>
HOODMARKETS_V3_LP_LOCKER=<deployed>
HOODMARKETS_NEW_OWNER=<safe address on 4663>

forge script script/robinhood/11_TransferOwnershipV3.s.sol:TransferOwnershipV3 \
  --rpc-url "$ROBINHOOD_RPC_URL" --broadcast
```

The **5% fee wallet** (`HOODMARKETS_PLATFORM_FEE_RECIPIENT`) is separate from owner. To change it later without redeploying, the locker owner calls `updateTeamRecipient(newTreasury)`.
