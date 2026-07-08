import { useCallback, useState } from 'react';
import { useWebAuth } from '../auth/WebAuthContext';
import { startXLinkChallenge, unlinkXHandle, verifyXLink } from '../api';

export function ProfileXLink({
  xHandle,
  xVerified,
  onUpdated,
}: {
  xHandle: string | null;
  xVerified: boolean;
  onUpdated: () => Promise<void>;
}) {
  const { getAccessToken } = useWebAuth();
  const [inputHandle, setInputHandle] = useState('');
  const [challenge, setChallenge] = useState<{
    xHandle: string;
    verifyCode: string;
    verifyUrl: string;
    instructions: string[];
  } | null>(null);
  const [starting, setStarting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = useCallback(async (handleOverride?: string) => {
    const handle = (handleOverride ?? inputHandle).trim().replace(/^@/, '');
    if (!handle) {
      setError('Enter your X username.');
      return;
    }
    if (!/^[a-zA-Z0-9_]{1,50}$/.test(handle)) {
      setError('Enter a valid X username (letters, numbers, underscores only, max 50 chars).');
      return;
    }
    setError(null);
    setStarting(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      const res = await startXLinkChallenge(token, handle);
      setChallenge({
        xHandle: res.xHandle,
        verifyCode: res.verifyCode,
        verifyUrl: res.verifyUrl,
        instructions: res.instructions,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start verification.');
    } finally {
      setStarting(false);
    }
  }, [inputHandle, getAccessToken]);

  const handleVerify = useCallback(async () => {
    const handle = (challenge?.xHandle ?? xHandle ?? inputHandle).trim().replace(/^@/, '');
    if (!handle) return;
    setError(null);
    setVerifying(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      await verifyXLink(token, handle);
      setChallenge(null);
      setInputHandle('');
      await onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  }, [challenge?.xHandle, xHandle, inputHandle, getAccessToken, onUpdated]);

  const handleUnlink = useCallback(async () => {
    setError(null);
    setUnlinking(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      await unlinkXHandle(token);
      setChallenge(null);
      setInputHandle('');
      await onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not unlink X account.');
    } finally {
      setUnlinking(false);
    }
  }, [getAccessToken, onUpdated]);

  const activeHandle = xHandle ?? challenge?.xHandle ?? null;

  return (
    <div className="lp-card profile-linked-account">
      <p className="section-label">X account</p>
      {activeHandle && (xVerified || xHandle) ? (
        <div className="profile-x-linked">
          <div className="profile-x-linked-head">
            <a
              href={`https://x.com/${activeHandle}`}
              target="_blank"
              rel="noreferrer"
              className="lp-mono"
            >
              @{activeHandle}
            </a>
            {xVerified ? (
              <span className="profile-x-badge profile-x-badge--verified">Verified</span>
            ) : (
              <span className="profile-x-badge profile-x-badge--pending">Unverified</span>
            )}
          </div>
          <p className="muted token-fee-note">
            {xVerified
              ? `Launches from @${activeHandle} are attributed to your profile.`
              : `Complete verification to prove you control @${activeHandle}.`}
          </p>
          {!xVerified ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void handleStart(activeHandle)}
              disabled={starting}
            >
              {starting ? 'Preparing…' : 'Verify ownership'}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void handleUnlink()}
            disabled={unlinking}
            style={{ marginLeft: xVerified ? undefined : '0.35rem' }}
          >
            {unlinking ? 'Unlinking…' : 'Unlink'}
          </button>
        </div>
      ) : null}

      {challenge ? (
        <div className="profile-x-verify-steps">
          <p className="muted token-fee-note">
            Prove you control <strong>@{challenge.xHandle}</strong> by updating your X profile:
          </p>
          <ol className="profile-x-verify-list muted">
            {challenge.instructions.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="muted token-fee-note">
            Verification code: <span className="lp-mono">{challenge.verifyCode}</span>
          </p>
          <div className="profile-x-verify-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void handleVerify()}
              disabled={verifying}
            >
              {verifying ? 'Checking X profile…' : 'Check verification'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setChallenge(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {!activeHandle && !challenge ? (
        <div className="profile-x-unlinked">
          <p className="muted">
            Verify your X account to attribute @bankrbot launches to your hood.markets profile.
          </p>
          <label className="profile-bankr-field">
            <span className="muted">X username</span>
            <input
              className="lp-input"
              type="text"
              placeholder="@handle"
              value={inputHandle}
              onChange={(e) => setInputHandle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleStart();
              }}
            />
          </label>
          <p className="muted token-fee-note">
            We check your X profile website or bio for a hood.markets link or verification code —
            same idea as verifying a domain on GitHub or Linktree.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleStart()}
            disabled={starting}
          >
            {starting ? 'Preparing…' : 'Start verification'}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="error" style={{ marginTop: '0.75rem' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
