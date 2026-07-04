/** Robinhood chain swap feed (NOXA-compatible shape). Hood.markets tokens appear once indexed. */

const DEFAULT_TRADES_API =
  'https://awk00kk00gskkw0o8kc488kg.notoriouslywrong.com/v1/robinhood/trades/latest';

export type RobinhoodSwap = {
  id: string;
  token: string;
  tokenSymbol?: string;
  tokenName?: string;
  pool?: string;
  timestamp: string;
  txHash: string;
  sender: string;
  recipient?: string;
  tokenAmount: string;
  ethAmount: number;
  priceEth?: number;
  side: 'BUY' | 'SELL' | string;
  blockNumber?: number;
};

function tradesApiBase(): string {
  const fromEnv = (import.meta.env.VITE_ROBINHOOD_TRADES_API_URL as string | undefined)?.trim();
  return (fromEnv || DEFAULT_TRADES_API).replace(/\/$/, '');
}

export async function fetchLatestRobinhoodSwaps(limit = 100): Promise<RobinhoodSwap[]> {
  const url = `${tradesApiBase()}?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Trades API ${res.status}`);
  const data = (await res.json()) as { swaps?: RobinhoodSwap[] };
  return data.swaps ?? [];
}

export function filterSwapsForToken(swaps: RobinhoodSwap[], tokenAddress: string): RobinhoodSwap[] {
  const key = tokenAddress.trim().toLowerCase();
  return swaps.filter((s) => s.token?.toLowerCase() === key);
}

/** Rough ETH/USD for trade notional — WETH on Robinhood via DexScreener. */
let ethUsdCache: { value: number; at: number } | undefined;
const ETH_USD_TTL_MS = 60_000;
const ROBINHOOD_WETH = '0x0bd7d308f8e1639fab988df18a8011f41eacad73';

export async function fetchEthUsdPrice(): Promise<number | undefined> {
  if (ethUsdCache && Date.now() - ethUsdCache.at < ETH_USD_TTL_MS) {
    return ethUsdCache.value;
  }
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ROBINHOOD_WETH}`);
    if (!res.ok) return ethUsdCache?.value;
    const data = (await res.json()) as { pairs?: { priceUsd?: string }[] };
    const p = Number(data.pairs?.[0]?.priceUsd);
    if (!Number.isFinite(p) || p <= 0) return ethUsdCache?.value;
    ethUsdCache = { value: p, at: Date.now() };
    return p;
  } catch {
    return ethUsdCache?.value;
  }
}

export function formatRelativeTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '—';
  const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function formatTokenAmount(raw: string, decimals = 18): string {
  try {
    const n = Number(raw) / 10 ** decimals;
    if (!Number.isFinite(n) || n <= 0) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    if (n >= 1) return n.toFixed(2);
    return n.toPrecision(3);
  } catch {
    return '—';
  }
}
