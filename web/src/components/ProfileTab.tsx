import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { fetchMyDeployments, type Deployment } from '../api';
import { shortenAddress } from '../chain';
import { TokenCard } from './TokenCard';
import {
  fetchTokenMetricsFromDexscreener,
  type DexTokenMetrics,
} from '../lib/dexscreenerVolume';

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

  if (!ready) return <p className="muted">Loading…</p>;

  if (!authenticated) {
    return (
      <div className="empty">
        <p>Sign in to see tokens you launched.</p>
        <button type="button" className="btn btn-primary" onClick={login} style={{ marginTop: '1rem' }}>
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div className="muted" style={{ fontSize: '0.85rem' }}>
          {walletAddress ? shortenAddress(walletAddress) : 'Wallet connecting…'}
        </div>
        <button type="button" className="btn btn-ghost" onClick={logout}>
          Sign out
        </button>
      </div>

      {loading && <p className="muted">Loading your tokens…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && tokens.length === 0 && (
        <div className="empty">You haven&apos;t launched any tokens yet.</div>
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
