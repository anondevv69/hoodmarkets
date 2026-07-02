import { useCallback, useEffect, useState } from 'react';
import { fetchAllDeploymentsForExplore, type Deployment } from '../api';
import {
  fetchTokenMetricsFromDexscreener,
  type DexTokenMetrics,
} from '../lib/dexscreenerVolume';
import { toExploreTokens, type ExploreToken } from '../lib/exploreTokens';

const POLL_MS = 30_000;

export function useExploreTokens(enabled: boolean) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [metricsByAddress, setMetricsByAddress] = useState<
    Record<string, DexTokenMetrics | undefined>
  >({});
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [catalogTruncated, setCatalogTruncated] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const { deployments: rows, truncated } = await fetchAllDeploymentsForExplore();
      setDeployments(rows);
      setCatalogTruncated(truncated);
      const addresses = rows.map((r) => r.tokenAddress);
      if (addresses.length > 0) {
        const metrics = await fetchTokenMetricsFromDexscreener(addresses);
        setMetricsByAddress(metrics);
      } else {
        setMetricsByAddress({});
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, load]);

  const tokens: ExploreToken[] = toExploreTokens(deployments, metricsByAddress);

  return { tokens, deployments, metricsByAddress, loading, error, catalogTruncated, refresh: load };
}
