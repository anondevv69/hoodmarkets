import { isV3PoolId } from './poolId';

/** HoodMarkets V3 factory on Robinhood mainnet (v0.11.0 — sales-only share fees). */
export const HOODMARKETS_V3_FACTORY = '0x9BDdC8ddf28f5629C989A36Eb5bb6C73cBA60Df5';

/** All production V3 factories — older tokens remain valid in catalog/UI. */
export const HOODMARKETS_V3_FACTORIES = [
  HOODMARKETS_V3_FACTORY,
  '0xf65536Eb3354Ad7e77E1b0d0F7bEBFa1C88885C9', // v0.10.0
  '0x3a94FD3422F50ed6cC08e547c6C697E4bb3e76c8', // v0.9.0
  '0xC2A604fF131dDE9201838007A129ea28b85d00e8', // v0.8.0
  '0x45A3820A9A563e78A4cF7F355F7Be10fA6B706B3', // v0.7.0
  '0x7E2905ddF3Dca96117A9e9d50F2924C1E7FE7Be1', // v0.6.0
  '0x4c18e43F8B8b63f42a944b98b8af29f576c7Ffa8', // v0.5.0
] as const;

export function isHoodMarketsV3Factory(address: string | null | undefined): boolean {
  const factory = address?.trim().toLowerCase();
  if (!factory) return false;
  return HOODMARKETS_V3_FACTORIES.some((f) => f.toLowerCase() === factory);
}

/** v0.9+ fraction contracts expose fundBuyerRewardPool / cancelBuyerRewardPool post-launch. */
export function supportsPostLaunchBuyerRewards(factoryAddress: string | null | undefined): boolean {
  const factory = factoryAddress?.trim().toLowerCase();
  if (!factory) return false;
  return [
    HOODMARKETS_V3_FACTORY,
    '0xf65536Eb3354Ad7e77E1b0d0F7bEBFa1C88885C9',
    '0x3a94FD3422F50ed6cC08e547c6C697E4bb3e76c8',
  ].some((f) => f.toLowerCase() === factory);
}

/** Catalog row is a Simple (Uniswap V3) launch — matches API `isV3CatalogDeployment`. */
export function isSimpleLaunchDeployment(input: {
  poolId?: string | null;
  factoryAddress?: string | null;
}): boolean {
  if (isV3PoolId(input.poolId)) return true;
  return isHoodMarketsV3Factory(input.factoryAddress);
}

/** Pro (V4) — hex pool id, not `v3:`. */
export function isProLaunchDeployment(input: {
  poolId?: string | null;
  factoryAddress?: string | null;
}): boolean {
  const poolId = input.poolId?.trim();
  if (!poolId) return false;
  if (isV3PoolId(poolId)) return false;
  return true;
}
