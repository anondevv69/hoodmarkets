import { useCallback, useEffect, useState } from 'react';
import { useWebAuth } from '../auth/WebAuthContext';
import { useActiveWallet } from '../hooks/useActiveWallet';
import {
  fetchTokenDexBranding,
  importTokenDexBranding,
  type TokenDexBrandingResponse,
} from '../api';
import { shortenAddress } from '../chain';

export function TokenBrandingPanel({
  tokenAddress,
  onImported,
}: {
  tokenAddress: string;
  onImported?: () => void;
}) {
  const { authenticated, getAccessToken, connectWallet } = useWebAuth();
  const wallet = useActiveWallet();
  const walletAddress = wallet?.address;

  const [branding, setBranding] = useState<TokenDexBrandingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTokenDexBranding(tokenAddress, walletAddress);
      setBranding(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load branding.');
    } finally {
      setLoading(false);
    }
  }, [tokenAddress, walletAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onImport() {
    if (!walletAddress) {
      connectWallet();
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        connectWallet();
        return;
      }
      await importTokenDexBranding(token, tokenAddress, walletAddress);
      setMessage('DexScreener icon and banner imported to this token page.');
      await refresh();
      onImported?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !branding) return null;

  const { dex, admin, isAdmin } = branding;
  const canImport =
    dex.enhancedInfoPaid && isAdmin && !!(dex.iconUrl || dex.bannerUrl);

  return (
    <section className="tp-zone tp-branding-zone" aria-label="Token branding">
      <div className="tp-branding-head">
        <p className="tp-zone-label">Page admin</p>
        {dex.enhancedInfoPaid ? (
          <span className="tp-dex-paid-badge" title="DexScreener Enhanced Token Info">
            Dex paid ✓
          </span>
        ) : (
          <span className="tp-dex-unpaid-badge">Dex not paid</span>
        )}
      </div>

      <p className="muted tp-branding-admin-copy">
        Admin:{' '}
        <span className="lp-mono">{shortenAddress(admin.adminWallet)}</span>
        {admin.adminRole === 'top_share_holder' && admin.topShareCount
          ? ` · top holder (${admin.topShareCount} shares)`
          : admin.adminRole === 'deployer'
            ? ' · deployer'
            : ' · fee recipient'}
      </p>

      {canImport ? (
        <div className="tp-branding-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => void onImport()}
          >
            {busy ? 'Importing…' : 'Import DexScreener icon & banner'}
          </button>
          {!authenticated ? (
            <span className="muted">Sign in with the admin wallet to import.</span>
          ) : !isAdmin ? (
            <span className="muted">Connect the admin wallet to import.</span>
          ) : null}
        </div>
      ) : dex.enhancedInfoPaid && isAdmin ? (
        <p className="muted">Dex paid — waiting for DexScreener to publish icon/banner.</p>
      ) : null}

      {message ? <p className="tp-branding-ok">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
