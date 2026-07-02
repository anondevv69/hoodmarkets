import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect, useMemo, useState } from 'react';
import { fetchMyDeployments, type Deployment } from '../api';
import { shortenAddress } from '../chain';
import { formatUsdVol } from '../lib/dexscreenerVolume';
import { TokenCard } from './TokenCard';
import {
  fetchTokenMetricsFromDexscreener,
  type DexTokenMetrics,
} from '../lib/dexscreenerVolume';

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value lp-display">{value}</div>
    </div>
  );
}

function goLaunch() {
  const url = new URL(window.location.href);
  url.searchParams.delete('token');
  url.searchParams.set('tab', 'launch');
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function ProfileTab() {
  const { ready, authenticated, login, logout, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const [tokens, setTokens] = useState<Deployment[]>([]);
  const [metricsByAddress, setMetricsByAddress] = useState<
    Record<string, DexTokenMetrics | undefined>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletAddress = wallets[0]?.address;

  useEffect(() => {
    if (!authenticated) {
      setTokens([]);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('Not signed in');
        const rows = await fetchMyDeployments(token, walletAddress);
        if (cancelled) return;
        setTokens(rows);
        const addresses = rows.map((r) => r.tokenAddress);
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
  }, [authenticated, getAccessToken, walletAddress]);

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
        <p className="empty-state-title">Sign in to see your launches</p>
        <p className="muted empty-state-sub">Your deployed tokens and fee wallets appear here.</p>
        <button type="button" className="btn btn-primary" onClick={login} style={{ marginTop: '1rem' }}>
          Sign in
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

      {tokens.length > 0 ? (
        <div className="profile-stats">
          <StatCard label="Tokens launched" value={String(tokens.length)} />
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
