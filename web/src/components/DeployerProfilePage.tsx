import { useEffect, useMemo, useState } from 'react';
import { fetchDeployerProfileByX, type Deployment } from '../api';
import {
  fetchTokenMetricsFromDexscreener,
  formatUsdVol,
  type DexTokenMetrics,
} from '../lib/dexscreenerVolume';
import { xProfileUrl } from '../lib/requesterXDisplay';
import { closeDeployerProfile } from '../lib/deployerProfileRoute';
import { TokenCard } from './TokenCard';

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value lp-display">{value}</div>
    </div>
  );
}

export function DeployerProfilePage({ username }: { username: string }) {
  const [tokens, setTokens] = useState<Deployment[]>([]);
  const [launchCount, setLaunchCount] = useState(0);
  const [metricsByAddress, setMetricsByAddress] = useState<
    Record<string, DexTokenMetrics | undefined>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handle = username.trim().replace(/^@/, '').toLowerCase();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const profile = await fetchDeployerProfileByX(handle);
        if (cancelled) return;
        setTokens(profile.deployments);
        setLaunchCount(profile.launchCount);
        const addresses = profile.deployments.map((r) => r.tokenAddress);
        if (addresses.length > 0) {
          const metrics = await fetchTokenMetricsFromDexscreener(addresses);
          if (!cancelled) setMetricsByAddress(metrics);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const combinedMcap = useMemo(() => {
    let sum = 0;
    for (const t of tokens) {
      const m = metricsByAddress[t.tokenAddress];
      const mc = m?.marketCapUsd ?? m?.fdvUsd;
      if (mc && mc > 0) sum += mc;
    }
    return sum;
  }, [tokens, metricsByAddress]);

  if (loading) return <p className="muted">Loading profile…</p>;
  if (error) {
    return (
      <div>
        <button type="button" className="btn btn-ghost" onClick={closeDeployerProfile}>
          ← Back
        </button>
        <p className="error" style={{ marginTop: '1rem' }}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="deployer-profile-page">
      <div className="lp-card deployer-profile-hero">
        <p className="section-label">Deployer profile</p>
        <h2 className="lp-display deployer-profile-handle">
          <a href={xProfileUrl(handle)} target="_blank" rel="noreferrer">
            @{handle}
          </a>
        </h2>
        <p className="muted deployer-profile-subtitle">Tokens launched on hood.markets</p>
      </div>

      <div className="profile-stats">
        <StatCard label="Tokens launched" value={String(launchCount)} />
        <StatCard
          label="Combined market cap"
          value={combinedMcap > 0 ? formatUsdVol(combinedMcap) : '—'}
        />
      </div>

      {tokens.length === 0 ? (
        <p className="muted">No launches found for this X account yet.</p>
      ) : (
        <ul className="token-list">
          {tokens.map((t) => (
            <TokenCard
              key={t.tokenAddress}
              deployment={t}
              metrics={metricsByAddress[t.tokenAddress]}
              showDeployer={false}
              variant="profile"
            />
          ))}
        </ul>
      )}
    </div>
  );
}
