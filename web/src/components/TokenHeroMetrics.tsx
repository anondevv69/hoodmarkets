import type { DexTokenMetrics } from '../lib/dexscreenerVolume';
import { formatUsdVol } from '../lib/dexscreenerVolume';
import { formatSubscriptUsdPrice } from '../lib/formatSubscriptPrice';

function HeroStat({
  label,
  value,
  loading,
  mono,
}: {
  label: string;
  value: string;
  loading?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="tp-stat">
      <div className="tp-stat-k">{label}</div>
      <div className={`tp-stat-v${mono ? ' lp-mono' : ''}${loading ? ' tp-stat-v-skeleton' : ''}`}>
        {loading ? '\u00a0' : value}
      </div>
    </div>
  );
}

export function TokenHeroMetrics({
  metrics,
  loading,
  variant = 'default',
}: {
  metrics?: DexTokenMetrics;
  loading?: boolean;
  variant?: 'default' | 'card';
}) {
  const mc = metrics?.marketCapUsd ?? metrics?.fdvUsd;
  const change = metrics?.change24hPct;

  const showSkeleton = loading && !metrics;
  const hasAny =
    showSkeleton ||
    mc != null ||
    metrics?.liquidityUsd != null ||
    metrics?.fdvUsd != null ||
    metrics?.volumeH24Usd != null ||
    metrics?.priceUsd != null ||
    metrics?.enhancedInfoPaid;

  if (!hasAny) return null;

  const embedded = variant === 'card';

  return (
    <div
      className={embedded ? 'tp-token-card-metrics' : 'tp-zone tp-hero-zone'}
      aria-busy={showSkeleton}
    >
      <div className={embedded ? 'tp-token-card-mcap-row tp-token-card-mcap-row--with-badge' : 'tp-hero-value'}>
        {embedded ? (
          <>
            <div>
              <div className="tp-token-card-mcap-label">Market cap</div>
              <div className="tp-token-card-mcap-value">
                <span className={showSkeleton ? 'tp-hero-value-skeleton' : undefined}>
                  {showSkeleton ? '\u00a0' : formatUsdVol(mc)}
                </span>
                {!showSkeleton && change != null && Number.isFinite(change) ? (
                  <span className={`tp-hero-change${change < 0 ? ' neg' : ''}`}>
                    {change >= 0 ? '+' : ''}
                    {change.toFixed(2)}%
                  </span>
                ) : null}
              </div>
            </div>
            {!showSkeleton && metrics?.enhancedInfoPaid ? (
              <span className="tp-dex-paid-badge" title="DexScreener Enhanced Token Info">
                Dex paid ✓
              </span>
            ) : null}
          </>
        ) : (
          <>
            <div className="tp-hero-label">Market cap</div>
            <span className={showSkeleton ? 'tp-hero-value-skeleton' : undefined}>
              {showSkeleton ? '\u00a0' : formatUsdVol(mc)}
            </span>
            {!showSkeleton && change != null && Number.isFinite(change) ? (
              <span className={`tp-hero-change${change < 0 ? ' neg' : ''}`}>
                {change >= 0 ? '+' : ''}
                {change.toFixed(2)}%
              </span>
            ) : null}
          </>
        )}
      </div>
      <div className={embedded ? 'tp-token-card-stats' : 'tp-stat-row'}>
        <HeroStat
          label="Liquidity"
          value={formatUsdVol(metrics?.liquidityUsd)}
          loading={showSkeleton}
        />
        <HeroStat label="FDV" value={formatUsdVol(metrics?.fdvUsd)} loading={showSkeleton} />
        <HeroStat
          label="Vol 24h"
          value={formatUsdVol(metrics?.volumeH24Usd)}
          loading={showSkeleton}
          mono
        />
        <HeroStat
          label="Price"
          value={formatSubscriptUsdPrice(metrics?.priceUsd)}
          loading={showSkeleton}
          mono
        />
      </div>
    </div>
  );
}
