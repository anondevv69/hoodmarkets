/** Simple (V3) launches use catalog poolId prefix `v3:`. */
export function isV3PoolId(poolId?: string | null): boolean {
  return !!poolId && poolId.toLowerCase().startsWith('v3:');
}
