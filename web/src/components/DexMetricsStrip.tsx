import type { DexTokenMetrics } from '../lib/dexscreenerVolume';
import { formatUsdVol } from '../lib/dexscreenerVolume';
import type { OnChainPoolStats } from '../lib/robinhoodSwap';

function formatEth(n: string): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '—';
  if (v >= 1) return `${v.toFixed(4)} ETH`;
  if (v >= 0.0001) return `${v.toFixed(6)} ETH`;
  return `${v.toExponential(2)} ETH`;
}

export function DexMetricsStrip({
  metrics,
  onChain,
}: {
  metrics?: DexTokenMetrics;
  onChain?: OnChainPoolStats | null;
}) {
  const mcDex = metrics?.fdvUsd;
  const liqDex = metrics?.liquidityUsd;
  const vol = metrics?.volumeH24Usd;
  const chg = metrics?.change24hPct;

  const hasDex =
    (mcDex != null && mcDex > 0) ||
    (liqDex != null && liqDex > 0) ||
    (vol != null && vol > 0) ||
    typeof chg === 'number';

  const hasOnChain =
    onChain &&
    (Number(onChain.marketCapEth) > 0 ||
      Number(onChain.liquidityEth) > 0 ||
      Number(onChain.priceEthPerToken) > 0);

  if (!hasDex && !hasOnChain) return null;

  return (
    <div className="dex-metrics">
      {hasDex ? (
        <>
          {mcDex != null && mcDex > 0 ? (
            <span title="FDV (DexScreener)">MC {formatUsdVol(mcDex)}</span>
          ) : null}
          {liqDex != null && liqDex > 0 ? (
            <span title="Pool liquidity (USD)">Liq {formatUsdVol(liqDex)}</span>
          ) : null}
          {vol != null && vol > 0 ? (
            <span title="24h volume (USD)">Vol {formatUsdVol(vol)}</span>
          ) : null}
          {typeof chg === 'number' ? (
            <span
              title="24h price change"
              style={{ color: chg >= 0 ? 'var(--accent)' : 'var(--danger)' }}
            >
              {chg >= 0 ? '+' : ''}
              {chg.toFixed(1)}%
            </span>
          ) : null}
        </>
      ) : (
        <>
          {Number(onChain!.marketCapEth) > 0 ? (
            <span title="Market cap from on-chain pool price × total supply">
              MC {formatEth(onChain!.marketCapEth)}
            </span>
          ) : null}
          {Number(onChain!.liquidityEth) > 0 ? (
            <span title="Rough pool TVL from v4 liquidity">Liq {formatEth(onChain!.liquidityEth)}</span>
          ) : null}
          {Number(onChain!.priceEthPerToken) > 0 ? (
            <span title="Spot price from Uniswap v4 sqrtPrice">
              {formatEth(onChain!.priceEthPerToken)} / token
            </span>
          ) : null}
          <span className="muted" title="DexScreener has not indexed this pool yet">
            on-chain
          </span>
        </>
      )}
    </div>
  );
}

export function OnChainPoolPanel({ stats }: { stats: OnChainPoolStats }) {
  const price = Number(stats.priceEthPerToken);
  const mc = Number(stats.marketCapEth);
  const liq = Number(stats.liquidityEth);
  if (price <= 0 && mc <= 0 && liq <= 0) return null;

  return (
    <div className="on-chain-pool-panel muted" style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
      <p className="section-label" style={{ marginBottom: '0.35rem' }}>
        Pool (on-chain)
      </p>
      <p>
        Price: <strong>{formatEth(stats.priceEthPerToken)}</strong> per token
        {mc > 0 ? (
          <>
            {' '}
            · MC <strong>{formatEth(stats.marketCapEth)}</strong>
          </>
        ) : null}
        {liq > 0 ? (
          <>
            {' '}
            · Liq ~<strong>{formatEth(stats.liquidityEth)}</strong>
          </>
        ) : null}
      </p>
      <p style={{ marginTop: '0.25rem', fontSize: '0.8rem' }}>
        DexScreener may not list Robinhood v4 pools yet — these values are read live from the
        Uniswap v4 pool manager.
      </p>
    </div>
  );
}
