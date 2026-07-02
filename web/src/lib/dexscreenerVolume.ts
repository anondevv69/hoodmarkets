/** DexScreener metrics for Robinhood Chain (4663). */

import { ROBINHOOD_CHAIN_ID } from '../chain';

const CHUNK = 30;
const CHAIN_KEY = String(ROBINHOOD_CHAIN_ID);

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function formatUsdVol(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

interface DexPair {
  chainId?: string;
  baseToken?: { address?: string };
  quoteToken?: { address?: string };
  volume?: { h24?: number };
  fdv?: number;
  marketCap?: number;
  liquidity?: { usd?: number };
}

function isRobinhoodPair(p: DexPair): boolean {
  const id = String(p.chainId ?? '').toLowerCase();
  return !id || id === CHAIN_KEY || id === 'robinhood';
}

function liquidityUsd(p: DexPair): number {
  const u = p.liquidity?.usd;
  return typeof u === 'number' && Number.isFinite(u) ? u : 0;
}

function pickBestPairForToken(pairs: DexPair[], tokenKey: string): DexPair | null {
  const relevant = pairs.filter((p) => {
    if (!isRobinhoodPair(p)) return false;
    const b = p.baseToken?.address?.toLowerCase();
    const q = p.quoteToken?.address?.toLowerCase();
    return b === tokenKey || q === tokenKey;
  });
  if (relevant.length === 0) return null;
  relevant.sort((a, b) => {
    const lb = liquidityUsd(b) - liquidityUsd(a);
    if (lb !== 0) return lb;
    const fd = (b.fdv ?? 0) - (a.fdv ?? 0);
    if (fd !== 0) return fd;
    return (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0);
  });
  return relevant[0] ?? null;
}

export interface DexTokenMetrics {
  volumeH24Usd?: number;
  fdvUsd?: number;
  liquidityUsd?: number;
}

export async function fetchTokenMetricsFromDexscreener(
  addresses: string[],
): Promise<Record<string, DexTokenMetrics | undefined>> {
  const uniq = [...new Set(addresses.map((a) => a.trim()).filter(Boolean))];
  const out: Record<string, DexTokenMetrics | undefined> = {};
  for (const a of uniq) out[a.toLowerCase()] = undefined;

  for (const group of chunk(uniq, CHUNK)) {
    const url = `https://api.dexscreener.com/tokens/v1/${CHAIN_KEY}/${group.join(',')}`;
    let pairs: DexPair[] = [];
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = (await res.json()) as DexPair[] | { pairs?: DexPair[] };
      pairs = Array.isArray(data) ? data : (data.pairs ?? []);
    } catch {
      continue;
    }

    for (const addr of group) {
      const key = addr.toLowerCase();
      const best = pickBestPairForToken(pairs, key);
      if (!best) continue;
      const vol = best.volume?.h24;
      const fdv = best.fdv;
      const mc = best.marketCap;
      const liq = best.liquidity?.usd;
      const metrics: DexTokenMetrics = {};
      if (typeof vol === 'number' && Number.isFinite(vol) && vol > 0) metrics.volumeH24Usd = vol;
      if (typeof fdv === 'number' && Number.isFinite(fdv) && fdv > 0) metrics.fdvUsd = fdv;
      else if (typeof mc === 'number' && Number.isFinite(mc) && mc > 0) metrics.fdvUsd = mc;
      if (typeof liq === 'number' && Number.isFinite(liq) && liq > 0) metrics.liquidityUsd = liq;
      if (Object.keys(metrics).length > 0) out[key] = metrics;
    }
  }

  const normalized: Record<string, DexTokenMetrics | undefined> = {};
  for (const a of uniq) normalized[a] = out[a.toLowerCase()];
  return normalized;
}
