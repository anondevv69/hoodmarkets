import type { DexTokenMetrics } from '../lib/dexscreenerVolume';
import { hasDexMarketData } from '../lib/dexscreenerVolume';

/** Full DexScreener embed — only loaded on token detail pages. */
export function dexScreenerEmbedUrl(tokenAddress: string, metrics?: DexTokenMetrics): string {
  const raw =
    metrics?.dexscreenerUrl?.trim() ||
    `https://dexscreener.com/robinhood/${tokenAddress.trim().toLowerCase()}`;
  const url = new URL(raw);
  url.searchParams.set('embed', '1');
  url.searchParams.set('theme', 'dark');
  return url.toString();
}

export function dexScreenerTokenPageUrl(tokenAddress: string): string {
  return `https://dexscreener.com/robinhood/${tokenAddress.trim().toLowerCase()}`;
}

export function DexScreenerEmbed({
  tokenAddress,
  metrics,
}: {
  tokenAddress: string;
  metrics?: DexTokenMetrics;
}) {
  if (!hasDexMarketData(metrics)) return null;

  return (
    <div className="dex-chart-embed dex-screener-embed">
      <iframe
        title="DexScreener"
        src={dexScreenerEmbedUrl(tokenAddress, metrics)}
        allow="clipboard-write"
        loading="lazy"
      />
    </div>
  );
}

/** @deprecated use DexScreenerEmbed */
export const DexScreenerChartEmbed = DexScreenerEmbed;
