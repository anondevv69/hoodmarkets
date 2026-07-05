# HoodMarkets V3 simple launcher

DexScreener- and Uniswap-friendly token launches on **Robinhood Chain (4663)** using **Uniswap V3** pools (1% swap fee).

Forked from upstream v3.1 launchpad contracts and rebranded as **HoodMarkets** — no Clanker labels in our `src/v31/` code.

## Fee split (embedded in contract)

| Recipient | Share | Configurable by creator? |
|-----------|-------|---------------------------|
| **hood.markets platform** | **5%** of swap fees | No — set in `HoodMarketsV3LpLocker.TEAM_REWARD` |
| **Holder NFT share holders** | **95%** of swap fees (pro-rata by share count) | Routed to fraction contract at launch |
| **Share sales (`buyShares`)** | **5%** of listing price to platform fee wallet · **95%** to seller | Same wallet as swap fees (`teamRecipient`) |
| **Share transfers** | **5%** of shares skimmed to platform fee wallet · **95%** to recipient | Exempt: mint/burn, escrow, marketplace settlement, buyer rewards |

The 5% platform wallet is set at locker deploy (`HOODMARKETS_PLATFORM_FEE_RECIPIENT`). The locker **owner** can change the default platform wallet via `updateTeamRecipient()`.

## Embedded 1000-share fraction (v0.5.0+)

Every token launched through **HoodMarkets V3 v0.5.0+** automatically:

| Step | On-chain behavior |
|------|-------------------|
| **Vault** | **10%** of the 100B supply (`FRACTION_VAULT_PERCENTAGE = 10`) |
| **Fraction collection** | New `HoodMarketsV3TokenFraction` ERC-1155 per token (id `#0`, supply **1000**) |
| **Initial holder** | All 1,000 shares go to the fee recipient (`creatorAdmin`) at launch — send, sell, or airdrop via ERC-1155 transfer |
| **Trading fees (95%)** | Routed to the fraction contract; anyone calls `claimTradingFees()` once to pay all share holders pro-rata |
| **Share marketplace** | `listShares` / `buyShares` / `cancelListing` — on-chain escrow; buyer pays listed price; **5% platform fee** + 95% to seller |
| **Pool** | Remaining **90%** seeds the Uniswap V3 pool |

## Buyer reward pool (v0.6+ — enabled by default on new launches)

The factory escrows **10 shares** at launch (`HOODMARKETS_DEFAULT_BUYER_REWARD_SHARES`, default `10`) for automated first-buyer rewards. The fee recipient receives the remaining **990** shares. The API background poller and `POST /api/deployments/:token/process-buyer-rewards` call `issueBuyerShare` — gasless for holders, no wallet popup.

Set `HOODMARKETS_DEFAULT_BUYER_REWARD_SHARES=0` to disable escrow on new launches (legacy wallet-send flow in the UI).

**Tokens launched before this default** have `buyerRewardShareCount = 0` — all 1,000 shares went to the fee recipient; rewards must be sent manually from the wallet.

There is **no SDK toggle** and **no optional vault config** — legacy `vaultConfig` values revert with `LegacyVaultDisabled`. Integrators call `deployToken` exactly as before; fractions are created inside the factory.

Lookup: `fractionCollectionForToken(tokenAddress)` on the factory, or `fractionCollection` in the `TokenCreated` event.

**Deployed on mainnet 4663 (2026-07-05 v0.8.0).** Railway `HOODMARKETS_V3_*` env vars point at the v0.8 factory.

### v0.7 fraction contract

- **`claimTradingFees()`** — one permissionless tx pulls LP fees and pays **every** share holder pro-rata (not caller-only).
- **`listShares` / `buyShares` / `cancelListing`** — on-chain marketplace; seller escrows shares, buyer pays listed price; **5%** to platform fee wallet (`teamRecipient`), **95%** to seller.

**Existing v0.6 tokens keep old behavior** (per-holder fee claim, no marketplace). **v0.7 tokens** have marketplace without share platform fees. **v0.8+** adds 5% on share sales and wallet transfers.

### v0.8 share platform fees (fraction bytecode)

- **`buyShares`** — buyer pays the full listed price; **5%** ETH/ERC-20 to the locker’s platform fee wallet, **95%** to the seller.
- **Wallet transfers** — **5%** of shares skimmed to the platform fee wallet; recipient gets **95%** (integer rounding — transfers under ~20 shares may round to zero fee).
- Exempt: mint/burn, escrow (`listShares` / `cancelListing` / `buyShares` settlement), buyer-reward mints, transfers to/from the platform wallet.

**Existing v0.7 tokens** keep prior marketplace/transfer behavior without these fees.

## Deployed addresses (mainnet 4663)

| Contract | Address |
|----------|---------|
| HoodMarketsV3 factory (v0.8.0) | `0xC2A604fF131dDE9201838007A129ea28b85d00e8` |
| HoodMarketsV3Vault | `0x770C6762e03b7AC2c718e0128F8f16Ad296AACC7` |
| HoodMarketsV3LpLocker | `0x34C912ba3C0dADf036b0a1f0E22aE76Cc36D900D` |
| HoodMarketsV3FractionDeployer | `0x3a6C79aA075647eb221AFf346a0435930a7FB8CC` |
| Platform fee recipient (5%) | `0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98` |
| Contract owner | `0xFA45A3b8d1662E3432D1B5bE3F37e4923D1b796C` |

**Previous factory (v0.7.0):** `0x45A3820A9A563e78A4cF7F355F7Be10fA6B706B3`

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
HOODMARKETS_V3_FACTORY=0xC2A604fF131dDE9201838007A129ea28b85d00e8
HOODMARKETS_V3_VAULT=0x770C6762e03b7AC2c718e0128F8f16Ad296AACC7
HOODMARKETS_V3_LP_LOCKER=0x34C912ba3C0dADf036b0a1f0E22aE76Cc36D900D
HOODMARKETS_V3_FRACTION_DEPLOYER=0x3a6C79aA075647eb221AFf346a0435930a7FB8CC
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
