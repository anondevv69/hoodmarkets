import { DEFAULT_LAUNCH_TICK } from './launchDefaults.js';

/** HoodMarkets V3 pools use tick spacing 200. */
const TICK_SPACING = 200;

const DEFAULT_ETH_USD = Number(process.env.QUOTE_LAUNCH_ETH_USD?.trim() || '2500');

/**
 * Adjust launch tick when the quote asset is not WETH so starting FDV stays in the
 * same ballpark as WETH pairs (~$9–12k at typical ETH prices).
 */
export function launchTickForQuoteUsd(quoteUsd: number, ethUsd = DEFAULT_ETH_USD): number {
  if (!Number.isFinite(quoteUsd) || quoteUsd <= 0 || !Number.isFinite(ethUsd) || ethUsd <= 0) {
    return DEFAULT_LAUNCH_TICK;
  }
  const ratio = ethUsd / quoteUsd;
  const offset = Math.round(Math.log(ratio) / Math.log(1.0001));
  let tick = DEFAULT_LAUNCH_TICK + offset;
  tick = Math.floor(tick / TICK_SPACING) * TICK_SPACING;
  return tick;
}

export function defaultEthUsdForQuoteLaunch(): number {
  return DEFAULT_ETH_USD;
}
