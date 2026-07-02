import { useEffect, useState } from 'react';
import { fetchDeployments, type Deployment } from '../api';
import { shortenAddress } from '../chain';
import {
  fetchTokenMetricsFromDexscreener,
  formatUsdVol,
  type DexTokenMetrics,
} from '../lib/dexscreenerVolume';
import { buildTradingLinks } from '../lib/tradingLinks';
import { openTokenPage } from '../lib/tokenRoute';
import { CopyButton } from './CopyButton';
import { DexMetricsStrip } from './DexMetricsStrip';
import { TokenAvatar } from './TokenAvatar';
import { TokenSocialLinks } from './TokenSocialLinks';

function ExploreRow({
  deployment: d,
  metrics,
}: {
  deployment: Deployment;
  metrics?: DexTokenMetrics;
}) {
  const sym = d.tokenSymbol.replace(/^\$/, '');
  const links = buildTradingLinks(d.tokenAddress);
  const mc = metrics?.fdvUsd;

  return (
    <li className="explore-row">
      <div className="explore-token-main">
        <TokenAvatar symbol={sym} imageUrl={d.tokenImageUrl} size={44} />
        <div className="explore-token-title">
          <button
            type="button"
            className="explore-token-link name lp-display"
            onClick={() => openTokenPage(d.tokenAddress)}
          >
            {d.tokenName} <span className="lp-mono muted">${sym}</span>
          </button>
          <div className="explore-metrics">
            <span className="lp-mono">{shortenAddress(d.tokenAddress)}</span>
            <CopyButton text={d.tokenAddress} />
            {' · '}
            {new Date(d.createdAt).toLocaleString()}
          </div>
          <TokenSocialLinks websiteUrl={d.tokenWebsiteUrl} xUrl={d.tokenXUrl} />
        </div>
      </div>
      <div>
        <div className="lp-mono" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
          {mc && mc > 0 ? formatUsdVol(mc) : '—'}
        </div>
        <DexMetricsStrip metrics={metrics} />
      </div>
      <div className="explore-links">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => openTokenPage(d.tokenAddress)}
        >
          Details
        </button>
        <a href={links.dexscreener} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
          Chart
        </a>
        <a href={links.uniswapSwap} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
          Trade
        </a>
      </div>
    </li>
  );
}

export function TokensTab() {
  const [tokens, setTokens] = useState<Deployment[]>([]);
  const [metricsByAddress, setMetricsByAddress] = useState<
    Record<string, DexTokenMetrics | undefined>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchDeployments(50, 0);
        if (cancelled) return;
        setTokens(rows);
        const addresses = rows.map((r) => r.tokenAddress);
        if (addresses.length > 0) {
          const metrics = await fetchTokenMetricsFromDexscreener(addresses);
          if (!cancelled) setMetricsByAddress(metrics);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load tokens');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = tokens.filter((t) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      t.tokenName.toLowerCase().includes(q) ||
      t.tokenSymbol.toLowerCase().includes(q) ||
      t.tokenAddress.toLowerCase().includes(q)
    );
  });

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
          {tokens.length === 0
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
                key={t.tokenAddress}
                deployment={t}
                metrics={metricsByAddress[t.tokenAddress]}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
