# Holder NFTs (simple / V3 launches)

Every **simple** (`launchMode: "simple"`) token gets an embedded **1,000-share** ERC-1155 vault (10% of token supply).

## Platform fees — only two

| Fee | Split |
|-----|--------|
| **Swap / trading fees** | **5%** hood.markets platform · **95%** pro-rata to share holders — embedded in `HoodMarketsV3LpLocker`; paid via `claimTradingFees()` |
| **Share listings (`buyShares`)** | **5%** of sale price to platform · **95%** to seller |

**Nothing else is taxed** — no fee on wallet sends, airdrops, mint/burn, escrow, or buyer-reward mints.

> **Legacy v0.8–v0.10 factories** incorrectly skimmed shares on wallet sends (and v0.10 on airdrops). New launches must use **v0.11+** factory for the policy above.

## At launch

| Default | Behavior |
|---------|----------|
| **Fee recipient** | Receives all **1,000** shares |
| **Buyer rewards** | Post-launch opt-in — `fundBuyerRewardPool` on token page (v0.9+) |

## Trading & LP

- Launch LP is **locked** — users **buy/sell the token** on Uniswap, not “fund LP” on hood.markets
- Hold shares to earn the **95%** swap-fee slice pro-rata

## Claim fees (agents)

`POST /api/agent/claim` or `POST /api/agent/claim-for-recipient`:

- API calls **`claimTradingFees()`** on the fraction (v0.7+) — locker 5%/95% split, then pro-rata to holders
- Legacy v0.6: `HoodMarketsV3.claimRewards(token)` (fee wallet only)

No Bankr `/wallet/submit` for claims.

## Factory versions (Robinhood mainnet)

| Version | Factory | Notes |
|---------|---------|--------|
| **v0.11.0** (current) | `0x9BDdC8ddf28f5629C989A36Eb5bb6C73cBA60Df5` | Two fees only: swap + marketplace sales |
| v0.10.0 | `0xf65536Eb3354Ad7e77E1b0d0F7bEBFa1C88885C9` | Legacy: skimmed sends/airdrops |
| v0.9.0 | `0x3a94FD3422F50ed6cC08e547c6C697E4bb3e76c8` | + buyer reward fund/cancel |

## Agent guidance

- Only two platform fees: **swap trading fees (5%/95%)** and **share sale price (5%/95%)**
- Do not promise “fund the LP” — direct users to buy the token or buy shares on listings
