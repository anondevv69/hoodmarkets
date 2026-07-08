import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fetchDeploymentByAddress, type ExploreFeedItem, type ExploreFilter, type ExploreSort } from '../api';
import { shortenAddress } from '../chain';
import { formatUsdVol } from '../lib/dexscreenerVolume';
import { extractContractAddressFromSearch, looksLikeAddressSearch } from '../lib/exploreSearch';
import { formatTickerAge } from '../lib/exploreTokens';
import { EXPLORE_PAGE_SIZE, useExploreTokens } from '../hooks/useExploreTokens';
import { navigateToAppTab, openTokenPage } from '../lib/tokenRoute';
import { buildTokenImageCandidates } from '../lib/tokenImageUrl';
import { resolveExploreTokenImageUrl } from '../lib/resolveTokenImage';

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

function ExploreCoinMedia({
  symbol,
  imageUrl,
  priority,
}: {
  symbol: string;
  imageUrl?: string;
  priority?: boolean;
}) {
  const candidates = useMemo(() => buildTokenImageCandidates(imageUrl), [imageUrl]);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(null);
    setFailed(false);
    if (!candidates.length) {
      setFailed(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      for (const url of candidates) {
        if (cancelled) return;
        try {
          await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = url;
          });
          if (!cancelled) {
            setSrc(url);
            return;
          }
        } catch {
          /* try next */
        }
      }
      if (!cancelled) setFailed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [candidates]);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="explore-coin-img"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        onError={() => {
          setSrc(null);
          setFailed(true);
        }}
      />
    );
  }

  return (
    <div className="explore-coin-placeholder" aria-hidden>
      {failed || !candidates.length ? 'no image' : symbol.slice(0, 2).toUpperCase()}
    </div>
  );
}

function ExploreCoinCard({
  item,
  imagePriority = false,
}: {
  item: ExploreFeedItem;
  imagePriority?: boolean;
}) {
  const d = item.deployment;
  const sym = d.tokenSymbol.replace(/^\$/, '');
  const age = formatTickerAge(d.createdAt);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | undefined>(d.tokenImageUrl);

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

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDetails();
    }
  }

  return (
    <li>
      <button
        type="button"
        className="explore-coin-card"
        onClick={openDetails}
        onKeyDown={onKeyDown}
        aria-label={`${d.tokenName} $${sym} — view token details`}
      >
        <div className="explore-coin-media">
          <ExploreCoinMedia symbol={sym} imageUrl={resolvedImageUrl} priority={imagePriority} />
          <ChangeSparkline changePct={change} />
          {item.stats.lastTradeAt ? (
            <span className="explore-coin-badge">Live</span>
          ) : null}
        </div>
        <div className="explore-coin-body">
          <div className="explore-coin-title-row">
            <span className="explore-coin-name lp-display">{d.tokenName}</span>
            <span className="explore-coin-age">
              <span className="explore-coin-age-dot" aria-hidden />
              {age}
            </span>
          </div>
          <div className="explore-coin-ticker">${sym}</div>
        </div>
      </button>
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

const SORT_OPTIONS: { id: ExploreSort; label: string }[] = [
  { id: 'lastTrade', label: 'Last trade' },
  { id: 'launch', label: 'New' },
  { id: 'volume', label: 'Top volume' },
  { id: 'mcap', label: 'Market cap' },
];

const FILTER_OPTIONS: { id: ExploreFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
];

export function TokensTab({ onNavigateToLaunch }: { onNavigateToLaunch?: () => void }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sort, setSort] = useState<ExploreSort>('mcap');
  const [filter, setFilter] = useState<ExploreFilter>('all');
  const [page, setPage] = useState(1);
  const [addressLookupState, setAddressLookupState] = useState<'idle' | 'loading' | 'miss'>('idle');
  const lastOpenedAddressRef = useRef<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [sort, filter, debouncedQuery]);

  const { items, total, platformStats, loading, error } = useExploreTokens(true, {
    sort,
    filter,
    page,
    query: debouncedQuery,
  });

  const fullAddressQuery = useMemo(() => extractContractAddressFromSearch(query), [query]);
  const isAddressSearch = Boolean(fullAddressQuery);
  const inFeed = useMemo(
    () =>
      fullAddressQuery
        ? items.some((i) => i.deployment.tokenAddress.toLowerCase() === fullAddressQuery)
        : false,
    [fullAddressQuery, items],
  );

  useLayoutEffect(() => {
    if (!fullAddressQuery || loading) return;
    if (lastOpenedAddressRef.current === fullAddressQuery) return;
    if (!inFeed) return;
    lastOpenedAddressRef.current = fullAddressQuery;
    openTokenPage(fullAddressQuery);
  }, [fullAddressQuery, inFeed, loading]);

  useEffect(() => {
    if (!fullAddressQuery) {
      setAddressLookupState('idle');
      lastOpenedAddressRef.current = null;
      return;
    }
    if (inFeed || loading) {
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
  }, [fullAddressQuery, inFeed, loading]);

  const totalPages = Math.max(1, Math.ceil(total / EXPLORE_PAGE_SIZE));
  const pageList = buildPageList(page, totalPages);
  const showPagination = !isAddressSearch && total > EXPLORE_PAGE_SIZE;
  const openingToken =
    fullAddressQuery != null && (loading || inFeed || addressLookupState === 'loading');

  const goLaunch = () => {
    if (onNavigateToLaunch) onNavigateToLaunch();
    else navigateToAppTab('launch');
  };

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
        <div className="explore-filter-row">
          {FILTER_OPTIONS.map((opt) => {
            const count =
              opt.id === 'all' && platformStats ? platformStats.tokensLaunched : null;
            return (
              <button
                key={opt.id}
                type="button"
                className={`explore-sort-btn${filter === opt.id ? ' is-active' : ''}`}
                aria-pressed={filter === opt.id}
                onClick={() => setFilter(opt.id)}
              >
                {opt.label}
                {count != null ? ` ${count}` : ''}
              </button>
            );
          })}
        </div>
        <div className="explore-sort" role="group" aria-label="Sort tokens">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`explore-sort-btn${sort === opt.id ? ' is-active' : ''}`}
              aria-pressed={sort === opt.id}
              onClick={() => setSort(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <ExploreToolbarActions onLaunch={goLaunch} />
        {platformStats ? (
          <p className="explore-count muted">
            {total} shown · {platformStats.tokensLaunched} launched ·{' '}
            {formatUsdVol(platformStats.volume24hUsd)} 24h vol
            {showPagination ? ` · page ${page} of ${totalPages}` : ''}
          </p>
        ) : null}
      </div>

      {loading && items.length === 0 ? <p className="muted">Loading tokens…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {addressLookupState === 'loading' ? (
        <p className="muted" style={{ marginBottom: '1rem' }}>
          Looking up contract…
        </p>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden>
            🔍
          </div>
          <p className="empty-state-title">
            {addressLookupState === 'miss'
              ? 'Token not in hood.markets catalog'
              : 'No tokens match your filters'}
          </p>
          <p className="muted empty-state-sub">
            {addressLookupState === 'miss'
              ? 'This contract may exist on-chain but was not launched through hood.markets.'
              : looksLikeAddressSearch(query)
                ? 'Paste the full 42-character contract address (0x + 40 hex digits).'
                : 'Try a different filter or search term.'}
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
        <div className="explore-grid-wrap">
          <ul className="explore-coin-grid">
            {items.map((item, i) => (
              <ExploreCoinCard
                key={item.deployment.tokenAddress}
                item={item}
                imagePriority={i < 16}
              />
            ))}
          </ul>
          {showPagination ? (
            <nav className="explore-pagination explore-pagination--grid" aria-label="Explore pages">
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
