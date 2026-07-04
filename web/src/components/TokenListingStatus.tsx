import type { DexTokenMetrics } from '../lib/dexscreenerVolume';
import { hasDexMarketData } from '../lib/dexscreenerVolume';

export type DexScreenerEmbedMode = 'full' | 'chart' | 'trades';

/** DexScreener page path segment for embeds (pair address preferred when indexed). */
export function dexScreenerEmbedBaseUrl(
  tokenAddress: string,
  metrics?: DexTokenMetrics,
): string {
  const fromMetrics = metrics?.dexscreenerUrl?.trim();
  if (fromMetrics) {
    try {
      const parsed = new URL(fromMetrics);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return fromMetrics.split('?')[0] ?? fromMetrics;
    }
  }
  const pair = metrics?.pairAddress?.trim().toLowerCase();
  const token = tokenAddress.trim().toLowerCase();
  return `https://dexscreener.com/robinhood/${pair || token}`;
}

/** Full DexScreener embed — only loaded on token detail pages. */
export function dexScreenerEmbedUrl(
  tokenAddress: string,
  metrics?: DexTokenMetrics,
  mode: DexScreenerEmbedMode = 'full',
): string {
  const url = new URL(dexScreenerEmbedBaseUrl(tokenAddress, metrics));
  url.searchParams.set('embed', '1');
  url.searchParams.set('theme', 'dark');
  url.searchParams.set('info', '0');
  const indexed = hasDexMarketData(metrics);
  if (mode === 'chart' && indexed) {
    url.searchParams.set('trades', '0');
  } else if (mode === 'trades' && indexed) {
    url.searchParams.set('chart', '0');
  }
  return url.toString();
}

export function dexScreenerTokenPageUrl(tokenAddress: string, metrics?: DexTokenMetrics): string {
  return dexScreenerEmbedBaseUrl(tokenAddress, metrics);
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
  const embedKey = `${mode}-${metrics?.pairAddress ?? metrics?.dexscreenerUrl ?? tokenAddress}`;
  return (
    <div className={`${className}${clipFooter ? ' dex-screener-clip' : ''}`}>
      <iframe
        key={embedKey}
        title={title}
        src={dexScreenerEmbedUrl(tokenAddress, metrics, mode)}
        allow="clipboard-write"
        loading="eager"
        scrolling="no"
      />
    </div>
  );
}

export function DexScreenerChartEmbed({
  tokenAddress,
  metrics,
  forceShow = false,
}: {
  tokenAddress: string;
  metrics?: DexTokenMetrics;
  /** Render embed even before DexScreener metrics are indexed (fallback URL). */
  forceShow?: boolean;
}) {
  if (!forceShow && !hasDexMarketData(metrics)) return null;

  const indexed = hasDexMarketData(metrics);

  return (
    <DexScreenerIframe
      tokenAddress={tokenAddress}
      metrics={metrics}
      mode="chart"
      title="DexScreener chart"
      className={`dex-chart-embed dex-screener-chart-embed${indexed ? '' : ' dex-screener-chart-embed--full'}`}
      clipFooter
    />
  );
}

export function DexScreenerTradesEmbed({
  tokenAddress,
  metrics,
  forceShow = false,
}: {
  tokenAddress: string;
  metrics?: DexTokenMetrics;
  /** Render embed even before DexScreener metrics are indexed (fallback URL). */
  forceShow?: boolean;
}) {
  if (!forceShow && !hasDexMarketData(metrics)) return null;

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
