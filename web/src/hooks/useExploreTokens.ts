import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDeployments, type Deployment } from '../api';
import {
  fetchTokenMetricsFromDexscreener,
  type DexTokenMetrics,
} from '../lib/dexscreenerVolume';
import { toExploreTokens, type ExploreToken } from '../lib/exploreTokens';

const POLL_MS = 30_000;
export const EXPLORE_PAGE_SIZE = 100;

export function useExploreTokens(enabled: boolean) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [metricsByAddress, setMetricsByAddress] = useState<
    Record<string, DexTokenMetrics | undefined>
  >({});
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedCountRef = useRef(0);

  const applyPage = useCallback(
    async (rows: Deployment[], append: boolean) => {
      const addresses = rows.map((r) => r.tokenAddress);
      const metrics =
        addresses.length > 0 ? await fetchTokenMetricsFromDexscreener(addresses) : {};

      setDeployments((prev) => (append ? [...prev, ...rows] : rows));
      setMetricsByAddress((prev) => ({ ...prev, ...metrics }));
      setHasMore(rows.length === EXPLORE_PAGE_SIZE);
      loadedCountRef.current = append ? loadedCountRef.current + rows.length : rows.length;
    },
    [],
  );

  const loadInitial = useCallback(async () => {
    if (!enabled) return;
    try {
      const rows = await fetchDeployments(EXPLORE_PAGE_SIZE, 0);
      await applyPage(rows, false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  }, [applyPage, enabled]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const limit = Math.max(loadedCountRef.current, EXPLORE_PAGE_SIZE);
    try {
      const rows = await fetchDeployments(limit, 0);
      await applyPage(rows, false);
      setError(null);
    } catch {
      /* keep existing list on background refresh failure */
    }
  }, [applyPage, enabled]);

  const loadMore = useCallback(async () => {
    if (!enabled || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const rows = await fetchDeployments(EXPLORE_PAGE_SIZE, loadedCountRef.current);
      await applyPage(rows, true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more tokens');
    } finally {
      setLoadingMore(false);
    }
  }, [applyPage, enabled, hasMore, loadingMore]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadedCountRef.current = 0;
    void loadInitial();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, loadInitial, refresh]);

  const tokens: ExploreToken[] = toExploreTokens(deployments, metricsByAddress);

  return {
    tokens,
    deployments,
    metricsByAddress,
    loading,
    loadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
  };
}
