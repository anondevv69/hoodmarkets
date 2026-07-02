import { useMemo, useState } from 'react';
import { shortenAddress } from '../chain';
import { formatTinyUsdPrice, formatUsdVol, type DexTokenMetrics } from '../lib/dexscreenerVolume';
import type { ExploreToken } from '../lib/exploreTokens';
import { openTokenPage } from '../lib/tokenRoute';
import { buildTradingLinks } from '../lib/tradingLinks';
import { CopyButton } from './CopyButton';
import { TokenAvatar } from './TokenAvatar';
import { TokenSocialLinks } from './TokenSocialLinks';

function ExploreRow({
  token,
  metrics,
}: {
  token: ExploreToken;
  metrics?: DexTokenMetrics;
}) {
  const d = token.deployment;
  const sym = token.symbol;
  const mc = metrics?.marketCapUsd ?? metrics?.fdvUsd ?? token.mcap;
  const vol = metrics?.volumeH24Usd;
  const liq = metrics?.liquidityUsd;
  const chg = metrics?.change24hPct ?? token.change24h;
  const links = buildTradingLinks(d.tokenAddress, metrics);

  function openDetails() {
    openTokenPage(d.tokenAddress);
  }

  function onRowKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDetails();
    }
  }

  function stopRowClick(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
  }

  return (
    <li
      className="explore-row explore-row-clickable"
      role="button"
      tabIndex={0}
      onClick={openDetails}
      onKeyDown={onRowKeyDown}
      aria-label={`${d.tokenName} ${sym} — view token details`}
    >
      <div className="explore-token-main">
        <TokenAvatar symbol={sym} imageUrl={d.tokenImageUrl} size={44} />
        <div className="explore-token-title">
          <div className="explore-token-link name lp-display">
            {d.tokenName} <span className="lp-mono muted">${sym}</span>
          </div>
          <div className="explore-metrics">
            <span className="token-address-row">
              <span className="lp-mono">{shortenAddress(d.tokenAddress)}</span>
              <span onClick={stopRowClick} onKeyDown={stopRowClick}>
                <CopyButton text={d.tokenAddress} />
              </span>
            </span>
            {' · '}
            {new Date(d.createdAt).toLocaleString()}
          </div>
          <div onClick={stopRowClick} onKeyDown={stopRowClick}>
            <TokenSocialLinks websiteUrl={d.tokenWebsiteUrl} xUrl={d.tokenXUrl} />
          </div>
        </div>
      </div>
      <div className="explore-market-cell">
        <div className="lp-mono explore-price">{formatTinyUsdPrice(metrics?.priceUsd)}</div>
        <div className="explore-market-line lp-mono">
          <span title="Market cap">MC {formatUsdVol(mc)}</span>
          <span title="24h volume">Vol {formatUsdVol(vol)}</span>
          <span title="Liquidity">Liq {formatUsdVol(liq)}</span>
        </div>
        {typeof chg === 'number' ? (
          <div className={`explore-chg lp-mono ${chg >= 0 ? 'up' : 'down'}`}>
            {chg >= 0 ? '+' : ''}
            {chg.toFixed(1)}% 24h
          </div>
        ) : null}
      </div>
      <div className="explore-links" onClick={stopRowClick} onKeyDown={stopRowClick}>
        <button type="button" className="btn btn-primary btn-sm" onClick={openDetails}>
          View
        </button>
        <a
          className="btn btn-ghost btn-sm"
          href={links.dexscreener}
          target="_blank"
          rel="noreferrer"
          onClick={stopRowClick}
        >
          Trade
        </a>
      </div>
    </li>
  );
}

export function TokensTab({
  exploreTokens,
  metricsByAddress,
  loading,
  error,
}: {
  exploreTokens: ExploreToken[];
  metricsByAddress: Record<string, DexTokenMetrics | undefined>;
  loading: boolean;
  error: string | null;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? exploreTokens.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.symbol.toLowerCase().includes(q) ||
            t.address.toLowerCase().includes(q),
        )
      : exploreTokens;
    return [...base].sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0));
  }, [exploreTokens, query]);

  if (loading) return <p className="muted">Loading tokens…</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="lp-fade-in">
      <div style={{ marginBottom: '1rem' }}>
        <input
          className="lp-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or contract address"
          style={{ width: '100%', maxWidth: 420 }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden>
            🔍
          </div>
          <p className="empty-state-title">
            {exploreTokens.length === 0 ? 'No tokens launched yet' : 'No tokens match your search'}
          </p>
          <p className="muted empty-state-sub">
            {exploreTokens.length === 0
              ? 'Be the first to launch on Robinhood Chain.'
              : 'Try a different name, symbol, or contract address.'}
          </p>
        </div>
      ) : (
        <div className="lp-card explore-card">
          <div className="explore-head">
            <span>Token</span>
            <span>Market</span>
            <span style={{ justifySelf: 'end' }}>Links</span>
          </div>
          <ul className="token-list">
            {filtered.map((t) => (
              <ExploreRow
                key={t.address}
                token={t}
                metrics={metricsByAddress[t.address]}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
