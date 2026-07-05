import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDeploymentsPage, type Deployment } from '../api';
import {
  fetchTokenMetricsFromDexscreener,
  type DexTokenMetrics,
} from '../lib/dexscreenerVolume';
import { toExploreTokens, type ExploreToken } from '../lib/exploreTokens';

const POLL_MS = 30_000;
const CATALOG_BATCH = 50;
/** First paint: one explore page + small buffer — avoids loading dozens of logo URLs at once. */
const INITIAL_CATALOG = 24;

export const EXPLORE_PAGE_SIZE = 20;

async function loadFullCatalog(): Promise<Deployment[]> {
  const first = await fetchDeploymentsPage(CATALOG_BATCH, 0);
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
  const catalogTotalRef = useRef(0);
  const catalogOffsetRef = useRef(0);
  const catalogInflightRef = useRef(false);
  metricsRef.current = metricsByAddress;

  const appendCatalog = useCallback(async (): Promise<number> => {
    while (catalogInflightRef.current) {
      await new Promise((r) => window.setTimeout(r, 40));
    }
    catalogInflightRef.current = true;
    try {
      const offset = catalogOffsetRef.current;
      const batch = await fetchDeploymentsPage(CATALOG_BATCH, offset);
      catalogTotalRef.current = batch.total ?? catalogTotalRef.current;
      if (batch.deployments.length === 0) return 0;
      catalogOffsetRef.current = offset + batch.deployments.length;
      setCatalog((prev) => [...prev, ...batch.deployments]);
      return batch.deployments.length;
    } finally {
      catalogInflightRef.current = false;
    }
  }, []);

  const ensureCatalogSize = useCallback(
    async (minCount: number) => {
      if (!enabled) return;
      const total = catalogTotalRef.current;
      while (catalogOffsetRef.current < minCount && catalogOffsetRef.current < total) {
        const added = await appendCatalog();
        if (added === 0) break;
      }
    },
    [appendCatalog, enabled],
  );

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
      catalogTotalRef.current = first.total ?? first.deployments.length;
      catalogOffsetRef.current = first.deployments.length;
      setCatalog(first.deployments);
      setError(null);
      setLoading(false);

      const total = catalogTotalRef.current;
      if (first.deployments.length < total) {
        const schedule =
          typeof requestIdleCallback === 'function'
            ? (fn: () => void) => requestIdleCallback(fn, { timeout: 8000 })
            : (fn: () => void) => window.setTimeout(fn, 2000);
        schedule(() => {
          void (async () => {
            while (catalogOffsetRef.current < total) {
              const added = await appendCatalog();
              if (added === 0) break;
            }
          })();
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tokens');
      setLoading(false);
    }
  }, [appendCatalog, enabled]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const rows = await loadFullCatalog();
      catalogOffsetRef.current = rows.length;
      catalogTotalRef.current = rows.length;
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
    ensureCatalogSize,
  };
}
