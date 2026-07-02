import { getAddress } from 'viem';
import { resolveSocialClaimDeployment } from './claimDeploymentAuth.js';
import { markDeploymentFeeClaimed } from './deploymentCatalog.js';
import { claimWethTradingFeesForFeeOwner } from './feeLockerClaim.js';

export type SocialFeeClaimOutcome =
  | {
      ok: true;
      basescanUrl: string;
      txHash: string;
      feeAmountHuman: string;
      tokenAddress: string;
    }
  | { ok: false; message: string };

/**
 * Resolve catalog + broadcast WETH fee claim for a social deployer (same fee wallet as at deploy time).
 */
export async function runSocialTradingFeesClaim(params: {
  platform: string;
  deployerId: string;
  feeRecipientAddress: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  tokenName?: string;
}): Promise<SocialFeeClaimOutcome> {
  let fee: string;
  try {
    fee = getAddress(params.feeRecipientAddress);
  } catch {
    return { ok: false, message: 'Could not resolve a valid fee wallet for your account.' };
  }

  const resolved = await resolveSocialClaimDeployment({
    platform: params.platform,
    deployerId: params.deployerId,
    feeRecipient: fee,
    tokenAddress: params.tokenAddress,
    tokenSymbol: params.tokenSymbol,
    tokenName: params.tokenName,
  });

  if (!resolved.ok) {
    return { ok: false, message: resolved.error };
  }

  const feeOwner = getAddress(resolved.row.feeRecipientAddress) as `0x${string}`;
  const claimed = await claimWethTradingFeesForFeeOwner(feeOwner);
  if (!claimed.ok) {
    return { ok: false, message: claimed.error };
  }

  const feeHuman = Number(claimed.feeAmountWei) / 1e18;
  await markDeploymentFeeClaimed(resolved.tokenAddress, claimed.txHash);
  return {
    ok: true,
    basescanUrl: claimed.basescanUrl,
    txHash: claimed.txHash,
    feeAmountHuman: feeHuman.toFixed(6),
    tokenAddress: resolved.tokenAddress,
  };
}
