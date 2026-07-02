import { config } from '../config.js';
import {
  countDeploymentsForFeeRecipientCurrentEasternDay,
  countOtherFeeDeploymentsCurrentEasternDay,
  countThirdPartyFeeRecipientDeploymentsRollingHours,
  type SelfFeeCountKey,
} from './deploymentCatalog.js';
import { deployRateLimitRollingHours } from './selfFeeLimit.js';

/** Eastern-day cap on rows per fee wallet. Env: `MAX_FEE_RECIPIENT_DEPLOYS_PER_EASTERN_DAY`. */
export function maxFeeRecipientDeploysPerEasternDay(): number {
  return config.maxFeeRecipientDeploysPerEasternDay;
}

/**
 * Whether this fee wallet already hit the **Eastern calendar day** cap (all fee types to that address).
 */
export async function shouldForceMemeDueToFeeRecipientLimit(
  feeRecipientAddress: string,
): Promise<boolean> {
  const max = maxFeeRecipientDeploysPerEasternDay();
  if (max <= 0) return false;
  const n = await countDeploymentsForFeeRecipientCurrentEasternDay(feeRecipientAddress);
  return n >= max;
}

/** Rolling cap on third-party rows only. Env: `MAX_THIRD_PARTY_FEE_TO_WALLET_PER_24H`. */
export function maxThirdPartyFeeToSameWalletPerRollingWindow(): number {
  return config.maxThirdPartyFeeToSameWalletPerRollingWindow;
}

export async function shouldForceMemeDueToThirdPartyWalletRateLimit(
  feeRecipientAddress: string,
): Promise<boolean> {
  const max = maxThirdPartyFeeToSameWalletPerRollingWindow();
  if (max <= 0) return false;
  const h = deployRateLimitRollingHours();
  if (h <= 0) return false;
  const n = await countThirdPartyFeeRecipientDeploymentsRollingHours(feeRecipientAddress, h);
  return n >= max;
}

/** Per deployer: Eastern-day cap on third-party fee deploys they initiate. */
export function maxOtherFeeDeploysPerEasternDay(): number {
  return config.x.maxOtherFeeDeploysPerEasternDay;
}

export async function shouldForceMemeDueToOtherFeeLimit(
  key: SelfFeeCountKey,
): Promise<boolean> {
  const max = maxOtherFeeDeploysPerEasternDay();
  if (max <= 0) return false;
  const n = await countOtherFeeDeploymentsCurrentEasternDay(key);
  return n >= max;
}
