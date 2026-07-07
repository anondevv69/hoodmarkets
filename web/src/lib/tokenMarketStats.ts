import type { DexTokenMetrics } from './dexscreenerVolume';
import type { TokenMarketStats } from '../api';

export function cachedStatsToDexMetrics(cached: TokenMarketStats): DexTokenMetrics {
  return {
    volumeH24Usd: cached.volume24hUsd > 0 ? cached.volume24hUsd : undefined,
    marketCapUsd: cached.mcapUsd > 0 ? cached.mcapUsd : undefined,
    fdvUsd: cached.mcapUsd > 0 ? cached.mcapUsd : undefined,
    liquidityUsd: cached.liquidityUsd > 0 ? cached.liquidityUsd : undefined,
    change24hPct: cached.change24hPct ?? undefined,
    priceUsd: cached.priceUsd ?? undefined,
    txnsH24: cached.txnsH24 > 0 ? cached.txnsH24 : undefined,
    dexscreenerUrl: cached.dexscreenerUrl ?? undefined,
  };
}

export function mergeTokenMetrics(
  dex?: DexTokenMetrics,
  cached?: TokenMarketStats | null,
): DexTokenMetrics | undefined {
  if (!dex && !cached) return undefined;
  const fromCache = cached ? cachedStatsToDexMetrics(cached) : {};
  return {
    ...fromCache,
    ...dex,
    marketCapUsd: dex?.marketCapUsd ?? fromCache.marketCapUsd,
    fdvUsd: dex?.fdvUsd ?? fromCache.fdvUsd,
    volumeH24Usd: dex?.volumeH24Usd ?? fromCache.volumeH24Usd,
    liquidityUsd: dex?.liquidityUsd ?? fromCache.liquidityUsd,
    change24hPct: dex?.change24hPct ?? fromCache.change24hPct,
    priceUsd: dex?.priceUsd ?? fromCache.priceUsd,
    txnsH24: dex?.txnsH24 ?? fromCache.txnsH24,
    dexscreenerUrl: dex?.dexscreenerUrl ?? fromCache.dexscreenerUrl,
    enhancedInfoPaid: dex?.enhancedInfoPaid,
    enhancedInfoStatus: dex?.enhancedInfoStatus,
  };
}
