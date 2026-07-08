import { shortenAddress } from '../chain';
import { useWebAuth } from '../auth/WebAuthContext';
import { navigateToMyProfile } from '../lib/deployerProfileRoute';

export function SiteConnect() {
  const {
    ready,
    authenticated,
    signingIn,
    walletAddress,
    connectWallet,
    logout,
    authError,
    clearAuthError,
  } = useWebAuth();

  if (!ready) return null;

  if (authenticated && walletAddress) {
    return (
      <div className="site-connect">
        <button
          type="button"
          className="site-connect-addr site-connect-profile-btn"
          title={`${walletAddress} — view profile`}
          onClick={() => navigateToMyProfile(walletAddress)}
        >
          {shortenAddress(walletAddress)}
        </button>
        <button type="button" className="btn btn-ghost site-connect-btn" onClick={logout}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="site-connect">
      <button
        type="button"
        className="btn btn-primary site-connect-btn"
        onClick={() => {
          clearAuthError();
          connectWallet();
        }}
        disabled={signingIn}
      >
        {signingIn ? 'Signing in…' : 'Connect wallet'}
      </button>
      {authError ? (
        <p className="site-connect-error" role="alert">
          {authError}
        </p>
      ) : null}
    </div>
  );
}
