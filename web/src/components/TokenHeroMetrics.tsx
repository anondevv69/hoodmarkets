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
}: {
  metrics?: DexTokenMetrics;
  loading?: boolean;
}) {
  const mc = metrics?.marketCapUsd ?? metrics?.fdvUsd;
  const change = metrics?.change24hPct;
  const trades =
    metrics?.txnsH24 ??
    ((metrics?.buysH24 ?? 0) + (metrics?.sellsH24 ?? 0) || undefined);

  const showSkeleton = loading && !metrics;
  const hasAny =
    showSkeleton ||
    mc != null ||
    metrics?.liquidityUsd != null ||
    metrics?.fdvUsd != null ||
    metrics?.volumeH24Usd != null ||
    trades != null ||
    metrics?.priceUsd != null;

  if (!hasAny) return null;

  const tradesLabel =
    trades != null && trades > 0 ? String(trades) : metrics ? '0' : '—';

  return (
    <div className="tp-zone tp-hero-zone" aria-busy={showSkeleton}>
      <div className="tp-hero-label">Market cap</div>
      <div className="tp-hero-value">
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
      <div className="tp-stat-row">
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
        <HeroStat label="Trades" value={tradesLabel} loading={showSkeleton} />
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
