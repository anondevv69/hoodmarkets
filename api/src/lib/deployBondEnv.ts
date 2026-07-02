import { parseEther } from 'viem';
export const DEFAULT_DEPLOY_BOND_ETH = '0.002';

export const WEB_INITIAL_BUY_MIN_ETH = '0.001';
export const WEB_INITIAL_BUY_MAX_ETH = '0.1';
export const WEB_INITIAL_BUY_PRESETS_ETH = ['0.002', '0.01', '0.05'] as const;

function parseEthAmountString(raw: string): number {
  const t = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(t)) {
    throw new Error('Invalid ETH amount');
  }
  const n = Number(t);
  if (!Number.isFinite(n)) throw new Error('Invalid ETH amount');
  return n;
}

function ethEnv(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  return raw && raw.length > 0 ? raw : fallback;
}

/**
 * ETH for launch-time Univ4EthDevBuy (`deployToken` msg.value).
 * - Unset or empty string → default (seeds pool liquidity for early traders).
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

export function webInitialBuyMinEth(): string {
  return ethEnv('WEB_INITIAL_BUY_MIN_ETH', WEB_INITIAL_BUY_MIN_ETH);
}

export function webInitialBuyMaxEth(): string {
  return ethEnv('WEB_INITIAL_BUY_MAX_ETH', WEB_INITIAL_BUY_MAX_ETH);
}

export function webInitialBuyDefaultEth(): string {
  const fromEnv = process.env.DEPLOY_BOND_ETH?.trim();
  if (fromEnv && fromEnv !== '0') return fromEnv;
  return DEFAULT_DEPLOY_BOND_ETH;
}

/** Parse optional `initialBuyEth` from web deploy body; clamp to configured min/max. */
export function parseWebInitialBuyWei(raw: unknown, fallbackWei: bigint): bigint {
  if (raw === undefined || raw === null || raw === '') {
    return fallbackWei;
  }

  const eth =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? parseEthAmountString(raw)
        : NaN;

  if (!Number.isFinite(eth) || eth < 0) {
    throw new Error('initialBuyEth must be a non-negative number');
  }

  if (eth === 0) return 0n;

  const min = parseEthAmountString(webInitialBuyMinEth());
  const max = parseEthAmountString(webInitialBuyMaxEth());
  if (eth < min || eth > max) {
    throw new Error(
      `Initial buy must be between ${min} and ${max} ETH (or 0 to skip).`,
    );
  }

  return parseEther(String(eth));
}
