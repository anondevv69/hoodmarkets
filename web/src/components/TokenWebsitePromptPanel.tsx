import { useWebAuth } from '../auth/WebAuthContext';
import { useActiveWallet } from '../hooks/useActiveWallet';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchTokenPageProfile,
  type TokenDetail,
  type TokenPageProfile,
} from '../api';
import { buildTokenWebsitePrompt } from '../lib/tokenWebsitePrompt';

export function TokenWebsitePromptPanel({
  token,
  profile: profileProp,
}: {
  token: TokenDetail;
  profile?: TokenPageProfile | null;
}) {
  const { authenticated } = useWebAuth();
  const wallet = useActiveWallet();
  const walletAddress = wallet?.address;

  const [profile, setProfile] = useState<TokenPageProfile | null>(profileProp ?? null);
  const [loading, setLoading] = useState(!profileProp);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const p = await fetchTokenPageProfile(token.tokenAddress, walletAddress);
      setProfile(p);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [token.tokenAddress, walletAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (profileProp) setProfile(profileProp);
  }, [profileProp]);

  const canShow = Boolean(profile?.canBuildWebsite);
  const prompt = useMemo(
    () => buildTokenWebsitePrompt({ token, profile }),
    [token, profile],
  );

  const roleLabel = (() => {
    if (!walletAddress || !profile) return 'token admin';
    const w = walletAddress.toLowerCase();
    if (profile.deployerWallet && profile.deployerWallet.toLowerCase() === w) return 'deployer';
    if (profile.topShareHolder && profile.topShareHolder.toLowerCase() === w) {
      return 'top Holder NFT share holder';
    }
    if (profile.adminRole === 'deployer') return 'deployer';
    if (profile.adminRole === 'top_share_holder') return 'top Holder NFT share holder';
    return 'token admin';
  })();

  async function onCopy() {
    try {
      await navigator.clipboard?.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setOpen(true);
    }
  }

  if (loading) return null;
  if (!authenticated || !walletAddress || !canShow) return null;

  return (
    <section className="lp-card form-section tp-website-prompt">
      <p className="section-label">Build a website</p>
      <p className="muted token-space-note">
        You&apos;re signed in as the {roleLabel}. Copy this prompt into Claude, Cursor, Grok, or
        any coding agent to generate a landing page that pulls your icon, banner, market stats,
        Holder NFT listings, and rewards from hood.markets APIs.
      </p>

      <div className="tp-website-prompt-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void onCopy()}>
          {copied ? 'Copied' : 'Copy website prompt'}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide prompt' : 'Preview prompt'}
        </button>
      </div>

      {open ? (
        <textarea
          className="lp-input token-space-input tp-website-prompt-text"
          readOnly
          value={prompt}
          rows={16}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Website builder prompt"
        />
      ) : null}
    </section>
  );
}
