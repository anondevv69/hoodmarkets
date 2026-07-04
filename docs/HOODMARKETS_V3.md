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

Every token launched through **HoodMarkets V3 v0.5.0** automatically:

| Step | On-chain behavior |
|------|-------------------|
| **Vault** | **10%** of the 100B supply (`FRACTION_VAULT_PERCENTAGE = 10`) |
| **Fraction collection** | New `HoodMarketsV3TokenFraction` ERC-1155 per token (id `#0`, supply **1000**) |
| **Initial holder** | All 1000 shares go to `creatorAdmin` — sell via transfers, redeem via `redeem(amount)` |
| **Trading fees (95%)** | Routed to the fraction contract; holders call `claimTradingFees()` for pro-rata WETH/token |
| **Pool** | Remaining **90%** seeds the Uniswap V3 pool |

**v0.4.0 tokens** mint shares but route fees to a single wallet — upgrade requires a new factory deploy.

There is **no SDK toggle** and **no optional vault config** — legacy `vaultConfig` values revert with `LegacyVaultDisabled`. Integrators call `deployToken` exactly as before; fractions are created inside the factory.

Lookup: `fractionCollectionForToken(tokenAddress)` on the factory, or `fractionCollection` in the `TokenCreated` event.

**Deployed on mainnet 4663 (2026-07-04 v0.5.0).** Railway `HOODMARKETS_V3_*` env vars point at the v0.5 factory.

## Deployed addresses (mainnet 4663)

| Contract | Address |
|----------|---------|
| HoodMarketsV3 factory (v0.5.0) | `0x4c18e43F8B8b63f42a944b98b8af29f576c7Ffa8` |
| HoodMarketsV3Vault | `0x1b84cBb1837F17d6d433195b7e57E869b3522848` |
| HoodMarketsV3LpLocker | `0x5296C54C3f5D8d0e0ced4A95BC6B85d6Db715AD5` |
| HoodMarketsV3FractionDeployer | `0x77Aea5d5EAae608d932bfD1e99fCf83e983c3641` |
| Platform fee recipient (5%) | `0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98` |
| Contract owner | `0xFA45A3b8d1662E3432D1B5bE3F37e4923D1b796C` |

**Previous factory (v0.4.0, deprecated on-chain):** `0xbd794cd9E10728Bb1CB5056A92830C3e945cE7b4`

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
HOODMARKETS_V3_FACTORY=0x4c18e43F8B8b63f42a944b98b8af29f576c7Ffa8
HOODMARKETS_V3_VAULT=0x1b84cBb1837F17d6d433195b7e57E869b3522848
HOODMARKETS_V3_LP_LOCKER=0x5296C54C3f5D8d0e0ced4A95BC6B85d6Db715AD5
HOODMARKETS_V3_FRACTION_DEPLOYER=0x77Aea5d5EAae608d932bfD1e99fCf83e983c3641
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

Creators call `HoodMarketsV3LpLocker.collectRewards(positionId)` (or `HoodMarketsV3.claimRewards(token)`). UI claim flow for V3 is planned; use Blockscout write contract for now.

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
