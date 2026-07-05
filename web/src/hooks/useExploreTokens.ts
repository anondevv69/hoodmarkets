import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDeploymentsPage, type Deployment } from '../api';
import {
  fetchTokenMetricsFromDexscreener,
  type DexTokenMetrics,
} from '../lib/dexscreenerVolume';
import { toExploreTokens, type ExploreToken } from '../lib/exploreTokens';

const POLL_MS = 30_000;
const CATALOG_BATCH = 100;
const INITIAL_CATALOG = 80;

export const EXPLORE_PAGE_SIZE = 20;

async function loadFullCatalog(): Promise<Deployment[]> {
  const first = await fetchDeploymentsPage(INITIAL_CATALOG, 0);
  const rows = [...first.deployments];
  const total = first.total ?? rows.length;
  while (rows.length < total) {
    const batch = await fetchDeploymentsPage(CATALOG_BATCH, rows.length);
    rows.push(...batch.deployments);
    if (batch.deployments.length === 0) break;
  }
  return rows;
}

export function useExploreTokens(enabled: boolean) {
  const [catalog, setCatalog] = useState<Deployment[]>([]);
  const [metricsByAddress, setMetricsByAddress] = useState<
    Record<string, DexTokenMetrics | undefined>
  >({});
  const [loading, setLoading] = useState(enabled);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const metricsRef = useRef(metricsByAddress);
  const metricsInflightRef = useRef<Set<string>>(new Set());
  metricsRef.current = metricsByAddress;

  const ensureMetrics = useCallback(async (addresses: string[]) => {
    const missing = addresses.filter((a) => {
      const key = a.toLowerCase();
      return !(key in metricsRef.current) && !metricsInflightRef.current.has(key);
    });
    if (missing.length === 0) return;

    for (const a of missing) metricsInflightRef.current.add(a.toLowerCase());
    setLoadingMetrics(true);
    try {
      const metrics = await fetchTokenMetricsFromDexscreener(missing);
      setMetricsByAddress((prev) => ({ ...prev, ...metrics }));
    } finally {
      for (const a of missing) metricsInflightRef.current.delete(a.toLowerCase());
      setLoadingMetrics(false);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    if (!enabled) return;
    try {
      const first = await fetchDeploymentsPage(INITIAL_CATALOG, 0);
      setCatalog(first.deployments);
      setError(null);
      setLoading(false);

      const total = first.total ?? first.deployments.length;
      if (first.deployments.length < total) {
        void (async () => {
          const rows = [...first.deployments];
          while (rows.length < total) {
            const batch = await fetchDeploymentsPage(CATALOG_BATCH, rows.length);
            rows.push(...batch.deployments);
            if (batch.deployments.length === 0) break;
            setCatalog([...rows]);
          }
        })();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tokens');
      setLoading(false);
    }
  }, [enabled]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const rows = await loadFullCatalog();
      setCatalog(rows);
      setError(null);
    } catch {
      /* keep existing list on background refresh failure */
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadCatalog();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, loadCatalog, refresh]);

  const tokens: ExploreToken[] = toExploreTokens(catalog, metricsByAddress);

  return {
    catalog,
    tokens,
    metricsByAddress,
    loading,
    loadingMetrics,
    error,
    refresh,
    ensureMetrics,
  };
}
