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

export function isNewLaunch(createdAt: string): boolean {
  const ms = Date.now() - new Date(createdAt).getTime();
  return Number.isFinite(ms) && ms >= 0 && ms < NEW_WINDOW_MS;
}

/** Tokens for the header ticker — one row per token, newest and movers first. */
export function buildTickerItems(tokens: ExploreToken[]): ExploreToken[] {
  return [...tokens]
    .sort((a, b) => {
      const aNew = isNewLaunch(a.createdAt);
      const bNew = isNewLaunch(b.createdAt);
      if (aNew !== bNew) return aNew ? -1 : 1;
      const chg = (b.change24h ?? -Infinity) - (a.change24h ?? -Infinity);
      if (chg !== 0) return chg;
      return (b.mcap ?? 0) - (a.mcap ?? 0);
    })
    .slice(0, 24);
}
