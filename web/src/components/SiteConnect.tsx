import { useState } from 'react';
import { shortenAddress } from '../chain';
import { useWebAuth } from '../auth/WebAuthContext';

export function SiteConnect() {
  const {
    ready,
    authenticated,
    walletAddress,
    authMethod,
    connectWallet,
    loginWithBankr,
    logout,
    authError,
    clearAuthError,
  } = useWebAuth();
  const [bankrOpen, setBankrOpen] = useState(false);
  const [bankrKey, setBankrKey] = useState('');
  const [bankrBusy, setBankrBusy] = useState(false);
  const [bankrError, setBankrError] = useState<string | null>(null);

  if (!ready) return null;

  if (authenticated && walletAddress) {
    return (
      <div className="site-connect">
        <span className="site-connect-addr" title={walletAddress}>
          {authMethod === 'bankr' ? 'Bankr ' : ''}
          {shortenAddress(walletAddress)}
        </span>
        <button type="button" className="btn btn-ghost site-connect-btn" onClick={logout}>
          Sign out
        </button>
      </div>
    );
  }

  async function submitBankr(e: React.FormEvent) {
    e.preventDefault();
    setBankrBusy(true);
    setBankrError(null);
    clearAuthError();
    try {
      await loginWithBankr(bankrKey);
      setBankrOpen(false);
      setBankrKey('');
    } catch (err) {
      setBankrError(err instanceof Error ? err.message : 'Bankr login failed.');
    } finally {
      setBankrBusy(false);
    }
  }

  return (
    <div className="site-connect">
      <button type="button" className="btn btn-primary site-connect-btn" onClick={connectWallet}>
        Connect wallet
      </button>
      <button
        type="button"
        className="btn btn-ghost site-connect-btn"
        onClick={() => {
          setBankrOpen((v) => !v);
          setBankrError(null);
          clearAuthError();
        }}
      >
        Bankr
      </button>
      {(authError || bankrError) && (
        <p className="site-connect-error" role="alert">
          {bankrError || authError}
        </p>
      )}
      {bankrOpen ? (
        <form className="bankr-login-panel" onSubmit={submitBankr}>
          <p className="muted bankr-login-copy">
            Paste your Bankr API key (<code>bk_…</code>). Used only to sign in — not stored on our
            servers. Create one at{' '}
            <a href="https://bankr.bot/api" target="_blank" rel="noopener noreferrer">
              bankr.bot/api
            </a>{' '}
            (read-write).
          </p>
          <input
            type="password"
            className="input"
            placeholder="bk_…"
            value={bankrKey}
            onChange={(e) => setBankrKey(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary" disabled={bankrBusy || !bankrKey.trim()}>
            {bankrBusy ? 'Signing in…' : 'Sign in with Bankr'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
