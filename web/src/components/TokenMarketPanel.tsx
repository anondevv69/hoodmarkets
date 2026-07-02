import type { DexTokenMetrics } from '../lib/dexscreenerVolume';
import {
  formatTinyUsdPrice,
  formatTxns,
  formatUsdVol,
  hasDexMarketData,
} from '../lib/dexscreenerVolume';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="token-market-stat">
      <dt>{label}</dt>
      <dd className="lp-mono">{value}</dd>
    </div>
  );
}

function formatBuysSells(buys?: number, sells?: number): string {
  const b = buys != null && buys > 0 ? formatTxns(buys) : '—';
  const s = sells != null && sells > 0 ? formatTxns(sells) : '—';
  if (b === '—' && s === '—') return '—';
  return `${b} / ${s}`;
}

export function TokenMarketPanel({
  metrics,
}: {
  tokenName: string;
  symbol: string;
  metrics?: DexTokenMetrics;
}) {
  if (!hasDexMarketData(metrics) || !metrics) {
    return (
      <div className="lp-card token-market-card">
        <p className="muted" style={{ margin: 0 }}>
          Market data will appear once this token is indexed on DexScreener.
        </p>
      </div>
    );
  }

  const mc = metrics.marketCapUsd ?? metrics.fdvUsd;
  const chg24 = metrics.change24hPct;

  return (
    <div className="lp-card token-market-card">
      <div className="token-market-hero">
        <div className="token-market-price-block">
          <div className="token-market-price lp-mono">{formatTinyUsdPrice(metrics.priceUsd)}</div>
          {typeof chg24 === 'number' ? (
            <div className={`token-market-chg lp-mono ${chg24 >= 0 ? 'up' : 'down'}`}>
              {chg24 >= 0 ? '+' : ''}
              {chg24.toFixed(2)}% <span className="token-market-chg-label">24h</span>
            </div>
          ) : null}
        </div>
      </div>

      <dl className="token-market-grid">
        <Stat label="Market cap" value={formatUsdVol(mc)} />
        <Stat label="Liquidity" value={formatUsdVol(metrics.liquidityUsd)} />
        <Stat label="Vol 24h" value={formatUsdVol(metrics.volumeH24Usd)} />
        <Stat label="Trades 24h" value={formatTxns(metrics.txnsH24)} />
        <Stat
          label="Buys / sells 24h"
          value={formatBuysSells(metrics.buysH24, metrics.sellsH24)}
        />
      </dl>
    </div>
  );
}
