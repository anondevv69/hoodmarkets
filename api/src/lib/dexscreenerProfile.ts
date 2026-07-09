import { ROBINHOOD_CHAIN_ID } from './robinhoodChain.js';
import { DEXSCREENER_CHAIN_SLUG } from './dexscreenerChain.js';

const DEXSCREENER_BASE = 'https://api.dexscreener.com';

type DexPair = {
  url?: string;
  liquidity?: { usd?: number | null };
  info?: {
    imageUrl?: string | null;
    header?: string | null;
  };
};

type DexOrder = {
  type?: string;
  status?: string;
};

export type DexBrandingProfile = {
  chainId: number;
  tokenAddress: string;
  found: boolean;
  enhancedInfoPaid: boolean;
  enhancedInfoStatus: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  dexUrl: string | null;
};

function pickPrimaryPair(pairs: DexPair[]): DexPair | null {
  if (!pairs.length) return null;
  return [...pairs].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0] ?? null;
}

function isHttpsDexAsset(url: string | null | undefined): url is string {
  if (!url) return false;
  const t = url.trim();
  if (!t.startsWith('https://')) return false;
  try {
    const host = new URL(t).hostname.toLowerCase();
    return host.endsWith('dexscreener.com') || host.endsWith('dd.dexscreener.com');
  } catch {
    return false;
  }
}

export async function fetchDexBrandingProfile(tokenAddress: string): Promise<DexBrandingProfile> {
  const address = tokenAddress.trim().toLowerCase();
  const empty: DexBrandingProfile = {
    chainId: ROBINHOOD_CHAIN_ID,
    tokenAddress: address,
    found: false,
    enhancedInfoPaid: false,
    enhancedInfoStatus: null,
    iconUrl: null,
    bannerUrl: null,
    dexUrl: null,
  };

  const [pairsRes, ordersRes] = await Promise.all([
    fetch(`${DEXSCREENER_BASE}/token-pairs/v1/${DEXSCREENER_CHAIN_SLUG}/${address}`, {
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null),
    fetch(`${DEXSCREENER_BASE}/orders/v1/${DEXSCREENER_CHAIN_SLUG}/${address}`, {
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null),
  ]);

  let pairs: DexPair[] = [];
  if (pairsRes?.ok) {
    const data = (await pairsRes.json()) as DexPair[] | { pairs?: DexPair[] };
    pairs = Array.isArray(data) ? data : (data.pairs ?? []);
  }

  let enhancedInfoPaid = false;
  let enhancedInfoStatus: string | null = null;
  if (ordersRes?.ok) {
    const ordersData = (await ordersRes.json()) as { orders?: DexOrder[] };
    const tokenProfile = (ordersData.orders ?? []).find((o) => o.type === 'tokenProfile');
    enhancedInfoStatus = tokenProfile?.status ?? null;
    enhancedInfoPaid =
      tokenProfile?.status === 'approved' || tokenProfile?.status === 'processing';
  }

  const primary = pickPrimaryPair(pairs);
  if (!primary && !enhancedInfoPaid) return empty;

  const iconUrl = isHttpsDexAsset(primary?.info?.imageUrl) ? primary!.info!.imageUrl!.trim() : null;
  const bannerUrl = isHttpsDexAsset(primary?.info?.header) ? primary!.info!.header!.trim() : null;

  return {
    chainId: ROBINHOOD_CHAIN_ID,
    tokenAddress: address,
    found: !!primary,
    enhancedInfoPaid,
    enhancedInfoStatus,
    iconUrl,
    bannerUrl,
    dexUrl: primary?.url ?? null,
  };
}
