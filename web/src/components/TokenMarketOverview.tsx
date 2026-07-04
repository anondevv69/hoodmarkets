import type { DexTokenMetrics } from '../lib/dexscreenerVolume';
import {
  formatDexName,
  formatPairAge,
  formatTinyUsdPrice,
  formatTxns,
  formatUsdVol,
} from '../lib/dexscreenerVolume';

function changeClass(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  return n >= 0 ? 'up' : 'down';
}

function formatChange(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function StatPill({
  label,
  value,
  title,
  className,
}: {
  label: string;
  value: string;
  title?: string;
  className?: string;
}) {
  return (
    <div className={`token-stat-pill${className ? ` ${className}` : ''}`} title={title}>
      <span className="token-stat-pill-label">{label}</span>
      <span className="token-stat-pill-value lp-mono">{value}</span>
    </div>
  );
}

function ChangePill({ label, value }: { label: string; value: number | undefined }) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const dir = changeClass(value);
  return (
    <span className={`token-market-change-pill ${dir}`} title={`${label} price change`}>
      {label} {formatChange(value)}
    </span>
  );
}

export function TokenMarketOverview({
  metrics,
  loading,
}: {
  metrics?: DexTokenMetrics;
  loading?: boolean;
}) {
  if (loading && !metrics) {
    return (
      <div className="token-market-overview token-market-overview-loading" aria-busy="true">
        <div className="token-market-price-row">
          <div className="token-market-skeleton token-market-skeleton-price" />
        </div>
        <div className="token-stat-pills">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="token-stat-pill token-stat-pill-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const mc = metrics.marketCapUsd ?? metrics.fdvUsd;
  const hasAny =
    metrics.priceUsd != null ||
    (mc != null && mc > 0) ||
    (metrics.liquidityUsd != null && metrics.liquidityUsd > 0) ||
    (metrics.volumeH24Usd != null && metrics.volumeH24Usd > 0) ||
    (metrics.txnsH24 != null && metrics.txnsH24 > 0);

  if (!hasAny) return null;

  const dexLabel = formatDexName(metrics.dexId, metrics.dexVersion);
  const pairAge = formatPairAge(metrics.pairCreatedAt);
  const showFdv =
    metrics.fdvUsd != null &&
    metrics.marketCapUsd != null &&
    metrics.fdvUsd > 0 &&
    Math.abs(metrics.fdvUsd - metrics.marketCapUsd) / metrics.marketCapUsd > 0.05;

  return (
    <div className="token-market-overview">
      <div className="token-market-price-row">
        <div>
          <p className="token-market-price lp-mono">{formatTinyUsdPrice(metrics.priceUsd)}</p>
          {typeof metrics.change24hPct === 'number' ? (
            <p className={`token-market-chg ${changeClass(metrics.change24hPct)}`}>
              {formatChange(metrics.change24hPct)}
              <span className="token-market-chg-label"> 24h</span>
            </p>
          ) : null}
        </div>
        <p className="token-market-source muted">DexScreener · Robinhood</p>
      </div>

      <div className="token-market-changes">
        <ChangePill label="5m" value={metrics.changeM5Pct} />
        <ChangePill label="1h" value={metrics.changeH1Pct} />
        <ChangePill label="6h" value={metrics.changeH6Pct} />
        <ChangePill label="24h" value={metrics.change24hPct} />
      </div>

      <div className="token-stat-pills">
        {mc != null && mc > 0 ? (
          <StatPill label="Market cap" value={formatUsdVol(mc)} title="Market cap (USD)" />
        ) : null}
        {showFdv && metrics.fdvUsd ? (
          <StatPill label="FDV" value={formatUsdVol(metrics.fdvUsd)} title="Fully diluted valuation" />
        ) : null}
        {metrics.liquidityUsd != null && metrics.liquidityUsd > 0 ? (
          <StatPill label="Liquidity" value={formatUsdVol(metrics.liquidityUsd)} title="Pool liquidity (USD)" />
        ) : null}
        {metrics.volumeH24Usd != null && metrics.volumeH24Usd > 0 ? (
          <StatPill label="Vol 24h" value={formatUsdVol(metrics.volumeH24Usd)} title="24h volume (USD)" />
        ) : null}
        {metrics.volumeH1Usd != null && metrics.volumeH1Usd > 0 ? (
          <StatPill label="Vol 1h" value={formatUsdVol(metrics.volumeH1Usd)} title="1h volume (USD)" />
        ) : null}
        {metrics.txnsH24 != null && metrics.txnsH24 > 0 ? (
          <StatPill label="Trades 24h" value={formatTxns(metrics.txnsH24)} title="24h buy + sell count" />
        ) : null}
        {metrics.buysH24 != null && metrics.buysH24 > 0 ? (
          <StatPill
            label="Buys"
            value={formatTxns(metrics.buysH24)}
            title="24h buys"
            className="token-stat-pill-buy"
          />
        ) : null}
        {metrics.sellsH24 != null && metrics.sellsH24 > 0 ? (
          <StatPill
            label="Sells"
            value={formatTxns(metrics.sellsH24)}
            title="24h sells"
            className="token-stat-pill-sell"
          />
        ) : null}
        {dexLabel !== '—' ? (
          <StatPill label="DEX" value={dexLabel} title="Primary trading pair DEX" />
        ) : null}
        {pairAge !== '—' ? (
          <StatPill label="Pair age" value={pairAge} title="Time since pool was created" />
        ) : null}
      </div>
    </div>
  );
}
