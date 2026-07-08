import { useEffect, useMemo, useState } from 'react';
import { fetchMyDeployerProfile, fetchWalletProfile, type Deployment } from '../api';
import { addressUrl, shortenAddress } from '../chain';
import {
  fetchTokenMetricsFromDexscreener,
  formatUsdVol,
  type DexTokenMetrics,
} from '../lib/dexscreenerVolume';
import { closeDeployerProfile } from '../lib/deployerProfileRoute';
import { useWebAuth } from '../auth/WebAuthContext';
import { TokenCard } from './TokenCard';
import { ProfileBankrLink } from './ProfileBankrLink';
import { ProfileXLink } from './ProfileXLink';
import {
  ProfileLinkedAccountsSummary,
  type LinkedAccountsSummary,
} from './ProfileLinkedAccountsSummary';

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
            variant="profile"
          />
        ))}
      </ul>
    </section>
  );
}

export function WalletProfilePage({ walletAddress }: { walletAddress: string }) {
  const { authenticated, walletAddress: sessionWallet, logout, getAccessToken } = useWebAuth();
  const isOwnProfile =
    authenticated && sessionWallet?.toLowerCase() === walletAddress.trim().toLowerCase();
  const [feeRecipientTokens, setFeeRecipientTokens] = useState<Deployment[]>([]);
  const [initiatedTokens, setInitiatedTokens] = useState<Deployment[]>([]);
  const [feeRecipientTokenCount, setFeeRecipientTokenCount] = useState(0);
  const [initiatedLaunchCount, setInitiatedLaunchCount] = useState(0);
  const [metricsByAddress, setMetricsByAddress] = useState<
    Record<string, DexTokenMetrics | undefined>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankrProfile, setBankrProfile] = useState<{
    bankrLinked: boolean;
    bankrWallet: string | null;
    bankrLaunchCount: number;
  } | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccountsSummary | null>(null);

  const reloadBankr = async () => {
    if (!isOwnProfile) return;
    const token = await getAccessToken();
    if (!token) return;
    const profile = await fetchMyDeployerProfile(token, walletAddress);
    setBankrProfile({
      bankrLinked: profile.bankrLinked,
      bankrWallet: profile.bankrWallet,
      bankrLaunchCount: profile.bankrLaunchCount,
    });
    if (profile.linkedAccounts) {
      setLinkedAccounts(profile.linkedAccounts);
    } else {
      setLinkedAccounts({
        xHandle: profile.xHandle ?? profile.xUsername,
        xLinked: profile.xLinked,
        bankrWallet: profile.bankrWallet,
        bankrLinked: profile.bankrLinked,
        bankrVerified: profile.bankrVerified,
      });
    }
  };

  useEffect(() => {
    if (!isOwnProfile) {
      setBankrProfile(null);
      return;
    }
    void reloadBankr().catch(() => setBankrProfile(null));
  }, [isOwnProfile, walletAddress]);

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
        setLinkedAccounts(
          profile.linkedAccounts ?? {
            xHandle: profile.xHandle ?? null,
            xLinked: profile.xLinked ?? false,
            bankrWallet: profile.bankrWallet ?? null,
            bankrLinked: profile.bankrLinked ?? false,
            bankrVerified: profile.bankrLinked ?? false,
          },
        );
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
      {isOwnProfile ? (
        <div className="profile-toolbar">
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            {shortenAddress(walletAddress)}
          </div>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      ) : null}

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

      {linkedAccounts ? (
        <div className="lp-card">
          <ProfileLinkedAccountsSummary accounts={linkedAccounts} />
        </div>
      ) : null}

      {isOwnProfile && bankrProfile ? (
        <ProfileBankrLink profile={bankrProfile} onUpdated={reloadBankr} />
      ) : null}

      {isOwnProfile ? (
        <ProfileXLink xHandle={linkedAccounts?.xHandle ?? null} onUpdated={reloadBankr} />
      ) : null}

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
