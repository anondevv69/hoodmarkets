import { useEffect, useMemo, useState } from 'react';
import { fetchDeploymentByAddress } from '../api';
import { shortenAddress } from '../chain';
import { formatUsdVol, fetchTokenMetricsFromDexscreener, type DexTokenMetrics } from '../lib/dexscreenerVolume';
import type { ExploreToken } from '../lib/exploreTokens';
import { toExploreTokens } from '../lib/exploreTokens';
import { extractContractAddressFromSearch, looksLikeAddressSearch } from '../lib/exploreSearch';
import { formatLaunchTimeEastern, parseCatalogCreatedAt } from '../lib/launchTime';
import { openTokenPage } from '../lib/tokenRoute';
import { CopyButton } from './CopyButton';
import { TokenAvatar } from './TokenAvatar';
import { TokenSocialLinks } from './TokenSocialLinks';

export type ExploreSort = 'mcap' | 'launch';

function mcapForToken(
  token: ExploreToken,
  metrics?: DexTokenMetrics,
): number {
  return metrics?.marketCapUsd ?? metrics?.fdvUsd ?? token.mcap ?? 0;
}

function sortExploreTokens(
  tokens: ExploreToken[],
  metricsByAddress: Record<string, DexTokenMetrics | undefined>,
  sort: ExploreSort,
): ExploreToken[] {
  return [...tokens].sort((a, b) => {
    if (sort === 'launch') {
      return parseCatalogCreatedAt(b.createdAt) - parseCatalogCreatedAt(a.createdAt);
    }
    const diff = mcapForToken(b, metricsByAddress[b.address]) - mcapForToken(a, metricsByAddress[a.address]);
    if (diff !== 0) return diff;
    return parseCatalogCreatedAt(b.createdAt) - parseCatalogCreatedAt(a.createdAt);
  });
}

function ExploreRow({
  token,
  metrics,
}: {
  token: ExploreToken;
  metrics?: DexTokenMetrics;
}) {
  const d = token.deployment;
  const sym = token.symbol;
  const mcap = metrics?.marketCapUsd ?? metrics?.fdvUsd ?? token.mcap;

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
            {formatLaunchTimeEastern(d.createdAt)}
          </div>
          <div
            className="explore-social-slot"
            onClick={stopRowClick}
            onKeyDown={stopRowClick}
          >
            <TokenSocialLinks websiteUrl={d.tokenWebsiteUrl} xUrl={d.tokenXUrl} />
          </div>
        </div>
      </div>
      <div className="explore-market-cell">
        <span className="lp-mono explore-mcap">{formatUsdVol(mcap)}</span>
      </div>
    </li>
  );
}

export function TokensTab({
  exploreTokens,
  metricsByAddress,
  loading,
  error,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: {
  exploreTokens: ExploreToken[];
  metricsByAddress: Record<string, DexTokenMetrics | undefined>;
  loading: boolean;
  error: string | null;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ExploreSort>('mcap');
  const [addressLookup, setAddressLookup] = useState<ExploreToken | null>(null);
  const [addressLookupMetrics, setAddressLookupMetrics] = useState<DexTokenMetrics | undefined>();
  const [addressLookupState, setAddressLookupState] = useState<'idle' | 'loading' | 'miss'>('idle');

  const fullAddressQuery = useMemo(() => extractContractAddressFromSearch(query), [query]);
  const isSearching = query.trim().length > 0;

  useEffect(() => {
    if (!fullAddressQuery) {
      setAddressLookup(null);
      setAddressLookupMetrics(undefined);
      setAddressLookupState('idle');
      return;
    }

    const alreadyLoaded = exploreTokens.some(
      (t) => t.address.toLowerCase() === fullAddressQuery,
    );
    if (alreadyLoaded) {
      setAddressLookup(null);
      setAddressLookupMetrics(undefined);
      setAddressLookupState('idle');
      return;
    }

    let cancelled = false;
    setAddressLookupState('loading');
    void (async () => {
      try {
        const deployment = await fetchDeploymentByAddress(fullAddressQuery);
        if (cancelled) return;
        const metrics = await fetchTokenMetricsFromDexscreener([deployment.tokenAddress]);
        if (cancelled) return;
        const m = metrics[deployment.tokenAddress];
        setAddressLookup(toExploreTokens([deployment], { [deployment.tokenAddress]: m })[0]);
        setAddressLookupMetrics(m);
        setAddressLookupState('idle');
      } catch {
        if (!cancelled) {
          setAddressLookup(null);
          setAddressLookupMetrics(undefined);
          setAddressLookupState('miss');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fullAddressQuery, exploreTokens]);

  const mergedMetrics = useMemo(() => {
    if (!addressLookup) return metricsByAddress;
    return {
      ...metricsByAddress,
      [addressLookup.address]: addressLookupMetrics ?? metricsByAddress[addressLookup.address],
    };
  }, [addressLookup, addressLookupMetrics, metricsByAddress]);

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
    const sorted = sortExploreTokens(base, mergedMetrics, sort);
    if (sorted.length === 0 && addressLookup) {
      return [addressLookup];
    }
    return sorted;
  }, [exploreTokens, mergedMetrics, query, sort, addressLookup]);

  if (loading) return <p className="muted">Loading tokens…</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="lp-fade-in">
      <div className="explore-toolbar">
        <input
          className="lp-input explore-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or contract address"
        />
        <div className="explore-sort" role="group" aria-label="Sort tokens">
          <button
            type="button"
            className={`explore-sort-btn${sort === 'mcap' ? ' is-active' : ''}`}
            aria-pressed={sort === 'mcap'}
            onClick={() => setSort('mcap')}
          >
            Market cap
          </button>
          <button
            type="button"
            className={`explore-sort-btn${sort === 'launch' ? ' is-active' : ''}`}
            aria-pressed={sort === 'launch'}
            onClick={() => setSort('launch')}
          >
            Newest
          </button>
        </div>
        {exploreTokens.length > 0 ? (
          <p className="explore-count muted">
            {exploreTokens.length} token{exploreTokens.length === 1 ? '' : 's'} loaded
            {hasMore && !isSearching ? ' · more available' : ''}
          </p>
        ) : null}
      </div>

      {addressLookupState === 'loading' ? (
        <p className="muted" style={{ marginBottom: '1rem' }}>
          Looking up contract…
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden>
            🔍
          </div>
          <p className="empty-state-title">
            {exploreTokens.length === 0
              ? 'No tokens launched yet'
              : addressLookupState === 'miss'
                ? 'Token not in hood.markets catalog'
                : 'No tokens match your search'}
          </p>
          <p className="muted empty-state-sub">
            {exploreTokens.length === 0
              ? 'Be the first to launch on Robinhood Chain.'
              : addressLookupState === 'miss'
                ? 'This contract may exist on-chain but was not launched through hood.markets, or the full 0x address is required.'
                : looksLikeAddressSearch(query)
                  ? 'Paste the full 42-character contract address (0x + 40 hex digits).'
                  : 'Try a different name, symbol, or contract address.'}
          </p>
          {addressLookupState === 'miss' && fullAddressQuery ? (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: '0.75rem' }}
              onClick={() => openTokenPage(fullAddressQuery)}
            >
              Try opening {shortenAddress(fullAddressQuery)} anyway
            </button>
          ) : null}
        </div>
      ) : (
        <div className="lp-card explore-card">
          <div className="explore-head">
            <span>Token</span>
            <span>Market cap</span>
          </div>
          <ul className="token-list">
            {filtered.map((t) => (
              <ExploreRow
                key={t.address}
                token={t}
                metrics={mergedMetrics[t.address]}
              />
            ))}
          </ul>
          {hasMore && !isSearching && onLoadMore ? (
            <div className="explore-load-more">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={loadingMore}
                onClick={() => onLoadMore()}
              >
                {loadingMore ? 'Loading…' : 'Load more tokens'}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
