import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchTokenSpaceHolderStatus,
  fetchTokenSpacePosts,
  postTokenSpaceComment,
  type TokenSpacePost,
} from '../api';
import { shortenAddress } from '../chain';
import { openWalletProfile } from '../lib/deployerProfileRoute';
import { formatHumanTokenAmount } from '../lib/formatTokenBalance';

function formatPostTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TokenSpaceComments({ tokenAddress }: { tokenAddress: string }) {
  const { authenticated, login, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = wallets[0]?.address;

  const [posts, setPosts] = useState<TokenSpacePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [holds, setHolds] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);

  const refreshPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchTokenSpacePosts(tokenAddress);
      setPosts(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load discussion.');
    } finally {
      setLoading(false);
    }
  }, [tokenAddress]);

  useEffect(() => {
    void refreshPosts();
  }, [refreshPosts]);

  useEffect(() => {
    if (!walletAddress) {
      setHolds(false);
      setBalance(null);
      return;
    }
    let cancelled = false;
    void fetchTokenSpaceHolderStatus(tokenAddress, walletAddress)
      .then((s) => {
        if (!cancelled) {
          setHolds(s.holds);
          setBalance(s.balance);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHolds(false);
          setBalance(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tokenAddress, walletAddress]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !walletAddress) return;
    setPosting(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        login();
        return;
      }
      await postTokenSpaceComment(token, tokenAddress, walletAddress, body.trim());
      setBody('');
      await refreshPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Post failed.');
    } finally {
      setPosting(false);
    }
  }

  const balanceLabel =
    balance != null ? formatHumanTokenAmount(balance) : null;

  return (
    <section className="tp-zone tp-discussion-zone" aria-labelledby="token-discussion-heading">
      <p id="token-discussion-heading" className="tp-zone-label">
        Discussion
      </p>
      <p className="muted token-space-note">
        Holder-only posts for this token. Anyone can read.
      </p>

      {loading ? <p className="muted">Loading discussion…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && posts.length === 0 ? (
        <p className="muted">No posts yet. Holders can start the conversation.</p>
      ) : (
        <ul className="token-space-list">
          {posts.map((post) => (
            <li key={post.id} className="token-space-post">
              <div className="token-space-post-meta">
                <button
                  type="button"
                  className="token-space-post-author lp-mono"
                  onClick={() => openWalletProfile(post.walletAddress)}
                >
                  {shortenAddress(post.walletAddress)}
                </button>
                <span className="muted">{formatPostTime(post.createdAt)}</span>
              </div>
              <p className="token-space-post-body">{post.body}</p>
            </li>
          ))}
        </ul>
      )}

      {authenticated && walletAddress ? (
        holds ? (
          <form className="token-space-compose" onSubmit={(e) => void onSubmit(e)}>
            <textarea
              className="lp-input token-space-input"
              rows={3}
              maxLength={2000}
              placeholder="Share an update with other holders…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="token-space-compose-foot">
              <span className="muted token-space-holdings">
                You hold {balanceLabel ?? '…'} tokens
              </span>
              <button type="submit" className="btn btn-primary btn-sm" disabled={posting || !body.trim()}>
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </form>
        ) : (
          <p className="muted token-space-holdings">
            {balanceLabel && balance !== '0'
              ? `Your balance (${balanceLabel}) is too low to post.`
              : 'Hold this token to post — connect the wallet that holds it.'}
          </p>
        )
      ) : (
        <p className="muted token-space-signin-foot">
          <button type="button" className="btn btn-ghost btn-sm" onClick={login}>
            Sign in
          </button>{' '}
          to post as a holder.
        </p>
      )}
    </section>
  );
}
