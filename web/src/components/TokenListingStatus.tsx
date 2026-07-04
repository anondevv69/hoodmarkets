import type { DexTokenMetrics } from '../lib/dexscreenerVolume';
import { hasDexMarketData } from '../lib/dexscreenerVolume';

export type DexScreenerEmbedMode = 'full' | 'chart' | 'trades';

/** Full DexScreener embed — only loaded on token detail pages. */
export function dexScreenerEmbedUrl(
  tokenAddress: string,
  metrics?: DexTokenMetrics,
  mode: DexScreenerEmbedMode = 'full',
): string {
  const raw =
    metrics?.dexscreenerUrl?.trim() ||
    `https://dexscreener.com/robinhood/${tokenAddress.trim().toLowerCase()}`;
  const url = new URL(raw);
  url.searchParams.set('embed', '1');
  url.searchParams.set('theme', 'dark');
  url.searchParams.set('info', '0');
  if (mode === 'chart') {
    url.searchParams.set('trades', '0');
  } else if (mode === 'trades') {
    url.searchParams.set('chart', '0');
  }
  return url.toString();
}

export function dexScreenerTokenPageUrl(tokenAddress: string, metrics?: DexTokenMetrics): string {
  return (
    metrics?.dexscreenerUrl?.trim() ||
    `https://dexscreener.com/robinhood/${tokenAddress.trim().toLowerCase()}`
  );
}

function DexScreenerIframe({
  tokenAddress,
  metrics,
  mode,
  title,
  className,
  clipFooter = false,
}: {
  tokenAddress: string;
  metrics?: DexTokenMetrics;
  mode: DexScreenerEmbedMode;
  title: string;
  className: string;
  /** Crop DexScreener's bottom "Tracked by" bar (NOXA-style). */
  clipFooter?: boolean;
}) {
  return (
    <div className={`${className}${clipFooter ? ' dex-screener-clip' : ''}`}>
      <iframe
        title={title}
        src={dexScreenerEmbedUrl(tokenAddress, metrics, mode)}
        allow="clipboard-write"
        loading="lazy"
        scrolling="no"
      />
    </div>
  );
}

export function DexScreenerChartEmbed({
  tokenAddress,
  metrics,
}: {
  tokenAddress: string;
  metrics?: DexTokenMetrics;
}) {
  if (!hasDexMarketData(metrics)) return null;

  return (
    <DexScreenerIframe
      tokenAddress={tokenAddress}
      metrics={metrics}
      mode="chart"
      title="DexScreener chart"
      className="dex-chart-embed dex-screener-chart-embed"
      clipFooter
    />
  );
}

export function DexScreenerTradesEmbed({
  tokenAddress,
  metrics,
}: {
  tokenAddress: string;
  metrics?: DexTokenMetrics;
}) {
  if (!hasDexMarketData(metrics)) return null;

  return (
    <DexScreenerIframe
      tokenAddress={tokenAddress}
      metrics={metrics}
      mode="trades"
      title="DexScreener recent trades"
      className="dex-chart-embed dex-screener-trades-embed"
    />
  );
}

/** @deprecated use DexScreenerChartEmbed + DexScreenerTradesEmbed */
export function DexScreenerEmbed({
  tokenAddress,
  metrics,
}: {
  tokenAddress: string;
  metrics?: DexTokenMetrics;
}) {
  if (!hasDexMarketData(metrics)) return null;

  return (
    <DexScreenerIframe
      tokenAddress={tokenAddress}
      metrics={metrics}
      mode="full"
      title="DexScreener"
      className="dex-chart-embed dex-screener-embed"
    />
  );
}

/** @deprecated use DexScreenerChartEmbed */
export const DexScreenerChartEmbedLegacy = DexScreenerEmbed;
