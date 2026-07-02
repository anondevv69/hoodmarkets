import type { Deployment } from '../api';
import type { DexTokenMetrics } from './dexscreenerVolume';

/** Normalized shape for ticker + filter chips (shared categorization). */
export interface ExploreToken {
  address: string;
  symbol: string;
  name: string;
  createdAt: string;
  volume24h: number;
  change24h?: number;
  mcap?: number;
  liquidityUsd?: number;
  deployment: Deployment;
}

export const NEW_WINDOW_MS = 1000 * 60 * 60 * 24;
export const HOT_COUNT = 15;
export const TRENDING_COUNT = 15;
export const TICKER_SLICE = 5;

export function toExploreTokens(
  deployments: Deployment[],
  metricsByAddress: Record<string, DexTokenMetrics | undefined>,
): ExploreToken[] {
  return deployments.map((d) => {
    const m = metricsByAddress[d.tokenAddress];
    return {
      address: d.tokenAddress,
      symbol: d.tokenSymbol.replace(/^\$/, ''),
      name: d.tokenName,
      createdAt: d.createdAt,
      volume24h: m?.volumeH24Usd ?? 0,
      change24h: m?.change24hPct,
      mcap: m?.fdvUsd,
      liquidityUsd: m?.liquidityUsd,
      deployment: d,
    };
  });
}

export interface TokenCategorySets {
  hotSet: Set<string>;
  trendingSet: Set<string>;
  newSet: Set<string>;
}

export function categorizeTokenSets(tokens: ExploreToken[]): TokenCategorySets {
  const now = Date.now();

  const hotSet = new Set(
    [...tokens]
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, HOT_COUNT)
      .map((t) => t.address),
  );

  const trendingSet = new Set(
    [...tokens]
      .sort((a, b) => (b.change24h ?? -Infinity) - (a.change24h ?? -Infinity))
      .filter((t) => typeof t.change24h === 'number')
      .slice(0, TRENDING_COUNT)
      .map((t) => t.address),
  );

  const newSet = new Set(
    tokens
      .filter((t) => t.createdAt && now - new Date(t.createdAt).getTime() < NEW_WINDOW_MS)
      .map((t) => t.address),
  );

  return { hotSet, trendingSet, newSet };
}

export type TickerCategory = 'hot' | 'trending' | 'new';

/** Interleaved hot / trending / new items for the scrolling ticker. */
export function buildTickerItems(tokens: ExploreToken[]): Array<ExploreToken & { category: TickerCategory }> {
  const sorted = [...tokens];

  const hot = [...sorted]
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice(0, TICKER_SLICE)
    .map((t) => ({ ...t, category: 'hot' as const }));

  const trending = [...sorted]
    .sort((a, b) => (b.change24h ?? -Infinity) - (a.change24h ?? -Infinity))
    .filter((t) => typeof t.change24h === 'number')
    .slice(0, TICKER_SLICE)
    .map((t) => ({ ...t, category: 'trending' as const }));

  const fresh = [...sorted]
    .filter((t) => t.createdAt && Date.now() - new Date(t.createdAt).getTime() < NEW_WINDOW_MS)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, TICKER_SLICE)
    .map((t) => ({ ...t, category: 'new' as const }));

  const merged: Array<ExploreToken & { category: TickerCategory }> = [];
  const max = Math.max(hot.length, trending.length, fresh.length);
  for (let i = 0; i < max; i++) {
    if (hot[i]) merged.push(hot[i]);
    if (trending[i]) merged.push(trending[i]);
    if (fresh[i]) merged.push(fresh[i]);
  }
  return merged;
}
