import { useCallback, useEffect, useState } from 'react';
import { shortenAddress, txUrl } from '../chain';
import { formatUsdVol } from '../lib/dexscreenerVolume';
import {
  fetchEthUsdPrice,
  fetchLatestRobinhoodSwaps,
  filterSwapsForToken,
  formatRelativeTime,
  formatTokenAmount,
  type RobinhoodSwap,
} from '../lib/robinhoodTrades';
import { DexScreenerTradesEmbed } from './TokenListingStatus';
import type { DexTokenMetrics } from '../lib/dexscreenerVolume';

export function LiveTradesTable({
  tokenAddress,
  tokenSymbol,
  metrics,
  variant = 'default',
}: {
  tokenAddress: string;
  tokenSymbol: string;
  metrics?: DexTokenMetrics;
  variant?: 'default' | 'compact';
}) {
  const [swaps, setSwaps] = useState<RobinhoodSwap[]>([]);
  const [ethUsd, setEthUsd] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [latest, ethPrice] = await Promise.all([
        fetchLatestRobinhoodSwaps(100),
        fetchEthUsdPrice(),
      ]);
      setSwaps(filterSwapsForToken(latest, tokenAddress));
      setEthUsd(ethPrice);
    } catch {
      setSwaps([]);
    } finally {
      setLoading(false);
    }
  }, [tokenAddress]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const sym = tokenSymbol.replace(/^\$/, '');
  const [hideSmall, setHideSmall] = useState(false);
  const rows = swaps.filter((s) => {
    if (!hideSmall || ethUsd == null) return true;
    const usd = s.ethAmount * ethUsd;
    return usd >= 1;
  });
  const compact = variant === 'compact';
  const showNativeTable = !loading && rows.length > 0;

  return (
    <section
      className={`live-trades${compact ? ' live-trades--compact' : ''}`}
      aria-labelledby="live-trades-heading"
    >
      {!compact ? (
        <div className="token-dex-section-head">
          <div>
            <h3 id="live-trades-heading" className="section-label">
              Live Trades
            </h3>
            <p className="muted token-dex-section-sub">Recent buys and sells on Robinhood</p>
          </div>
          {showNativeTable ? (
            <label className="live-trades-filter">
              <input
                type="checkbox"
                checked={hideSmall}
                onChange={(e) => setHideSmall(e.target.checked)}
              />
              Hide &lt;$1
            </label>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="muted live-trades-status">Loading trades…</p>
      ) : showNativeTable ? (
        <>
          {compact ? (
            <label className="live-trades-filter live-trades-filter--compact">
              <input
                type="checkbox"
                checked={hideSmall}
                onChange={(e) => setHideSmall(e.target.checked)}
              />
              Hide &lt;$1
            </label>
          ) : null}
          <div className="live-trades-scroll">
            <table className={`live-trades-table${compact ? ' live-trades-table--compact' : ''}`}>
              <thead>
                <tr>
                  {!compact ? <th>Date</th> : null}
                  <th>Account</th>
                  <th>Type</th>
                  <th className={compact ? 'num' : undefined}>USD</th>
                  <th className={compact ? 'num' : undefined}>{compact ? 'WETH' : 'ETH'}</th>
                  <th className={compact ? 'num' : undefined}>{sym}</th>
                  {!compact ? <th>TX</th> : null}
                  {compact ? <th className="num">Time</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const usd = ethUsd != null ? s.ethAmount * ethUsd : undefined;
                  const isBuy = s.side === 'BUY';
                  return (
                    <tr key={s.id} className={isBuy ? 'live-trades-buy' : 'live-trades-sell'}>
                      {!compact ? <td>{formatRelativeTime(s.timestamp)}</td> : null}
                      <td className={`lp-mono${compact ? ' addr-cell' : ''}`}>
                        {shortenAddress(s.sender)}
                      </td>
                      <td>
                        {compact ? (
                          <span className={`tp-pill ${isBuy ? 'buy' : 'sell'}`}>
                            {isBuy ? 'Buy' : 'Sell'}
                          </span>
                        ) : isBuy ? (
                          'Buy'
                        ) : (
                          'Sell'
                        )}
                      </td>
                      <td className={`lp-mono${compact ? ' num' : ''}`}>{formatUsdVol(usd)}</td>
                      <td className={`lp-mono${compact ? ' num' : ''}`}>
                        {s.ethAmount.toFixed(compact ? 7 : 4)}
                      </td>
                      <td className={`lp-mono${compact ? ' num' : ''}`}>
                        {isBuy ? '+' : '-'}
                        {formatTokenAmount(s.tokenAmount)}
                      </td>
                      {!compact ? (
                        <td>
                          <a href={txUrl(s.txHash)} target="_blank" rel="noreferrer">
                            ↗
                          </a>
                        </td>
                      ) : null}
                      {compact ? (
                        <td className="num time-cell">{formatRelativeTime(s.timestamp)}</td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <DexScreenerTradesEmbed tokenAddress={tokenAddress} metrics={metrics} forceShow />
      )}
    </section>
  );
}
