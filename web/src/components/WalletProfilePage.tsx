import { useEffect, useMemo, useState } from 'react';
import { fetchWalletProfile, type Deployment } from '../api';
import { addressUrl, shortenAddress } from '../chain';
import {
  fetchTokenMetricsFromDexscreener,
  formatUsdVol,
  type DexTokenMetrics,
} from '../lib/dexscreenerVolume';
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

function TokenSection({
  title,
  tokens,
  metricsByAddress,
}: {
  title: string;
  tokens: Deployment[];
  metricsByAddress: Record<string, DexTokenMetrics | undefined>;
}) {
  if (tokens.length === 0) return null;
  return (
    <section className="profile-token-section">
      <h3 className="profile-section-title">{title}</h3>
      <ul className="token-list profile-token-list">
        {tokens.map((t) => (
          <TokenCard
            key={t.tokenAddress}
            deployment={t}
            metrics={metricsByAddress[t.tokenAddress]}
            showDeployer={false}
          />
        ))}
      </ul>
    </section>
  );
}

export function WalletProfilePage({ walletAddress }: { walletAddress: string }) {
  const [feeRecipientTokens, setFeeRecipientTokens] = useState<Deployment[]>([]);
  const [initiatedTokens, setInitiatedTokens] = useState<Deployment[]>([]);
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
        setFeeRecipientTokens(profile.deployments);
        setInitiatedTokens(profile.initiatedDeployments ?? []);
        setFeeRecipientTokenCount(profile.feeRecipientTokenCount);
        setInitiatedLaunchCount(profile.initiatedLaunchCount);
        const addresses = [
          ...new Set([
            ...profile.deployments.map((r) => r.tokenAddress),
            ...(profile.initiatedDeployments ?? []).map((r) => r.tokenAddress),
          ]),
        ];
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
    const seen = new Set<string>();
    for (const t of [...feeRecipientTokens, ...initiatedTokens]) {
      if (seen.has(t.tokenAddress)) continue;
      seen.add(t.tokenAddress);
      const m = metricsByAddress[t.tokenAddress];
      const mc = m?.marketCapUsd ?? m?.fdvUsd;
      if (mc && mc > 0) sum += mc;
    }
    return sum;
  }, [feeRecipientTokens, initiatedTokens, metricsByAddress]);

  const hasAnyTokens = feeRecipientTokens.length > 0 || initiatedTokens.length > 0;

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
        <h2 className="lp-display deployer-profile-handle mono">{shortenAddress(walletAddress)}</h2>
        <p className="muted deployer-profile-subtitle">
          {feeRecipientTokenCount > 0 && initiatedLaunchCount > 0
            ? 'Fee recipient and deployer on hood.markets'
            : initiatedLaunchCount > 0
              ? 'Launches initiated on hood.markets'
              : 'Fee recipient on hood.markets'}
        </p>
        <p className="deployer-profile-explorer">
          <a href={addressUrl(walletAddress)} target="_blank" rel="noreferrer">
            View on Blockscout
          </a>
        </p>
      </div>

      <div className="profile-stats">
        {initiatedLaunchCount > 0 ? (
          <StatCard label="Launches initiated" value={String(initiatedLaunchCount)} />
        ) : null}
        <StatCard label="Fee recipient tokens" value={String(feeRecipientTokenCount)} />
        <StatCard
          label="Combined market cap"
          value={combinedMcap > 0 ? formatUsdVol(combinedMcap) : '—'}
        />
      </div>

      {!hasAnyTokens ? (
        <p className="muted profile-empty-note">No tokens found for this wallet yet.</p>
      ) : (
        <>
          <TokenSection
            title="Launches initiated"
            tokens={initiatedTokens}
            metricsByAddress={metricsByAddress}
          />
          <TokenSection
            title="Fee recipient tokens"
            tokens={feeRecipientTokens}
            metricsByAddress={metricsByAddress}
          />
        </>
      )}
    </div>
  );
}
