import { parseEther } from 'viem';

const DEFAULT_DEPLOY_BOND_ETH = '0.0001';

/**
 * ETH for launch-time Univ4EthDevBuy (`deployToken` msg.value).
 * - Unset or empty string → default (minimal visible pool activity).
 * - Explicit `0` → no launch buy (gas-only deploy).
 *
 * Note: `parseEther('')` is `0n` in viem, so we must not pass blank env through.
 */
export function parseDeployBondWeiFromEnv(): bigint {
  const raw = process.env.DEPLOY_BOND_ETH?.trim();
  if (raw === undefined || raw === '') {
    return parseEther(DEFAULT_DEPLOY_BOND_ETH);
  }
  return parseEther(raw);
}
