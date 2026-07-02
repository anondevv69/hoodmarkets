import type { DexTokenMetrics } from '../lib/dexscreenerVolume';
import { formatTxns, formatUsdVol } from '../lib/dexscreenerVolume';

export function DexMetricsStrip({ metrics }: { metrics?: DexTokenMetrics }) {
  if (!metrics) return null;

  const mc = metrics.marketCapUsd ?? metrics.fdvUsd;
  const vol = metrics.volumeH24Usd;
  const liq = metrics.liquidityUsd;
  const chg = metrics.change24hPct;
  const txns = metrics.txnsH24;
  const hasAny =
    (mc != null && mc > 0) ||
    (vol != null && vol > 0) ||
    (liq != null && liq > 0) ||
    typeof chg === 'number' ||
    (txns != null && txns > 0);

  if (!hasAny) return null;

  return (
    <div className="dex-metrics">
      {mc != null && mc > 0 ? <span title="Market cap (DexScreener)">MC {formatUsdVol(mc)}</span> : null}
      {liq != null && liq > 0 ? (
        <span title="Pool liquidity (USD)">Liq {formatUsdVol(liq)}</span>
      ) : null}
      {vol != null && vol > 0 ? <span title="24h volume (USD)">Vol {formatUsdVol(vol)}</span> : null}
      {txns != null && txns > 0 ? <span title="24h trades">Trades {formatTxns(txns)}</span> : null}
      {typeof chg === 'number' ? (
        <span
          title="24h price change"
          style={{ color: chg >= 0 ? 'var(--accent)' : 'var(--danger)' }}
        >
          {chg >= 0 ? '+' : ''}
          {chg.toFixed(1)}%
        </span>
      ) : null}
    </div>
  );
}
