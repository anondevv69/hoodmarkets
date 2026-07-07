import { API_BASE } from '../api';

/**
 * Robinhood Chain trades via GeckoTerminal (same approach as hoodpad.fun for pool swaps).
 * Free public API — rate-limited; we cache pool lookups and poll modestly.
 * @see https://www.geckoterminal.com/dex-api
 */

const GECKO_API = 'https://api.geckoterminal.com/api/v2';
const GECKO_NETWORK = 'robinhood';
const POOL_CACHE_TTL_MS = 5 * 60_000;
const MAX_TRADES = 30;

export type TokenTradeRow = {
  id: string;
  txHash: string;
  wallet: string;
  isBuy: boolean;
  ethAmount: number;
  tokenAmount: number;
  timestamp: string;
  usdVolume?: number;
};

type GeckoPool = {
  attributes?: {
    address?: string;
    reserve_in_usd?: string;
  };
};

type GeckoTrade = {
  id: string;
  attributes?: {
    kind?: string;
    tx_hash?: string;
    tx_from_address?: string;
    block_timestamp?: string;
    from_token_amount?: string;
    to_token_amount?: string;
    volume_in_usd?: string;
  };
};

const poolByToken = new Map<string, { pool: string; at: number }>();

async function geckoGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${GECKO_API}${path}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.status === 429 || res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function resolveTopPoolAddress(tokenAddress: string): Promise<string | null> {
  const key = tokenAddress.trim().toLowerCase();
  const cached = poolByToken.get(key);
  if (cached && Date.now() - cached.at < POOL_CACHE_TTL_MS) {
    return cached.pool;
  }

  const data = await geckoGet<{ data?: GeckoPool[] }>(
    `/networks/${GECKO_NETWORK}/tokens/${key}/pools`,
  );
  const pools = [...(data?.data ?? [])].sort((a, b) => {
    const av = Number(a.attributes?.reserve_in_usd ?? 0);
    const bv = Number(b.attributes?.reserve_in_usd ?? 0);
    return bv - av;
  });
  const pool = pools[0]?.attributes?.address?.trim().toLowerCase();
  if (!pool) return null;
  poolByToken.set(key, { pool, at: Date.now() });
  return pool;
}

function mapGeckoTrade(raw: GeckoTrade): TokenTradeRow | null {
  const a = raw.attributes;
  if (!a?.tx_hash || !a.tx_from_address || !a.block_timestamp) return null;

  const kind = String(a.kind ?? '').toLowerCase();
  const isBuy = kind === 'buy';
  const fromAmt = Number.parseFloat(a.from_token_amount ?? '');
  const toAmt = Number.parseFloat(a.to_token_amount ?? '');
  const usd = Number.parseFloat(a.volume_in_usd ?? '');

  const ethAmount = isBuy ? (Number.isFinite(fromAmt) ? fromAmt : 0) : Number.isFinite(toAmt) ? toAmt : 0;
  const tokenAmount = isBuy ? (Number.isFinite(toAmt) ? toAmt : 0) : Number.isFinite(fromAmt) ? fromAmt : 0;

  if (ethAmount <= 0 && tokenAmount <= 0) return null;

  return {
    id: raw.id || a.tx_hash,
    txHash: a.tx_hash,
    wallet: a.tx_from_address,
    isBuy,
    ethAmount,
    tokenAmount,
    timestamp: a.block_timestamp,
    usdVolume: Number.isFinite(usd) && usd > 0 ? usd : undefined,
  };
}

/** Recent swaps for a token (top pool by liquidity), HoodPad-style. */
export async function fetchGeckoTokenTrades(tokenAddress: string): Promise<TokenTradeRow[]> {
  const key = tokenAddress.trim();

  try {
    const res = await fetch(`${API_BASE}/api/tokens/${encodeURIComponent(key)}/trades`);
    if (res.ok) {
      const data = (await res.json()) as { trades?: TokenTradeRow[] };
      if (Array.isArray(data.trades)) {
        return data.trades.slice(0, MAX_TRADES);
      }
    }
  } catch {
    /* fall through to direct Gecko */
  }

  const pool = await resolveTopPoolAddress(key);
  if (!pool) return [];

  const data = await geckoGet<{ data?: GeckoTrade[] }>(
    `/networks/${GECKO_NETWORK}/pools/${pool}/trades`,
  );
  return (data?.data ?? [])
    .map(mapGeckoTrade)
    .filter((t): t is TokenTradeRow => t != null)
    .slice(0, MAX_TRADES);
}
