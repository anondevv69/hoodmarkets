import { useMemo, useState } from 'react';
import { categorizeTokenSets, type ExploreToken } from '../lib/exploreTokens';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'hot', label: '🔥 Hot' },
  { id: 'trending', label: '📈 Trending' },
  { id: 'new', label: '🆕 New' },
] as const;

export type ExploreFilterId = (typeof FILTERS)[number]['id'];

export function useTokenFilter(tokens: ExploreToken[], defaultFilter: ExploreFilterId = 'all') {
  const [filter, setFilter] = useState<ExploreFilterId>(defaultFilter);

  const categorized = useMemo(() => categorizeTokenSets(tokens), [tokens]);

  const counts = {
    all: tokens.length,
    hot: categorized.hotSet.size,
    trending: categorized.trendingSet.size,
    new: categorized.newSet.size,
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return tokens;
    if (filter === 'hot') return tokens.filter((t) => categorized.hotSet.has(t.address));
    if (filter === 'trending') return tokens.filter((t) => categorized.trendingSet.has(t.address));
    if (filter === 'new') return tokens.filter((t) => categorized.newSet.has(t.address));
    return tokens;
  }, [tokens, filter, categorized]);

  return { filter, setFilter, filtered, counts };
}

export function FilterChips({
  filter,
  setFilter,
  counts = {},
}: {
  filter: ExploreFilterId;
  setFilter: (id: ExploreFilterId) => void;
  counts?: Partial<Record<ExploreFilterId, number>>;
}) {
  return (
    <div className="filter-chips" role="tablist" aria-label="Filter tokens">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          role="tab"
          aria-selected={filter === f.id}
          onClick={() => setFilter(f.id)}
          className={`filter-chip ${filter === f.id ? 'filter-chip--active' : ''}`}
        >
          {f.label}
          <span className="filter-chip__count">{counts[f.id] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
