import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useState } from 'react';
import { shortenAddress } from '../chain';
import { useWebAuth } from '../auth/WebAuthContext';
import { navigateToAppTab } from '../lib/tokenRoute';

export function SiteConnect() {
  const {
    ready,
    authenticated,
    walletAddress,
    authMethod,
    loginWithBankr,
    logout,
    authError,
    clearAuthError,
  } = useWebAuth();
  const [bankrOpen, setBankrOpen] = useState(false);
  const [bankrKey, setBankrKey] = useState('');
  const [bankrBusy, setBankrBusy] = useState(false);
  const [bankrError, setBankrError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  if (!ready) return null;

  if (authenticated && walletAddress) {
    return (
      <div className="site-connect">
        <button
          type="button"
          className="site-connect-addr site-connect-profile-btn"
          title={`${walletAddress} — view profile`}
          onClick={() => navigateToAppTab('profile')}
        >
          {authMethod === 'bankr' ? 'Bankr · ' : ''}
          {shortenAddress(walletAddress)}
        </button>
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
      <ConnectButton.Custom>
        {({ openConnectModal, mounted }) => (
          <button
            type="button"
            className="btn btn-primary site-connect-btn"
            disabled={!mounted}
            onClick={() => {
              setConnectError(null);
              setBankrError(null);
              clearAuthError();
              if (openConnectModal) {
                openConnectModal();
              } else {
                setConnectError('Wallet connect is unavailable. Refresh and try again.');
              }
            }}
          >
            Connect wallet
          </button>
        )}
      </ConnectButton.Custom>
      <button
        type="button"
        className="btn btn-ghost site-connect-btn"
        onClick={() => {
          setBankrOpen((v) => !v);
          setBankrError(null);
          setConnectError(null);
          clearAuthError();
        }}
      >
        Bankr
      </button>
      {(authError || bankrError || connectError) && (
        <p className="site-connect-error" role="alert">
          {bankrError || connectError || authError}
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
            className="lp-input"
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
