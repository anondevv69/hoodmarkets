import { createPublicClient, createWalletClient, encodeFunctionData, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../config.js';
import type { DeploymentCatalogRow } from './deploymentCatalog.js';
import { robinhood, robinhoodTxUrl } from './robinhoodChain.js';

export const HOODMARKETS_V3_CLAIM_ABI = [
  {
    type: 'function',
    name: 'claimRewards',
    inputs: [{ name: 'token', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

/** Simple (Uniswap V3) launches — catalog poolId `v3:*` or V3 factory address. */
export function isV3CatalogDeployment(
  row: Pick<DeploymentCatalogRow, 'poolId' | 'factoryAddress'>,
): boolean {
  const poolId = row.poolId?.trim().toLowerCase() ?? '';
  if (poolId.startsWith('v3:')) return true;
  const v3Factory = config.hoodmarketsV3.factory?.trim().toLowerCase();
  const rowFactory = row.factoryAddress?.trim().toLowerCase() ?? '';
  return !!v3Factory && !!rowFactory && rowFactory === v3Factory;
}

/**
 * V3 simple launches: one permissionless tx on HoodMarketsV3 pulls swap fees from the
 * Uniswap V3 LP NFT and sends WETH (95%) to the fee recipient wallet directly.
 */
export async function claimV3RewardsForToken(
  tokenAddress: `0x${string}`,
): Promise<{ txHash: string; basescanUrl: string; message: string }> {
  const factory = config.hoodmarketsV3.factory;
  if (!factory) {
    throw new Error('HoodMarkets V3 factory is not configured on the API.');
  }

  const account = privateKeyToAccount(config.deployerPrivateKey);
  const publicClient = createPublicClient({
    chain: robinhood,
    transport: http(config.chainRpcUrl),
  });
  const walletClient = createWalletClient({
    chain: robinhood,
    transport: http(config.chainRpcUrl),
    account,
  });

  await publicClient.simulateContract({
    address: factory,
    abi: HOODMARKETS_V3_CLAIM_ABI,
    functionName: 'claimRewards',
    args: [tokenAddress],
    account: account.address,
  });

  const data = encodeFunctionData({
    abi: HOODMARKETS_V3_CLAIM_ABI,
    functionName: 'claimRewards',
    args: [tokenAddress],
  });

  const txHash = await walletClient.sendTransaction({
    to: factory,
    data,
    value: 0n,
  });

  return {
    txHash,
    basescanUrl: robinhoodTxUrl(txHash),
    message:
      'V3 swap fees claimed from the pool. WETH goes directly to the fee recipient wallet (95% creator / 5% platform).',
  };
}

export function friendlyV3ClaimError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('execution reverted') || lower.includes('revert')) {
    return (
      'Could not claim V3 fees yet. The pool may have no accrued swap fees, or this token was not deployed via HoodMarkets V3.'
    );
  }
  if (lower.includes('insufficient funds')) {
    return 'Launcher wallet is low on gas. Contact hood.markets support.';
  }
  return msg;
}
