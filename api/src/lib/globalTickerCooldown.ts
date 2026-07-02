import { getAddress } from 'viem';
import { config } from '../config.js';
import { BASE_DEAD_FEE_RECIPIENT } from './deadFeeWallet.js';
import {
  countThirdPartyFeeRecipientDeploymentsRollingHours,
  getMostRecentGlobalNameDeploymentInRollingHours,
  getMostRecentGlobalTickerDeploymentInRollingHours,
  getMostRecentThirdPartyFeeRecipientDeploymentInRollingHours,
  hasGlobalNameDeploymentInRollingHours,
  hasGlobalTickerDeploymentInRollingHours,
  normalizeCatalogTickerSymbol,
  normalizeCatalogTokenName,
} from './deploymentCatalog.js';

export function globalTickerCooldownHours(): number {
  return config.globalTickerCooldownHours;
}

export interface ExistingDeployToken {
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
}

export interface DeployCooldownConflict {
  kind: 'ticker' | 'name';
  cooldownHours: number;
  requestedSymbol?: string;
  requestedName?: string;
  existing: ExistingDeployToken;
}

export async function getGlobalTickerCooldownConflict(
  symbol: string,
): Promise<DeployCooldownConflict | null> {
  const h = globalTickerCooldownHours();
  if (h <= 0) return null;
  if (!(await isTickerGloballyReserved(symbol))) return null;
  const existing = await getMostRecentGlobalTickerDeploymentInRollingHours(symbol, h);
  const s = normalizeCatalogTickerSymbol(symbol);
  if (!existing) {
    return {
      kind: 'ticker',
      cooldownHours: h,
      requestedSymbol: s,
      existing: {
        tokenName: '(unknown)',
        tokenSymbol: s,
        tokenAddress: '0x0000000000000000000000000000000000000000',
      },
    };
  }
  return {
    kind: 'ticker',
    cooldownHours: h,
    requestedSymbol: s,
    existing,
  };
}

export async function getGlobalNameCooldownConflict(
  name: string,
): Promise<DeployCooldownConflict | null> {
  const h = globalTickerCooldownHours();
  if (h <= 0) return null;
  if (!(await isNameGloballyReserved(name))) return null;
  const existing = await getMostRecentGlobalNameDeploymentInRollingHours(name, h);
  const n = normalizeCatalogTokenName(name);
  if (!existing) {
    return {
      kind: 'name',
      cooldownHours: h,
      requestedName: name.trim(),
      existing: {
        tokenName: name.trim(),
        tokenSymbol: '?',
        tokenAddress: '0x0000000000000000000000000000000000000000',
      },
    };
  }
  return {
    kind: 'name',
    cooldownHours: h,
    requestedName: name.trim(),
    existing: {
      tokenName: name.trim(),
      tokenSymbol: existing.tokenSymbol,
      tokenAddress: existing.tokenAddress,
    },
  };
}

export function formatDeployCooldownConflictMessage(conflict: DeployCooldownConflict): string {
  if (conflict.kind === 'ticker') {
    const sym = conflict.requestedSymbol ?? conflict.existing.tokenSymbol;
    return (
      `Ticker $${sym} was already deployed in the last ${conflict.cooldownHours} hours. ` +
      `Existing token: ${conflict.existing.tokenName} (${conflict.existing.tokenAddress}).`
    );
  }
  return (
    `Token name "${conflict.requestedName ?? conflict.existing.tokenName}" was already deployed in the last ${conflict.cooldownHours} hours. ` +
    `Existing token: $${conflict.existing.tokenSymbol} (${conflict.existing.tokenAddress}).`
  );
}

/** True if this ticker was used in a catalog deploy within the configured rolling window (global). */
export async function isTickerGloballyReserved(symbol: string): Promise<boolean> {
  const h = globalTickerCooldownHours();
  if (h <= 0) return false;
  return hasGlobalTickerDeploymentInRollingHours(symbol, h);
}

/** True if this token name was used in a catalog deploy within the configured rolling window (global). */
export async function isNameGloballyReserved(name: string): Promise<boolean> {
  const h = globalTickerCooldownHours();
  if (h <= 0) return false;
  return hasGlobalNameDeploymentInRollingHours(name, h);
}

/**
 * User-facing cooldown message, including the existing token contract from the catalog when available.
 */
export async function formatGlobalTickerCooldownMessage(symbol: string): Promise<string> {
  const conflict = await getGlobalTickerCooldownConflict(symbol);
  if (conflict) return formatDeployCooldownConflictMessage(conflict);
  const s = normalizeCatalogTickerSymbol(symbol);
  const h = globalTickerCooldownHours();
  return `Ticker $${s} was already deployed in the last ${h} hours. Choose another symbol or wait.`;
}

export async function formatGlobalNameCooldownMessage(name: string): Promise<string> {
  const conflict = await getGlobalNameCooldownConflict(name);
  if (conflict) return formatDeployCooldownConflictMessage(conflict);
  const h = globalTickerCooldownHours();
  return `Token name "${name.trim()}" was already deployed in the last ${h} hours. Choose another name or wait.`;
}

/**
 * Third-party fee wallet cooldown (same window as `GLOBAL_TICKER_COOLDOWN_HOURS`): at most one catalog
 * deploy with `fee_to_self = 0` to this address in the rolling window (any platform / ticker).
 */
export async function formatThirdPartyFeeRecipientCooldownMessage(
  feeRecipientAddress: string,
  feeRecipientLabel?: string,
): Promise<string> {
  const h = globalTickerCooldownHours();
  let addr: string;
  try {
    addr = getAddress(feeRecipientAddress);
  } catch {
    return 'Invalid fee wallet for cooldown check.';
  }
  const label = (feeRecipientLabel ?? '').trim();
  const who = label ? `${label} (${addr})` : addr;
  let msg = `This fee recipient already had a token deployed in the last ${h} hours: ${who}. Use a different wallet/account or wait.`;
  if (h <= 0) return msg;
  const existing = await getMostRecentThirdPartyFeeRecipientDeploymentInRollingHours(addr, h);
  if (existing) {
    msg += `\n\nRecent token for this recipient: ${existing.tokenAddress}\nSymbol: $${existing.tokenSymbol}\nName: ${existing.tokenName}`;
  }
  return msg;
}

/** When cooldown applies, returns an error string; otherwise `null`. */
export async function thirdPartyFeeRecipientCooldownErrorOrNull(
  feeRecipientAddress: string,
  opts: { feeToSelf: boolean; rateLimitForcedBurn: boolean; feeRecipientLabel?: string },
): Promise<string | null> {
  const h = globalTickerCooldownHours();
  if (h <= 0) return null;
  if (opts.feeToSelf || opts.rateLimitForcedBurn) return null;
  let addr: string;
  try {
    addr = getAddress(feeRecipientAddress);
  } catch {
    return null;
  }
  if (addr.toLowerCase() === BASE_DEAD_FEE_RECIPIENT.toLowerCase()) return null;
  const n = await countThirdPartyFeeRecipientDeploymentsRollingHours(addr, h);
  if (n <= 0) return null;
  return formatThirdPartyFeeRecipientCooldownMessage(addr, opts.feeRecipientLabel);
}
