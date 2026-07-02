import type { DexTokenMetrics } from '../lib/dexscreenerVolume';

function isIndexedOnDexScreener(metrics?: DexTokenMetrics): boolean {
  if (!metrics) return false;
  return (
    (metrics.liquidityUsd != null && metrics.liquidityUsd > 0) ||
    (metrics.volumeH24Usd != null && metrics.volumeH24Usd > 0)
  );
}

export function DexScreenerChartEmbed({
  tokenAddress,
  metrics,
}: {
  tokenAddress: string;
  metrics?: DexTokenMetrics;
}) {
  if (!isIndexedOnDexScreener(metrics)) return null;

  const addr = tokenAddress.trim().toLowerCase();
  const src = `https://dexscreener.com/robinhood/${addr}?embed=1&theme=dark&trades=0&info=0`;

  return (
    <div className="dex-chart-embed">
      <iframe
        title="DexScreener chart"
        src={src}
        allow="clipboard-write"
        allowFullScreen
      />
    </div>
  );
}
