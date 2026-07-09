import { useWebAuth } from '../auth/WebAuthContext';
import { useActiveWallet } from '../hooks/useActiveWallet';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchTokenPageProfile,
  updateTokenPageProfile,
  verifyTokenPage,
  type CustomSocialLink,
  type TokenPageProfile,
} from '../api';

function SourceToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="tp-profile-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function TokenPageProfileEditor({
  tokenAddress,
  onUpdated,
}: {
  tokenAddress: string;
  onUpdated?: (profile: TokenPageProfile) => void;
}) {
  const { authenticated, getAccessToken, connectWallet } = useWebAuth();
  const wallet = useActiveWallet();
  const walletAddress = wallet?.address;

  const [profile, setProfile] = useState<TokenPageProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [xUrl, setXUrl] = useState('');
  const [telegramUrl, setTelegramUrl] = useState('');
  const [discordUrl, setDiscordUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [customLinks, setCustomLinks] = useState<CustomSocialLink[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [useDexIcon, setUseDexIcon] = useState(true);
  const [useDexBanner, setUseDexBanner] = useState(true);
  const [useLaunchImage, setUseLaunchImage] = useState(true);
  const [useDexLinks, setUseDexLinks] = useState(true);

  const hydrateForm = useCallback((p: TokenPageProfile) => {
    setDescription(p.stored.description || p.catalog.description);
    setWebsiteUrl(p.stored.websiteUrl || p.catalog.websiteUrl);
    setXUrl(p.stored.xUrl || p.catalog.xUrl);
    setTelegramUrl(p.stored.telegramUrl);
    setDiscordUrl(p.stored.discordUrl);
    setGithubUrl(p.stored.githubUrl);
    setCustomLinks(p.stored.customLinks.length ? p.stored.customLinks : [{ title: '', url: '' }]);
    setImageUrl(p.profileImageUrl ?? '');
    setBannerUrl(p.profileBannerUrl ?? '');
    setUseDexIcon(p.useDexIcon);
    setUseDexBanner(p.useDexBanner);
    setUseLaunchImage(p.useLaunchImage);
    setUseDexLinks(p.useDexLinks);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTokenPageProfile(tokenAddress, walletAddress);
      setProfile(data);
      hydrateForm(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, [tokenAddress, walletAddress, hydrateForm]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onSave() {
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
      const links = customLinks.filter((l) => l.title.trim() && l.url.trim());
      const updated = await updateTokenPageProfile(token, tokenAddress, walletAddress, {
        description,
        websiteUrl,
        xUrl,
        telegramUrl,
        discordUrl,
        githubUrl,
        customLinks: links,
        imageUrl,
        bannerUrl,
        useDexIcon,
        useDexBanner,
        useLaunchImage,
        useDexLinks,
      });
      setProfile(updated);
      hydrateForm(updated);
      setEditing(false);
      setMessage('Token page updated.');
      onUpdated?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onImportDex() {
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
      const updated = await updateTokenPageProfile(token, tokenAddress, walletAddress, {
        importDexBranding: true,
      });
      setProfile(updated);
      hydrateForm(updated);
      setMessage('Imported DexScreener icon and banner.');
      onUpdated?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dex import failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
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
      const out = await verifyTokenPage(token, tokenAddress, walletAddress);
      setProfile(out.profile);
      setMessage(out.replyHint);
      onUpdated?.(out.profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !profile?.canEdit) return null;

  return (
    <section className="tp-zone tp-profile-zone" aria-label="Edit token page">
      <div className="tp-branding-head">
        <p className="tp-zone-label">Token page</p>
        {profile.verified ? (
          <span className="tp-verified-badge" title="Verified by fee recipient">
            Verified ✓
          </span>
        ) : (
          <span className="tp-dex-unpaid-badge">Unverified</span>
        )}
      </div>

      <p className="muted token-space-note">
        Fee recipient, top Holder share holder, or deployer can edit description, links, and
        branding. Fee recipient can verify the page.
      </p>

      {!editing ? (
        <div className="tp-profile-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>
            Edit page
          </button>
          {profile.canVerify ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={() => void onVerify()}
            >
              {busy ? 'Verifying…' : 'Verify page'}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="tp-profile-form">
          <label>
            Description
            <textarea
              className="lp-input token-space-input"
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="tp-profile-links-grid">
            <label>
              Website
              <input className="lp-input" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
            </label>
            <label>
              X
              <input className="lp-input" value={xUrl} onChange={(e) => setXUrl(e.target.value)} placeholder="@handle or URL" />
            </label>
            <label>
              Telegram
              <input className="lp-input" value={telegramUrl} onChange={(e) => setTelegramUrl(e.target.value)} />
            </label>
            <label>
              Discord
              <input className="lp-input" value={discordUrl} onChange={(e) => setDiscordUrl(e.target.value)} />
            </label>
            <label>
              GitHub
              <input className="lp-input" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} />
            </label>
          </div>

          <p className="section-label" style={{ marginTop: '0.75rem' }}>
            Custom links
          </p>
          {customLinks.map((link, i) => (
            <div key={i} className="tp-profile-custom-link-row">
              <input
                className="lp-input"
                placeholder="Label"
                value={link.title}
                onChange={(e) => {
                  const next = [...customLinks];
                  next[i] = { ...next[i], title: e.target.value };
                  setCustomLinks(next);
                }}
              />
              <input
                className="lp-input"
                placeholder="https://…"
                value={link.url}
                onChange={(e) => {
                  const next = [...customLinks];
                  next[i] = { ...next[i], url: e.target.value };
                  setCustomLinks(next);
                }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setCustomLinks(customLinks.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}
          {customLinks.length < 12 ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setCustomLinks([...customLinks, { title: '', url: '' }])}
            >
              + Add link
            </button>
          ) : null}

          <p className="section-label" style={{ marginTop: '0.75rem' }}>
            Icon &amp; banner
          </p>
          <label>
            Custom icon URL (https)
            <input className="lp-input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          </label>
          <label>
            Custom banner URL (https)
            <input className="lp-input" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} />
          </label>

          <div className="tp-profile-toggles">
            <SourceToggle label="Merge DexScreener links when fields are empty" checked={useDexLinks} onChange={setUseDexLinks} />
            <SourceToggle label="Use launch icon when no custom icon" checked={useLaunchImage} onChange={setUseLaunchImage} />
            <SourceToggle label="Use DexScreener icon when paid" checked={useDexIcon} onChange={setUseDexIcon} />
            <SourceToggle label="Use DexScreener banner when paid" checked={useDexBanner} onChange={setUseDexBanner} />
          </div>

          {useDexLinks &&
          (profile.dexLinks.websiteUrl ||
            profile.dexLinks.xUrl ||
            profile.dexLinks.telegramUrl ||
            profile.dexLinks.discordUrl ||
            profile.dexLinks.githubUrl ||
            profile.dexLinks.customLinks.length > 0) ? (
            <p className="muted" style={{ fontSize: '0.82rem' }}>
              Dex links available — empty fields above will show Dex values on the public page.
            </p>
          ) : null}

          {profile.dex.enhancedInfoPaid ? (
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void onImportDex()}>
              {busy ? 'Importing…' : 'Import Dex icon & banner into profile'}
            </button>
          ) : (
            <p className="muted" style={{ fontSize: '0.82rem' }}>
              Pay for{' '}
              <a href="https://marketplace.dexscreener.com/product/token-info" target="_blank" rel="noreferrer">
                Dex Enhanced Token Info
              </a>{' '}
              to sync icon and banner from Dex.
            </p>
          )}

          <div className="tp-profile-actions" style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void onSave()}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={() => {
                if (profile) hydrateForm(profile);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message ? <p className="tp-branding-ok">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!authenticated ? <p className="muted">Sign in with your admin wallet to save.</p> : null}
    </section>
  );
}
