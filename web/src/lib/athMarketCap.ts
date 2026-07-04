import { formatUsdVol } from './dexscreenerVolume';

const STORAGE_PREFIX = 'hood-ath-mcap:';

/** Track ATH market cap client-side (DexScreener does not expose ATH on Robinhood pairs). */
export function readAthMarketCapUsd(tokenAddress: string): number | undefined {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + tokenAddress.toLowerCase());
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

export function bumpAthMarketCapUsd(tokenAddress: string, marketCapUsd: number | undefined): number | undefined {
  if (marketCapUsd == null || !Number.isFinite(marketCapUsd) || marketCapUsd <= 0) {
    return readAthMarketCapUsd(tokenAddress);
  }
  const prev = readAthMarketCapUsd(tokenAddress) ?? 0;
  const next = Math.max(prev, marketCapUsd);
  try {
    sessionStorage.setItem(STORAGE_PREFIX + tokenAddress.toLowerCase(), String(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

export function formatAthMarketCapUsd(tokenAddress: string, currentMc?: number): string {
  const ath = bumpAthMarketCapUsd(tokenAddress, currentMc);
  return formatUsdVol(ath);
}
