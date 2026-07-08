import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchExplorePage,
  fetchExploreStats,
  type ExploreFeedItem,
  type ExploreFilter,
  type ExplorePlatformStats,
  type ExploreSort,
} from '../api';

export const EXPLORE_PAGE_SIZE = 12;
const POLL_MS = 45_000;

export function useExploreTokens(
  enabled: boolean,
  options: {
    sort: ExploreSort;
    filter: ExploreFilter;
    page: number;
    query: string;
    minLiquidityUsd?: number;
  },
) {
  const [items, setItems] = useState<ExploreFeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [platformStats, setPlatformStats] = useState<ExplorePlatformStats | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const offset = (options.page - 1) * EXPLORE_PAGE_SIZE;
      const [feed, stats] = await Promise.all([
        fetchExplorePage({
          sort: options.sort,
          filter: options.filter,
          q: options.query.trim() || undefined,
          limit: EXPLORE_PAGE_SIZE,
          offset,
          minLiquidityUsd: options.minLiquidityUsd,
        }),
        fetchExploreStats(),
      ]);
      if (requestId !== requestIdRef.current) return;
      setItems(feed.tokens);
      setTotal(feed.total);
      setPlatformStats(stats);
      setError(null);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load tokens');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [
    enabled,
    options.filter,
    options.minLiquidityUsd,
    options.page,
    options.query,
    options.sort,
  ]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, load]);

  return { items, total, platformStats, loading, error, refresh: load };
}
