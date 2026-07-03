import { useEffect, useMemo, useState } from 'react';
import { fetchWalletProfile, type Deployment } from '../api';
import { shortenAddress, tokenUrl } from '../chain';
import {
  fetchTokenMetricsFromDexscreener,
  formatUsdVol,
  type DexTokenMetrics,
} from '../lib/dexscreenerVolume';
import { closeDeployerProfile } from '../lib/deployerProfileRoute';
import { CopyButton } from './CopyButton';
import { TokenCard } from './TokenCard';

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value lp-display">{value}</div>
    </div>
  );
}

export function WalletProfilePage({ walletAddress }: { walletAddress: string }) {
  const [tokens, setTokens] = useState<Deployment[]>([]);
  const [feeRecipientTokenCount, setFeeRecipientTokenCount] = useState(0);
  const [initiatedLaunchCount, setInitiatedLaunchCount] = useState(0);
  const [metricsByAddress, setMetricsByAddress] = useState<
    Record<string, DexTokenMetrics | undefined>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const profile = await fetchWalletProfile(walletAddress);
        if (cancelled) return;
        setTokens(profile.deployments);
        setFeeRecipientTokenCount(profile.feeRecipientTokenCount);
        setInitiatedLaunchCount(profile.initiatedLaunchCount);
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
  }, [walletAddress]);

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
    <div className="deployer-profile-page lp-fade-in">
      <button type="button" className="btn btn-ghost token-page-back" onClick={closeDeployerProfile}>
        ← Explore
      </button>

      <div className="lp-card deployer-profile-hero">
        <p className="section-label">Wallet profile</p>
        <h2 className="lp-display deployer-profile-handle mono">
          <a href={tokenUrl(walletAddress)} target="_blank" rel="noreferrer">
            {shortenAddress(walletAddress)}
          </a>
          <CopyButton text={walletAddress} />
        </h2>
        <p className="muted">Fee recipient tokens on hood.markets</p>
      </div>

      <div className="profile-stats">
        <StatCard label="Fee recipient tokens" value={String(feeRecipientTokenCount)} />
        {initiatedLaunchCount > 0 ? (
          <StatCard label="Launches initiated" value={String(initiatedLaunchCount)} />
        ) : null}
        <StatCard
          label="Combined market cap"
          value={combinedMcap > 0 ? formatUsdVol(combinedMcap) : '—'}
        />
      </div>

      {tokens.length === 0 ? (
        <p className="muted">No tokens found for this wallet yet.</p>
      ) : (
        <ul className="token-list">
          {tokens.map((t) => (
            <TokenCard
              key={t.tokenAddress}
              deployment={t}
              metrics={metricsByAddress[t.tokenAddress]}
              showDeployer={false}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
