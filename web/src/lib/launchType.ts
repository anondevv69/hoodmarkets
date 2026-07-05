import { isV3PoolId } from './poolId';

/** HoodMarkets V3 factory on Robinhood mainnet (v0.7.0 — pay-all fees + share marketplace). */
export const HOODMARKETS_V3_FACTORY = '0x45A3820A9A563e78A4cF7F355F7Be10fA6B706B3';

/** All production V3 factories — older tokens remain valid in catalog/UI. */
export const HOODMARKETS_V3_FACTORIES = [
  HOODMARKETS_V3_FACTORY,
  '0x7E2905ddF3Dca96117A9e9d50F2924C1E7FE7Be1', // v0.6.0
  '0x4c18e43F8B8b63f42a944b98b8af29f576c7Ffa8', // v0.5.0
] as const;

export function isHoodMarketsV3Factory(address: string | null | undefined): boolean {
  const factory = address?.trim().toLowerCase();
  if (!factory) return false;
  return HOODMARKETS_V3_FACTORIES.some((f) => f.toLowerCase() === factory);
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
