import type { DexTokenMetrics } from '../lib/dexscreenerVolume';

function isIndexedOnDexScreener(metrics?: DexTokenMetrics): boolean {
  if (!metrics) return false;
  return (
    (metrics.liquidityUsd != null && metrics.liquidityUsd > 0) ||
    (metrics.volumeH24Usd != null && metrics.volumeH24Usd > 0)
  );
}

export function TokenListingStatus({
  metrics,
  poolId,
}: {
  metrics?: DexTokenMetrics;
  poolId?: string;
}) {
  if (isIndexedOnDexScreener(metrics)) return null;

  return (
    <div className="listing-status">
      <p className="listing-status__title">Live on hood.markets — not on external charts yet</p>
      <p className="muted listing-status__body">
        Your token deployed into a <strong>Uniswap v4 pool</strong> on Robinhood Chain. It appears
        here in Explore immediately, but DexScreener and the Uniswap app only list pools they
        recognize and index.
      </p>
      {poolId ? (
        <p className="mono listing-status__pool">
          Pool id: <span>{poolId}</span>
        </p>
      ) : null}
      <ul className="listing-status__list muted">
        <li>
          <strong>DexScreener chart</strong> — empty until they index this factory/pool (needs
          liquidity + swap volume, or a DEX listing request).
        </li>
        <li>
          <strong>Uniswap swap</strong> — “no routes” until hood.markets hook is on their allowlist.
        </li>
        <li>
          <strong>hood.markets</strong> — token page, explore, and fee claim work now.
        </li>
      </ul>
      <p className="muted listing-status__hint">
        To show up like CAPTAIN or DIH: raise launch liquidity, generate real volume, and request
        DexScreener listing for factory{' '}
        <span className="mono">0xdeBc9bC5c3Ca697493a01e8ac503B590D209d8bD</span>.
      </p>
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
