import { isV3PoolId } from './poolId';

/** HoodMarkets V3 factory on Robinhood mainnet — all current simple launches. */
export const HOODMARKETS_V3_FACTORY = '0x4c18e43F8B8b63f42a944b98b8af29f576c7Ffa8';

/** Catalog row is a Simple (Uniswap V3) launch — matches API `isV3CatalogDeployment`. */
export function isSimpleLaunchDeployment(input: {
  poolId?: string | null;
  factoryAddress?: string | null;
}): boolean {
  if (isV3PoolId(input.poolId)) return true;
  const factory = input.factoryAddress?.trim().toLowerCase();
  if (factory && factory === HOODMARKETS_V3_FACTORY.toLowerCase()) return true;
  return false;
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
