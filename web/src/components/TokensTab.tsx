import { useMemo, useState } from 'react';
import { shortenAddress } from '../chain';
import { formatUsdVol, type DexTokenMetrics } from '../lib/dexscreenerVolume';
import type { ExploreToken } from '../lib/exploreTokens';
import { openTokenPage } from '../lib/tokenRoute';
import { CopyButton } from './CopyButton';
import { DexMetricsStrip } from './DexMetricsStrip';
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
  const mc = metrics?.fdvUsd;

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
            <span className="lp-mono">{shortenAddress(d.tokenAddress)}</span>
            <span onClick={stopRowClick} onKeyDown={stopRowClick}>
              <CopyButton text={d.tokenAddress} />
            </span>
            {' · '}
            {new Date(d.createdAt).toLocaleString()}
          </div>
          <div onClick={stopRowClick} onKeyDown={stopRowClick}>
            <TokenSocialLinks websiteUrl={d.tokenWebsiteUrl} xUrl={d.tokenXUrl} />
          </div>
        </div>
      </div>
      <div>
        <div className="lp-mono" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
          {mc && mc > 0 ? formatUsdVol(mc) : '—'}
        </div>
        <DexMetricsStrip metrics={metrics} />
      </div>
      <div className="explore-links" onClick={stopRowClick} onKeyDown={stopRowClick}>
        <button type="button" className="btn btn-primary btn-sm" onClick={openDetails}>
          View
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => openTokenPage(d.tokenAddress, { buyEth: '0.005' })}
        >
          Buy
        </button>
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
    if (!q) return exploreTokens;
    return exploreTokens.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q),
    );
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
        <div className="empty">
          {exploreTokens.length === 0
            ? 'No tokens launched yet. Be the first.'
            : 'No tokens match your search.'}
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
