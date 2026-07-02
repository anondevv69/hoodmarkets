import type { DexTokenMetrics } from '../lib/dexscreenerVolume';
import { formatUsdVol } from '../lib/dexscreenerVolume';

export function DexMetricsStrip({ metrics }: { metrics?: DexTokenMetrics }) {
  const mc = metrics?.fdvUsd;
  const liq = metrics?.liquidityUsd;
  const vol = metrics?.volumeH24Usd;
  const chg = metrics?.change24hPct;
  if (
    (!mc || mc <= 0) &&
    (!liq || liq <= 0) &&
    (!vol || vol <= 0) &&
    typeof chg !== 'number'
  ) {
    return null;
  }

  return (
    <div className="dex-metrics">
      {mc != null && mc > 0 ? (
        <span title="FDV (DexScreener)">MC {formatUsdVol(mc)}</span>
      ) : null}
      {liq != null && liq > 0 ? (
        <span title="Pool liquidity (USD)">Liq {formatUsdVol(liq)}</span>
      ) : null}
      {vol != null && vol > 0 ? (
        <span title="24h volume (USD)">Vol {formatUsdVol(vol)}</span>
      ) : null}
      {typeof chg === 'number' ? (
        <span title="24h price change" style={{ color: chg >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
          {chg >= 0 ? '+' : ''}
          {chg.toFixed(1)}%
        </span>
      ) : null}
    </div>
  );
}
