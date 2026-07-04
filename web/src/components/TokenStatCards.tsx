import { useMemo } from 'react';
import type { DexTokenMetrics } from '../lib/dexscreenerVolume';
import { formatUsdVol } from '../lib/dexscreenerVolume';
import { formatAthMarketCapUsd } from '../lib/athMarketCap';
import { formatSubscriptUsdPrice } from '../lib/formatSubscriptPrice';

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className={`token-stat-card${loading ? ' token-stat-card-skeleton' : ''}`}>
      <p className="token-stat-card-label">{label}</p>
      <p className="token-stat-card-value lp-mono">{loading ? ' ' : value}</p>
    </div>
  );
}

export function TokenStatCards({
  tokenAddress,
  metrics,
  loading,
}: {
  tokenAddress: string;
  metrics?: DexTokenMetrics;
  loading?: boolean;
}) {
  const mc = metrics?.marketCapUsd ?? metrics?.fdvUsd;

  const athMc = useMemo(() => {
    if (loading && !metrics) return '—';
    return formatAthMarketCapUsd(tokenAddress, mc);
  }, [tokenAddress, mc, loading, metrics]);

  if (!loading && !metrics) return null;

  const hasAny =
    loading ||
    metrics?.priceUsd != null ||
    (mc != null && mc > 0) ||
    (metrics?.volumeH24Usd != null && metrics.volumeH24Usd > 0);

  if (!hasAny) return null;

  return (
    <div className="token-stat-cards" aria-busy={loading}>
      <StatCard
        label="Market Cap"
        value={formatUsdVol(mc)}
        loading={loading && !metrics}
      />
      <StatCard label="ATH Market Cap" value={athMc} loading={loading && !metrics} />
      <StatCard
        label="24h Volume"
        value={formatUsdVol(metrics?.volumeH24Usd)}
        loading={loading && !metrics}
      />
      <StatCard
        label="Price"
        value={formatSubscriptUsdPrice(metrics?.priceUsd)}
        loading={loading && !metrics}
      />
    </div>
  );
}
