# HoodMarkets V3 simple launcher

DexScreener- and Uniswap-friendly token launches on **Robinhood Chain (4663)** using **Uniswap V3** pools (1% swap fee).

Forked from upstream v3.1 launchpad contracts and rebranded as **HoodMarkets** — no Clanker labels in our `src/v31/` code.

## Fee split (embedded in contract)

| Recipient | Share | Configurable by creator? |
|-----------|-------|---------------------------|
| **hood.markets platform** | **5%** of swap fees | No — set in `HoodMarketsV3LpLocker.TEAM_REWARD` |
| **Creator (fee wallet)** | **95%** of swap fees | Recipient wallet: yes (`creatorAdmin` can call `updateCreatorRewardRecipient`) |

The 5% platform wallet is set at locker deploy (`HOODMARKETS_PLATFORM_FEE_RECIPIENT`). The locker **owner** can change the default platform wallet via `updateTeamRecipient()`.

## Deployed addresses (mainnet 4663)

| Contract | Address |
|----------|---------|
| HoodMarketsV3 factory | `0xa77911C301b30283ca3dBc32812839AdF443b39f` |
| HoodMarketsV3Vault | `0xcc4554b1C6b33b36A91a306dB3f8b13cBe92639E` |
| HoodMarketsV3LpLocker | `0x8eB68121E5c7a5aAf440a5C66c0C66b828B96fA8` |
| Platform fee recipient (5%) | `0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98` (hoodfees treasury) |
| Planned contract owner | `0xFA45A3b8d1662E3432D1B5bE3F37e4923D1b796C` (hoodmarkets admin) |

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
HOODMARKETS_V3_FACTORY=0xa77911C301b30283ca3dBc32812839AdF443b39f
HOODMARKETS_V3_VAULT=0xcc4554b1C6b33b36A91a306dB3f8b13cBe92639E
HOODMARKETS_V3_LP_LOCKER=0x8eB68121E5c7a5aAf440a5C66c0C66b828B96fA8
HOODMARKETS_V3_PLATFORM_FEE_RECIPIENT=0xA558E3058050448f07Df73a2509f23B7912395Da
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
