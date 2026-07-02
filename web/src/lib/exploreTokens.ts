import type { Deployment } from '../api';
import type { DexTokenMetrics } from './dexscreenerVolume';

/** Normalized shape for ticker + explore list. */
export interface ExploreToken {
  address: string;
  symbol: string;
  name: string;
  createdAt: string;
  volume24h: number;
  change24h?: number;
  mcap?: number;
  liquidityUsd?: number;
  txns24h?: number;
  deployment: Deployment;
}

export const NEW_WINDOW_MS = 1000 * 60 * 60 * 24;
export const TICKER_SLICE = 8;

export function formatTickerAge(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

/** Enough unique slots before the scroll loop repeats. */
export function expandTickerSequence<T>(items: T[], minCount = 14): T[] {
  if (items.length === 0) return [];
  if (items.length >= minCount) return items;
  const out: T[] = [];
  while (out.length < minCount) out.push(...items);
  return out;
}

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
      mcap: m?.marketCapUsd ?? m?.fdvUsd,
      txns24h: m?.txnsH24,
      liquidityUsd: m?.liquidityUsd,
      deployment: d,
    };
  });
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

  const seen = new Set<string>();
  return merged.filter((t) => {
    const key = t.address.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
