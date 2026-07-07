import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWebAuth } from '../auth/WebAuthContext';
import { fetchMyDeployerProfile, type Deployment } from '../api';
import { shortenAddress } from '../chain';
import { formatUsdVol } from '../lib/dexscreenerVolume';
import {
  fetchTokenMetricsFromDexscreener,
  type DexTokenMetrics,
} from '../lib/dexscreenerVolume';
import { openDeployerProfile } from '../lib/deployerProfileRoute';
import { navigateToAppTab } from '../lib/tokenRoute';
import { xProfileUrl } from '../lib/requesterXDisplay';
import { TokenCard } from './TokenCard';
import { ProfileBankrLink } from './ProfileBankrLink';

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value lp-display">{value}</div>
    </div>
  );
}

function goLaunch() {
  navigateToAppTab('launch');
}

export function ProfileTab() {
  const { ready, authenticated, connectWallet, logout, getAccessToken, walletAddress } =
    useWebAuth();
  const [tokens, setTokens] = useState<Deployment[]>([]);
  const [totalLaunchCount, setTotalLaunchCount] = useState(0);
  const [xLaunchCount, setXLaunchCount] = useState(0);
  const [linkedX, setLinkedX] = useState<string | null>(null);
  const [bankrLaunchCount, setBankrLaunchCount] = useState(0);
  const [bankrLinked, setBankrLinked] = useState(false);
  const [bankrWallet, setBankrWallet] = useState<string | null>(null);
  const [walletLaunchCount, setWalletLaunchCount] = useState(0);
  const [metricsByAddress, setMetricsByAddress] = useState<
    Record<string, DexTokenMetrics | undefined>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) throw new Error('Not signed in');
    const profile = await fetchMyDeployerProfile(token, walletAddress ?? undefined);
    setTokens(profile.deployments);
    setTotalLaunchCount(profile.totalLaunchCount);
    setXLaunchCount(profile.xLaunchCount);
    setLinkedX(profile.xUsername);
    setBankrLaunchCount(profile.bankrLaunchCount);
    setBankrLinked(profile.bankrLinked);
    setBankrWallet(profile.bankrWallet);
    setWalletLaunchCount(profile.walletLaunchCount);
    const addresses = profile.deployments.map((r) => r.tokenAddress);
    if (addresses.length > 0) {
      const metrics = await fetchTokenMetricsFromDexscreener(addresses);
      setMetricsByAddress(metrics);
    } else {
      setMetricsByAddress({});
    }
  }, [getAccessToken, walletAddress]);

  useEffect(() => {
    if (!authenticated) {
      setTokens([]);
      setTotalLaunchCount(0);
      setXLaunchCount(0);
      setLinkedX(null);
      setBankrLaunchCount(0);
      setBankrLinked(false);
      setBankrWallet(null);
      setWalletLaunchCount(0);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadProfile();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authenticated, loadProfile]);

  const combinedMcap = useMemo(() => {
    let sum = 0;
    for (const t of tokens) {
      const m = metricsByAddress[t.tokenAddress];
      const mc = m?.marketCapUsd ?? m?.fdvUsd;
      if (mc && mc > 0) sum += mc;
    }
    return sum;
  }, [tokens, metricsByAddress]);

  if (!ready) return <p className="muted">Loading…</p>;

  if (!authenticated) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" aria-hidden>
          👤
        </div>
        <p className="empty-state-title">Connect to see your launches</p>
        <p className="muted empty-state-sub">
          Your deployed tokens and fee wallets appear here after you connect a wallet or sign in
          with Bankr.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={connectWallet}
          style={{ marginTop: '1rem' }}
        >
          Connect wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="profile-toolbar">
        <div className="muted" style={{ fontSize: '0.85rem' }}>
          {walletAddress ? shortenAddress(walletAddress) : 'Wallet connecting…'}
        </div>
        <button type="button" className="btn btn-ghost" onClick={logout}>
          Sign out
        </button>
      </div>

      {linkedX ? (
        <div className="lp-card profile-linked-account">
          <p className="section-label">X account</p>
          <div className="profile-x-linked">
            <a href={xProfileUrl(linkedX)} target="_blank" rel="noreferrer" className="lp-display">
              @{linkedX}
            </a>
            <p className="muted token-fee-note">
              {xLaunchCount === 1
                ? '1 launch on hood.markets attributed to this X handle'
                : `${xLaunchCount} launches on hood.markets attributed to this X handle`}
            </p>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => openDeployerProfile(linkedX)}
            >
              View public profile
            </button>
          </div>
        </div>
      ) : null}

      <ProfileBankrLink
        profile={{ bankrLinked, bankrWallet, bankrLaunchCount }}
        onUpdated={loadProfile}
      />

      {totalLaunchCount > 0 || walletLaunchCount > 0 ? (
        <div className="profile-stats">
          <StatCard label="Tokens launched" value={String(totalLaunchCount)} />
          {linkedX && xLaunchCount !== totalLaunchCount ? (
            <StatCard label="Via website wallet" value={String(walletLaunchCount)} />
          ) : null}
          <StatCard
            label="Combined market cap"
            value={combinedMcap > 0 ? formatUsdVol(combinedMcap) : '—'}
          />
        </div>
      ) : null}

      {loading && <p className="muted">Loading your tokens…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && tokens.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden>
            🚀
          </div>
          <p className="empty-state-title">You haven&apos;t launched any tokens yet</p>
          <p className="muted empty-state-sub">Deploy your first token in under a minute.</p>
          <button type="button" className="btn btn-primary" onClick={goLaunch} style={{ marginTop: '1rem' }}>
            Launch a token
          </button>
        </div>
      )}

      {!loading && tokens.length > 0 && (
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
