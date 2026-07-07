/** DexScreener metrics for Robinhood Chain (4663). */

import { ROBINHOOD_CHAIN_ID } from '../chain';

const CHUNK = 30;
const CHAIN_KEY = String(ROBINHOOD_CHAIN_ID);

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function formatUsdVol(n: number | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

interface DexPair {
  chainId?: string;
  url?: string;
  pairAddress?: string;
  dexId?: string;
  labels?: string[];
  pairCreatedAt?: number;
  baseToken?: { address?: string };
  quoteToken?: { address?: string };
  volume?: { h24?: number; h6?: number; h1?: number; m5?: number };
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
  fdv?: number;
  marketCap?: number;
  liquidity?: { usd?: number };
  txns?: {
    h24?: { buys?: number; sells?: number };
    h6?: { buys?: number; sells?: number };
    h1?: { buys?: number; sells?: number };
    m5?: { buys?: number; sells?: number };
  };
  priceUsd?: string;
  info?: {
    imageUrl?: string | null;
    header?: string | null;
  };
}

interface DexOrder {
  type?: string;
  status?: string;
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
  volumeH6Usd?: number;
  volumeH1Usd?: number;
  volumeM5Usd?: number;
  change24hPct?: number;
  changeH6Pct?: number;
  changeH1Pct?: number;
  changeM5Pct?: number;
  marketCapUsd?: number;
  fdvUsd?: number;
  liquidityUsd?: number;
  txnsH24?: number;
  buysH24?: number;
  sellsH24?: number;
  buyersH24?: number;
  sellersH24?: number;
  priceUsd?: number;
  pairAddress?: string;
  pairCreatedAt?: number;
  dexId?: string;
  dexVersion?: string;
  /** DexScreener pair page URL when indexed (often pair address, not token). */
  dexscreenerUrl?: string;
  /** DexScreener Enhanced Token Info paid (tokenProfile order approved/processing). */
  enhancedInfoPaid?: boolean;
  enhancedInfoStatus?: string | null;
  /** DexScreener CDN icon when enhanced info is live. */
  dexIconUrl?: string | null;
  /** DexScreener CDN header/banner when enhanced info is live. */
  dexBannerUrl?: string | null;
}

function assignPct(target: DexTokenMetrics, key: keyof DexTokenMetrics, v: unknown) {
  if (typeof v === 'number' && Number.isFinite(v)) (target as Record<string, number>)[key] = v;
}

function assignUsd(target: DexTokenMetrics, key: keyof DexTokenMetrics, v: unknown) {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) (target as Record<string, number>)[key] = v;
}

function pairToMetrics(best: DexPair): DexTokenMetrics {
  const buys = best.txns?.h24?.buys ?? 0;
  const sells = best.txns?.h24?.sells ?? 0;
  const txns = buys + sells;
  const metrics: DexTokenMetrics = {};

  assignUsd(metrics, 'volumeH24Usd', best.volume?.h24);
  assignUsd(metrics, 'volumeH6Usd', best.volume?.h6);
  assignUsd(metrics, 'volumeH1Usd', best.volume?.h1);
  assignUsd(metrics, 'volumeM5Usd', best.volume?.m5);
  assignPct(metrics, 'change24hPct', best.priceChange?.h24);
  assignPct(metrics, 'changeH6Pct', best.priceChange?.h6);
  assignPct(metrics, 'changeH1Pct', best.priceChange?.h1);
  assignPct(metrics, 'changeM5Pct', best.priceChange?.m5);
  assignUsd(metrics, 'marketCapUsd', best.marketCap);
  assignUsd(metrics, 'fdvUsd', best.fdv);
  assignUsd(metrics, 'liquidityUsd', best.liquidity?.usd);
  if (txns > 0) metrics.txnsH24 = txns;
  if (buys > 0) metrics.buysH24 = buys;
  if (sells > 0) metrics.sellsH24 = sells;
  const priceRaw = best.priceUsd;
  if (priceRaw != null) {
    const p = Number(priceRaw);
    if (Number.isFinite(p) && p > 0) metrics.priceUsd = p;
  }
  if (typeof best.pairAddress === 'string' && best.pairAddress.length > 0) {
    metrics.pairAddress = best.pairAddress;
  }
  if (typeof best.pairCreatedAt === 'number' && Number.isFinite(best.pairCreatedAt)) {
    metrics.pairCreatedAt = best.pairCreatedAt;
  }
  if (typeof best.dexId === 'string' && best.dexId.length > 0) metrics.dexId = best.dexId;
  if (best.labels?.[0]) metrics.dexVersion = best.labels[0];
  if (typeof best.url === 'string' && best.url.length > 0) metrics.dexscreenerUrl = best.url;
  if (best.info?.imageUrl) metrics.dexIconUrl = best.info.imageUrl;
  if (best.info?.header) metrics.dexBannerUrl = best.info.header;
  return metrics;
}

async function fetchDexEnhancedInfo(
  tokenAddress: string,
): Promise<{ enhancedInfoPaid: boolean; enhancedInfoStatus: string | null }> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/orders/v1/${CHAIN_KEY}/${tokenAddress.trim().toLowerCase()}`,
    );
    if (!res.ok) return { enhancedInfoPaid: false, enhancedInfoStatus: null };
    const data = (await res.json()) as { orders?: DexOrder[] };
    const tokenProfile = (data.orders ?? []).find((o) => o.type === 'tokenProfile');
    const status = tokenProfile?.status ?? null;
    return {
      enhancedInfoPaid: status === 'approved' || status === 'processing',
      enhancedInfoStatus: status,
    };
  } catch {
    return { enhancedInfoPaid: false, enhancedInfoStatus: null };
  }
}

export function formatDexName(dexId?: string, dexVersion?: string): string {
  const dex = dexId ? dexId.charAt(0).toUpperCase() + dexId.slice(1) : '';
  const ver = dexVersion?.toUpperCase();
  if (dex && ver) return `${dex} ${ver}`;
  return dex || ver || '—';
}

export function formatPairAge(createdAtMs: number | undefined): string {
  if (createdAtMs == null || !Number.isFinite(createdAtMs)) return '—';
  const ageMs = Date.now() - createdAtMs;
  if (ageMs < 0) return '—';
  const mins = Math.floor(ageMs / 60_000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

export function hasDexMarketData(metrics?: DexTokenMetrics): boolean {
  if (!metrics) return false;
  return (
    !!metrics.dexscreenerUrl ||
    (metrics.liquidityUsd != null && metrics.liquidityUsd > 0) ||
    (metrics.volumeH24Usd != null && metrics.volumeH24Usd > 0) ||
    (metrics.marketCapUsd != null && metrics.marketCapUsd > 0) ||
    (metrics.priceUsd != null && metrics.priceUsd > 0)
  );
}

export async function fetchTokenMetricsFromDexscreener(
  addresses: string[],
): Promise<Record<string, DexTokenMetrics | undefined>> {
  const uniq = [...new Set(addresses.map((a) => a.trim()).filter(Boolean))];
  const out: Record<string, DexTokenMetrics | undefined> = {};
  for (const a of uniq) out[a.toLowerCase()] = undefined;

  const applyPairs = (pairs: DexPair[]) => {
    for (const addr of uniq) {
      const key = addr.toLowerCase();
      if (out[key]) continue;
      const best = pickBestPairForToken(pairs, key);
      if (!best) continue;
      const metrics = pairToMetrics(best);
      if (Object.keys(metrics).length > 0) out[key] = metrics;
    }
  };

  for (const group of chunk(uniq, CHUNK)) {
    let pairs: DexPair[] = [];
    try {
      const res = await fetch(
        `https://api.dexscreener.com/tokens/v1/${CHAIN_KEY}/${group.join(',')}`,
      );
      if (res.ok) {
        const data = (await res.json()) as DexPair[] | { pairs?: DexPair[] };
        pairs = Array.isArray(data) ? data : (data.pairs ?? []);
      }
    } catch {
      pairs = [];
    }
    applyPairs(pairs);
  }

  // v1 often returns [] on Robinhood; latest/dex/tokens picks up v2/v3 pairs (e.g. Lootback).
  const missing = uniq.filter((a) => !out[a.toLowerCase()]);
  for (const addr of missing) {
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${addr.trim()}`,
      );
      if (!res.ok) continue;
      const data = (await res.json()) as { pairs?: DexPair[] };
      applyPairs(data.pairs ?? []);
    } catch {
      continue;
    }
  }

  await Promise.all(
    uniq.map(async (addr) => {
      const key = addr.toLowerCase();
      const enhanced = await fetchDexEnhancedInfo(addr);
      out[key] = { ...(out[key] ?? {}), ...enhanced };
    }),
  );

  const normalized: Record<string, DexTokenMetrics | undefined> = {};
  for (const a of uniq) normalized[a] = out[a.toLowerCase()];
  return normalized;
}

export function formatTxns(n: number | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function formatTinyUsdPrice(n: number | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(2)}`;
}
