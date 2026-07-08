import { useCallback, useState } from 'react';
import { useWebAuth } from '../auth/WebAuthContext';
import { linkXHandle, unlinkXHandle } from '../api';

export function ProfileXLink({
  xHandle,
  onUpdated,
}: {
  xHandle: string | null;
  xVerified?: boolean;
  onUpdated: () => Promise<void>;
}) {
  const { getAccessToken } = useWebAuth();
  const [inputHandle, setInputHandle] = useState('');
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLink = useCallback(async () => {
    const handle = inputHandle.trim().replace(/^@/, '');
    if (!handle) {
      setError('Enter your X username.');
      return;
    }
    if (!/^[a-zA-Z0-9_]{1,50}$/.test(handle)) {
      setError('Enter a valid X username (letters, numbers, underscores only, max 50 chars).');
      return;
    }
    setError(null);
    setLinking(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      await linkXHandle(token, handle);
      setInputHandle('');
      await onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not link X account.');
    } finally {
      setLinking(false);
    }
  }, [inputHandle, getAccessToken, onUpdated]);

  const handleUnlink = useCallback(async () => {
    setError(null);
    setUnlinking(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      await unlinkXHandle(token);
      setInputHandle('');
      await onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not unlink X account.');
    } finally {
      setUnlinking(false);
    }
  }, [getAccessToken, onUpdated]);

  return (
    <div className="lp-card profile-linked-account">
      <p className="section-label">X account</p>
      {xHandle ? (
        <div className="profile-x-linked">
          <a
            href={`https://x.com/${xHandle}`}
            target="_blank"
            rel="noreferrer"
            className="lp-mono"
          >
            @{xHandle}
          </a>
          <p className="muted token-fee-note">
            Launches from @{xHandle} are attributed to your profile.
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void handleUnlink()}
            disabled={unlinking}
          >
            {unlinking ? 'Unlinking…' : 'Unlink'}
          </button>
        </div>
      ) : (
        <div className="profile-x-unlinked">
          <p className="muted">
            Link your X handle to attribute @bankrbot launches to your hood.markets profile.
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
                if (e.key === 'Enter') void handleLink();
              }}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleLink()}
            disabled={linking}
          >
            {linking ? 'Linking…' : 'Link X account'}
          </button>
        </div>
      )}
      {error ? (
        <p className="error" style={{ marginTop: '0.75rem' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
