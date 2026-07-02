/**
 * Trading / discovery links for Robinhood Chain tokens (hoodmarkets).
 */

import { getAddress } from 'viem';

export interface TradingLinks {
  hoodmarkets: string;
  /** @deprecated use hoodmarkets */
  liquid: string;
  dexscreener: string;
  uniswap: string;
  uniswapSwap: string;
  explorer: string;
}

function tokenLowerHex(address: string): string {
  const t = address.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(t)) return t.toLowerCase();
  return t;
}

function hoodmarketsUrl(tokenAddress: string): string {
  const addr = tokenLowerHex(tokenAddress);
  return `https://hood.markets/?token=${addr}`;
}

export function buildTradingLinks(tokenAddress: string): TradingLinks {
  const addr = getAddress(tokenAddress.trim() as `0x${string}`);
  const a = tokenLowerHex(addr);
  const hoodmarkets = hoodmarketsUrl(addr);
  return {
    hoodmarkets,
    liquid: hoodmarkets,
    dexscreener: `https://dexscreener.com/robinhood/${a}`,
    uniswap: `https://app.uniswap.org/explore/tokens/robinhood/${addr}`,
    uniswapSwap: `https://app.uniswap.org/swap?chain=robinhood&outputCurrency=${addr}`,
    explorer: `https://robinhoodchain.blockscout.com/token/${addr}`,
  };
}

/** Prefer server `links` from deploy JSON when present. */
export function tradingLinksFromApi(
  tokenAddress: string,
  apiLinks: unknown,
): TradingLinks {
  const defaults = buildTradingLinks(tokenAddress);
  const rec = apiLinks && typeof apiLinks === 'object' ? (apiLinks as Record<string, unknown>) : null;
  const pick = (key: string, fallback: string) => {
    const v = rec?.[key];
    return typeof v === 'string' && v.length > 0 ? v : fallback;
  };
  const hoodmarkets = pick('hoodmarkets', pick('liquid', defaults.hoodmarkets));
  return {
    hoodmarkets,
    liquid: hoodmarkets,
    dexscreener: pick('dexscreener', defaults.dexscreener),
    uniswap: pick('uniswap', defaults.uniswap),
    uniswapSwap: pick('uniswapSwap', defaults.uniswapSwap),
    explorer: pick('explorer', defaults.explorer),
  };
}
