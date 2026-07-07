import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fetchDeploymentByAddress } from '../api';
import { shortenAddress } from '../chain';
import { formatUsdVol, type DexTokenMetrics } from '../lib/dexscreenerVolume';
import type { ExploreToken } from '../lib/exploreTokens';
import { toExploreTokens } from '../lib/exploreTokens';
import { extractContractAddressFromSearch, looksLikeAddressSearch } from '../lib/exploreSearch';
import { EXPLORE_PAGE_SIZE } from '../hooks/useExploreTokens';
import { formatLaunchTimeEastern, parseCatalogCreatedAt } from '../lib/launchTime';
import { navigateToAppTab, openTokenPage } from '../lib/tokenRoute';
import { resolveExploreTokenImageUrl } from '../lib/resolveTokenImage';
import { CopyButton } from './CopyButton';
import { TokenAvatar } from './TokenAvatar';
import { TokenSocialLinks } from './TokenSocialLinks';
import type { Deployment } from '../api';

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

function buildPageList(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) out.push('gap');
    out.push(sorted[i]!);
  }
  return out;
}

function ExploreRow({
  token,
  metrics,
  imagePriority = false,
}: {
  token: ExploreToken;
  metrics?: DexTokenMetrics;
  imagePriority?: boolean;
}) {
  const d = token.deployment;
  const sym = token.symbol;
  const mcap = metrics?.marketCapUsd ?? metrics?.fdvUsd ?? token.mcap;
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | undefined>(
    d.tokenImageUrl,
  );

  useEffect(() => {
    let cancelled = false;
    const raw = d.tokenImageUrl?.trim();
    if (!raw) {
      setResolvedImageUrl(undefined);
      return;
    }
    setResolvedImageUrl(raw);
    void resolveExploreTokenImageUrl(raw).then((resolved) => {
      if (!cancelled && resolved) setResolvedImageUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [d.tokenImageUrl]);

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
        <TokenAvatar symbol={sym} imageUrl={resolvedImageUrl} size={44} priority={imagePriority} />
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

function ExploreToolbarActions({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="explore-toolbar-actions">
      <button type="button" className="btn btn-primary btn-sm" onClick={onLaunch}>
        Launch
      </button>
    </div>
  );
}

export function TokensTab({
  catalog,
  metricsByAddress,
  loading,
  loadingMetrics = false,
  error,
  onEnsureMetrics,
  onEnsureCatalogSize,
  onNavigateToLaunch,
}: {
  catalog: Deployment[];
  metricsByAddress: Record<string, DexTokenMetrics | undefined>;
  loading: boolean;
  loadingMetrics?: boolean;
  error: string | null;
  onEnsureMetrics?: (addresses: string[]) => void;
  onEnsureCatalogSize?: (minCount: number) => void;
  onNavigateToLaunch?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ExploreSort>('mcap');
  const [page, setPage] = useState(1);
  const [addressLookupState, setAddressLookupState] = useState<'idle' | 'loading' | 'miss'>('idle');
  const lastOpenedAddressRef = useRef<string | null>(null);

  const fullAddressQuery = useMemo(() => extractContractAddressFromSearch(query), [query]);
  const isTextSearch = query.trim().length > 0 && !fullAddressQuery;
  const inCatalog = useMemo(
    () =>
      fullAddressQuery
        ? catalog.some((d) => d.tokenAddress.toLowerCase() === fullAddressQuery)
        : false,
    [catalog, fullAddressQuery],
  );

  useLayoutEffect(() => {
    if (!fullAddressQuery || loading) return;
    if (lastOpenedAddressRef.current === fullAddressQuery) return;
    if (!inCatalog) return;

    lastOpenedAddressRef.current = fullAddressQuery;
    openTokenPage(fullAddressQuery);
  }, [fullAddressQuery, inCatalog, loading]);

  useEffect(() => {
    if (!fullAddressQuery) {
      setAddressLookupState('idle');
      lastOpenedAddressRef.current = null;
      return;
    }

    if (inCatalog || loading) {
      setAddressLookupState('idle');
      return;
    }

    let cancelled = false;
    setAddressLookupState('loading');
    void (async () => {
      try {
        await fetchDeploymentByAddress(fullAddressQuery);
        if (cancelled) return;
        if (lastOpenedAddressRef.current === fullAddressQuery) return;
        lastOpenedAddressRef.current = fullAddressQuery;
        openTokenPage(fullAddressQuery);
      } catch {
        if (!cancelled) setAddressLookupState('miss');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fullAddressQuery, inCatalog, loading]);

  const sortedTokens = useMemo(
    () => sortExploreTokens(toExploreTokens(catalog, metricsByAddress), metricsByAddress, sort),
    [catalog, metricsByAddress, sort],
  );

  const totalPages = Math.max(1, Math.ceil(sortedTokens.length / EXPLORE_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const displayTokens = useMemo(() => {
    if (fullAddressQuery && addressLookupState === 'miss') return [];
    if (isTextSearch) {
      const q = query.trim().toLowerCase();
      return sortedTokens.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q),
      );
    }
    const start = (page - 1) * EXPLORE_PAGE_SIZE;
    return sortedTokens.slice(start, start + EXPLORE_PAGE_SIZE);
  }, [addressLookupState, fullAddressQuery, isTextSearch, page, query, sortedTokens]);

  useEffect(() => {
    if (!onEnsureMetrics || displayTokens.length === 0) return;
    onEnsureMetrics(displayTokens.map((t) => t.address));
  }, [displayTokens, onEnsureMetrics]);

  useEffect(() => {
    if (!onEnsureCatalogSize || isTextSearch || fullAddressQuery) return;
    void onEnsureCatalogSize(page * EXPLORE_PAGE_SIZE);
  }, [fullAddressQuery, isTextSearch, onEnsureCatalogSize, page]);

  const pageList = buildPageList(page, totalPages);
  const showPagination = !isTextSearch && !fullAddressQuery && sortedTokens.length > EXPLORE_PAGE_SIZE;
  const openingToken =
    fullAddressQuery != null &&
    (loading || inCatalog || addressLookupState === 'loading');

  const goLaunch = () => {
    if (onNavigateToLaunch) onNavigateToLaunch();
    else navigateToAppTab('launch');
  };

  if (loading) return <p className="muted">Loading tokens…</p>;
  if (error) return <p className="error">{error}</p>;

  if (openingToken && addressLookupState !== 'miss') {
    return (
      <div className="lp-fade-in">
        <div className="explore-toolbar">
          <input
            className="lp-input explore-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or contract address"
          />
          <ExploreToolbarActions onLaunch={goLaunch} />
        </div>
        <p className="muted">Opening token page…</p>
      </div>
    );
  }

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
            onClick={() => {
              setSort('mcap');
              setPage(1);
            }}
          >
            Market cap
          </button>
          <button
            type="button"
            className={`explore-sort-btn${sort === 'launch' ? ' is-active' : ''}`}
            aria-pressed={sort === 'launch'}
            onClick={() => {
              setSort('launch');
              setPage(1);
            }}
          >
            Newest
          </button>
        </div>
        <ExploreToolbarActions onLaunch={goLaunch} />
        {sortedTokens.length > 0 ? (
          <p className="explore-count muted">
            {sortedTokens.length} token{sortedTokens.length === 1 ? '' : 's'}
            {showPagination ? ` · page ${page} of ${totalPages}` : ''}
            {loadingMetrics ? ' · updating market data…' : ''}
          </p>
        ) : null}
      </div>

      {addressLookupState === 'loading' ? (
        <p className="muted" style={{ marginBottom: '1rem' }}>
          Looking up contract…
        </p>
      ) : null}

      {displayTokens.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden>
            🔍
          </div>
          <p className="empty-state-title">
            {catalog.length === 0
              ? 'No tokens launched yet'
              : addressLookupState === 'miss'
                ? 'Token not in hood.markets catalog'
                : 'No tokens match your search'}
          </p>
          <p className="muted empty-state-sub">
            {catalog.length === 0
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
            {displayTokens.map((t, i) => (
              <ExploreRow
                key={t.address}
                token={t}
                metrics={metricsByAddress[t.address]}
                imagePriority={i < 6}
              />
            ))}
          </ul>
          {showPagination ? (
            <nav className="explore-pagination" aria-label="Explore pages">
              <button
                type="button"
                className="explore-page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              {pageList.map((item, i) =>
                item === 'gap' ? (
                  <span key={`gap-${i}`} className="explore-page-gap" aria-hidden>
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={`explore-page-btn${item === page ? ' is-active' : ''}`}
                    aria-current={item === page ? 'page' : undefined}
                    onClick={() => setPage(item)}
                  >
                    {item}
                  </button>
                ),
              )}
              <button
                type="button"
                className="explore-page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </nav>
          ) : null}
        </div>
      )}
    </div>
  );
}
