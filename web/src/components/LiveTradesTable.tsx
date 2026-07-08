import { useCallback, useEffect, useState } from 'react';
import { shortenAddress, txUrl } from '../chain';
import { formatUsdVol } from '../lib/dexscreenerVolume';
import { fetchGeckoTokenTrades, type TokenTradeRow } from '../lib/geckoTerminalTrades';
import {
  fetchLatestRobinhoodSwaps,
  filterSwapsForToken,
  formatRelativeTime,
} from '../lib/robinhoodTrades';

const POLL_MS = 20_000;
const COMPACT_MAX_ROWS = 10;

function swapToRow(s: {
  id: string;
  txHash: string;
  sender: string;
  side: string;
  ethAmount: number;
  tokenAmount: string;
  timestamp: string;
}): TokenTradeRow {
  const raw = Number.parseFloat(s.tokenAmount) / 1e18;
  return {
    id: s.id,
    txHash: s.txHash,
    wallet: s.sender,
    isBuy: s.side === 'BUY',
    ethAmount: s.ethAmount,
    tokenAmount: Number.isFinite(raw) ? raw : 0,
    timestamp: s.timestamp,
  };
}

export function LiveTradesTable({
  tokenAddress,
  tokenSymbol,
  variant = 'default',
  hideWhenEmpty = false,
}: {
  tokenAddress: string;
  tokenSymbol: string;
  variant?: 'default' | 'compact';
  /** Hide the whole block when there are no trades (token page). */
  hideWhenEmpty?: boolean;
}) {
  const [rows, setRows] = useState<TokenTradeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      let trades = await fetchGeckoTokenTrades(tokenAddress);
      if (trades.length === 0) {
        const latest = await fetchLatestRobinhoodSwaps(500);
        trades = filterSwapsForToken(latest, tokenAddress).map(swapToRow);
      }
      setRows(trades);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tokenAddress]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const sym = tokenSymbol.replace(/^\$/, '');
  const [hideSmall, setHideSmall] = useState(false);
  const compact = variant === 'compact';
  const visible = rows
    .filter((s) => {
      if (!hideSmall) return true;
      if (s.usdVolume != null) return s.usdVolume >= 1;
      return s.ethAmount >= 0.0003;
    })
    .slice(0, compact ? COMPACT_MAX_ROWS : undefined);

  if (hideWhenEmpty && !loading && rows.length === 0) {
    return null;
  }

  const tableBody = loading ? (
    <p className="muted live-trades-status">Loading trades…</p>
  ) : visible.length === 0 ? (
    <p className="muted live-trades-status">No trades yet</p>
  ) : (
    <>
      {compact ? (
        <label className="live-trades-filter live-trades-filter--compact">
          <input
            type="checkbox"
            checked={hideSmall}
            onChange={(e) => setHideSmall(e.target.checked)}
          />
          Hide small
        </label>
      ) : (
        <div className="token-dex-section-head">
          <div>
            <h3 id="live-trades-heading" className="section-label">
              Recent trades
            </h3>
            <p className="muted token-dex-section-sub">Buys and sells on Robinhood Chain via Blockscout</p>
          </div>
          <label className="live-trades-filter">
            <input
              type="checkbox"
              checked={hideSmall}
              onChange={(e) => setHideSmall(e.target.checked)}
            />
            Hide small
          </label>
        </div>
      )}
      <div className="live-trades-scroll">
        <table className={`live-trades-table${compact ? ' live-trades-table--compact' : ''}`}>
          <thead>
            <tr>
              {!compact ? <th>Date</th> : null}
              <th>Wallet</th>
              <th>Side</th>
              <th className={compact ? 'num' : undefined}>USD</th>
              <th className={compact ? 'num' : undefined}>ETH</th>
              <th className={compact ? 'num' : undefined}>{sym}</th>
              {!compact ? <th>TX</th> : null}
              {compact ? <th className="num">Time</th> : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.id} className={s.isBuy ? 'live-trades-buy' : 'live-trades-sell'}>
                {!compact ? <td>{formatRelativeTime(s.timestamp)}</td> : null}
                <td className={`lp-mono${compact ? ' addr-cell' : ''}`}>
                  {shortenAddress(s.wallet)}
                </td>
                <td>
                  {compact ? (
                    <span className={`tp-pill ${s.isBuy ? 'buy' : 'sell'}`}>
                      {s.isBuy ? 'Buy' : 'Sell'}
                    </span>
                  ) : s.isBuy ? (
                    'Buy'
                  ) : (
                    'Sell'
                  )}
                </td>
                <td className={`lp-mono${compact ? ' num' : ''}`}>{formatUsdVol(s.usdVolume)}</td>
                <td className={`lp-mono${compact ? ' num' : ''}`}>
                  {s.ethAmount.toFixed(compact ? 6 : 4)}
                </td>
                <td className={`lp-mono${compact ? ' num' : ''}`}>
                  {s.isBuy ? '+' : '-'}
                  {s.tokenAmount >= 1
                    ? s.tokenAmount.toFixed(2)
                    : s.tokenAmount.toPrecision(3)}
                </td>
                {!compact ? (
                  <td>
                    <a href={txUrl(s.txHash)} target="_blank" rel="noreferrer" title="Blockscout">
                      ↗
                    </a>
                  </td>
                ) : null}
                {compact ? (
                  <td className="num time-cell">
                    <a
                      href={txUrl(s.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="live-trades-tx-link"
                      title="View on Blockscout"
                    >
                      {formatRelativeTime(s.timestamp)}
                    </a>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  if (compact) {
    return (
      <section className="tp-zone tp-trades-zone" aria-labelledby="live-trades-heading">
        <p id="live-trades-heading" className="tp-zone-label">
          Trades
        </p>
        <div className={`live-trades live-trades--compact`}>{tableBody}</div>
      </section>
    );
  }

  return (
    <section
      className="live-trades"
      aria-labelledby="live-trades-heading"
    >
      {tableBody}
    </section>
  );
}
