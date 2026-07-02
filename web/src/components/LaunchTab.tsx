import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  checkDeployCooldown,
  deployToken,
  DeployApiError,
  fetchDeployPreview,
  fetchWebDeployConfig,
  type DeployCooldownConflict,
  type DeployResult,
  type WebDeployConfig,
} from '../api';
import { readImageFileAsDataUrl, resolveLaunchImagePayload } from '../lib/imageUpload';
import { openTokenPage } from '../lib/tokenRoute';
import { LaunchSuccessLinks } from './TokenCard';
import { tradingLinksFromApi } from '../lib/tradingLinks';
import { ExistingTokenConflict } from './ExistingTokenConflict';
import { ReservedBrandNotice } from './ReservedBrandNotice';
import { TokenAvatar } from './TokenAvatar';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function LaunchTab() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [xUrl, setXUrl] = useState('');
  const [rateLimitNotice, setRateLimitNotice] = useState<string | null>(null);
  const [config, setConfig] = useState<WebDeployConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitConflict, setSubmitConflict] = useState<DeployCooldownConflict | null>(null);
  const [liveTickerConflict, setLiveTickerConflict] = useState<DeployCooldownConflict | null>(null);
  const [liveNameConflict, setLiveNameConflict] = useState<DeployCooldownConflict | null>(null);
  const [liveNameReserved, setLiveNameReserved] = useState<string | null>(null);
  const [liveTickerReserved, setLiveTickerReserved] = useState<string | null>(null);
  const [checkingCooldown, setCheckingCooldown] = useState(false);
  const [result, setResult] = useState<DeployResult | null>(null);
  const [launchedMeta, setLaunchedMeta] = useState<{ name: string; symbol: string } | null>(null);

  const debouncedSymbol = useDebounced(symbol.trim().toUpperCase(), 400);
  const debouncedName = useDebounced(name.trim(), 400);

  useEffect(() => {
    fetchWebDeployConfig()
      .then((c) => setConfig(c))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!authenticated) {
      setRateLimitNotice(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;
        const preview = await fetchDeployPreview(token);
        if (!cancelled) {
          setRateLimitNotice(preview.notice);
        }
      } catch {
        if (!cancelled) setRateLimitNotice(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    if (debouncedSymbol.length < 1 && debouncedName.length < 2) {
      setLiveTickerConflict(null);
      setLiveNameConflict(null);
      setLiveNameReserved(null);
      setLiveTickerReserved(null);
      return;
    }

    let cancelled = false;
    setCheckingCooldown(true);
    void checkDeployCooldown(
      debouncedSymbol.length >= 1 ? debouncedSymbol : undefined,
      debouncedName.length >= 2 ? debouncedName : undefined,
    )
      .then((out) => {
        if (cancelled) return;
        setLiveTickerConflict(out.tickerConflict);
        setLiveNameConflict(out.nameConflict);
        setLiveNameReserved(out.nameReserved ? out.reservedNameMessage : null);
        setLiveTickerReserved(out.tickerReserved ? out.reservedTickerMessage : null);
      })
      .catch(() => {
        if (!cancelled) {
          setLiveTickerConflict(null);
          setLiveNameConflict(null);
          setLiveNameReserved(null);
          setLiveTickerReserved(null);
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingCooldown(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSymbol, debouncedName]);

  const cooldownHours = config?.globalTickerCooldownHours ?? 24;
  const limitsNote = `1 token per user every ${config?.deployRateLimitHours ?? 24}h · each name & symbol unique for ${cooldownHours}h`;

  const blockingReserved = liveNameReserved ?? liveTickerReserved;

  const blockingConflict = useMemo(
    () => submitConflict ?? liveTickerConflict ?? liveNameConflict,
    [submitConflict, liveTickerConflict, liveNameConflict],
  );

  const cannotLaunch = !!blockingConflict || !!blockingReserved;

  const previewSymbol = (symbol.trim() || 'TICK').toUpperCase();
  const previewName = name.trim() || 'Your Token';
  const previewImage = imageDataUrl || (imageUrl.trim().startsWith('http') ? imageUrl.trim() : null);
  const hasImage = !!resolveLaunchImagePayload(imageDataUrl, imageUrl);

  useEffect(() => {
    fetchWebDeployConfig()
      .then((c) => setConfig(c))
      .catch(() => undefined);
  }, []);

  async function onPickLogo(file: File | null) {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setImageDataUrl(dataUrl);
      setImageFileName(file.name);
      setImageUrl('');
    } catch (e) {
      setImageDataUrl(null);
      setImageFileName('');
      setError(e instanceof Error ? e.message : 'Could not read logo');
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitConflict(null);
    setResult(null);
    setLaunchedMeta(null);

    if (cannotLaunch) return;

    const resolvedImage = resolveLaunchImagePayload(imageDataUrl, imageUrl);
    if (!resolvedImage) {
      setError('Upload a logo or paste a public HTTPS image URL.');
      return;
    }

    if (!authenticated) {
      login();
      return;
    }

    const buyEth = '0';

    if (rateLimitNotice) {
      const ok = window.confirm(`${rateLimitNotice}\n\nLaunch anyway?`);
      if (!ok) return;
    }

    const token = await getAccessToken();
    if (!token) {
      setError('Could not get auth token. Try signing in again.');
      return;
    }

    setSubmitting(true);
    try {
      const out = await deployToken(
        token,
        {
          name: name.trim(),
          symbol: symbol.trim().toUpperCase(),
          imageUrl: resolvedImage,
          websiteUrl: websiteUrl.trim() || undefined,
          xUrl: xUrl.trim() || undefined,
          description: description.trim() || undefined,
          initialBuyEth: buyEth,
          launchMode: 'simple',
        },
      );
      setLaunchedMeta({ name: name.trim(), symbol: symbol.trim().toUpperCase() });
      setResult(out);
      setName('');
      setSymbol('');
      setImageUrl('');
      setImageDataUrl(null);
      setImageFileName('');
      setDescription('');
      setWebsiteUrl('');
      setXUrl('');
      setRateLimitNotice(null);
      setLiveTickerConflict(null);
      setLiveNameConflict(null);
      openTokenPage(out.tokenAddress);
    } catch (err) {
      if (err instanceof DeployApiError) {
        setError(err.message);
        if (err.conflict) setSubmitConflict(err.conflict);
      } else {
        setError(err instanceof Error ? err.message : 'Launch failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) return <p className="muted">Loading…</p>;

  if (result && launchedMeta) {
    return (
      <div className="launch-done lp-fade-in">
        <div className="launch-done-icon" aria-hidden>
          ✓
        </div>
        <h2 className="lp-display launch-done-title">
          ${launchedMeta.symbol.replace(/^\$/, '')} is live
        </h2>
        <p className="muted launch-done-sub">
          {launchedMeta.name} is on Robinhood Chain and visible in Tokens.
        </p>
        <LaunchSuccessLinks
          tokenAddress={result.tokenAddress}
          tokenName={launchedMeta.name}
          tokenSymbol={launchedMeta.symbol}
          imageUrl={result.imageUrl}
          links={result.links ? tradingLinksFromApi(result.tokenAddress, result.links) : undefined}
          txHash={result.transactionHash}
        />
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: '1.25rem' }}
          onClick={() => {
            setResult(null);
            setLaunchedMeta(null);
          }}
        >
          Launch another token
        </button>
      </div>
    );
  }

  return (
    <div className="launch-layout lp-fade-in">
      <div className="launch-form-col">
        <div className="notice">{limitsNote}</div>
        {rateLimitNotice ? (
          <div className="rate-limit-warning" role="alert">
            {rateLimitNotice}
          </div>
        ) : null}

        {!authenticated ? (
          <div className="empty">
            <p>Sign in to launch a token on Robinhood Chain.</p>
            <button type="button" className="btn btn-primary" onClick={login} style={{ marginTop: '1rem' }}>
              Sign in
            </button>
          </div>
        ) : (
          <form className="form" onSubmit={onSubmit}>
            <div className="lp-card form-section">
              <p className="section-label">Token details</p>
              <div className="name-symbol-row">
                <label>
                  Name
                  <input
                    className="lp-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Robin Hood"
                    minLength={2}
                    maxLength={64}
                    required
                  />
                </label>
                <label>
                  Ticker
                  <input
                    className="lp-input"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="HOOD"
                    minLength={1}
                    maxLength={10}
                    required
                  />
                </label>
              </div>

              {liveNameReserved ? <ReservedBrandNotice message={liveNameReserved} /> : null}
              {liveTickerReserved ? <ReservedBrandNotice message={liveTickerReserved} /> : null}

              {liveNameConflict && !liveTickerConflict && !liveNameReserved ? (
                <ExistingTokenConflict conflict={liveNameConflict} />
              ) : null}
              {liveTickerConflict && !liveTickerReserved ? (
                <ExistingTokenConflict conflict={liveTickerConflict} />
              ) : null}

              <div className="logo-upload-row">
                <button
                  type="button"
                  className="logo-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imageFileName || imageDataUrl ? 'Change logo' : 'Upload logo'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => void onPickLogo(e.target.files?.[0] ?? null)}
                />
                <span className="muted logo-upload-hint">
                  {imageFileName
                    ? imageFileName
                    : config?.imageUploadEnabled
                      ? 'PNG, JPG, GIF, or WebP · max 2 MB · uploaded to IPFS'
                      : 'PNG, JPG, GIF, or WebP · max 2 MB · or paste HTTPS URL'}
                </span>
              </div>

              <label>
                Or image URL
                <input
                  className="lp-input"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    if (e.target.value.trim()) {
                      setImageDataUrl(null);
                      setImageFileName('');
                    }
                  }}
                  placeholder="https://…"
                  type="url"
                  disabled={!!imageDataUrl}
                />
              </label>
              {!hasImage ? (
                <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
                  A logo is required — it is stored on-chain in token metadata.
                </p>
              ) : null}
              <label>
                <span className="field-label">
                  Description <span className="field-label__optional">optional</span>
                </span>
                <textarea
                  className="lp-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this token about?"
                />
              </label>
              <div className="name-symbol-row">
                <label>
                  Website
                  <input
                    className="lp-input"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourproject.com"
                    type="url"
                  />
                </label>
                <label>
                  X
                  <input
                    className="lp-input"
                    value={xUrl}
                    onChange={(e) => setXUrl(e.target.value)}
                    placeholder="@handle or https://x.com/…"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-launch"
              disabled={submitting || cannotLaunch || !hasImage}
            >
              {submitting
                ? 'Launching…'
                : !hasImage
                  ? 'Add a logo to launch'
                  : blockingReserved
                  ? 'Reserved name or ticker'
                  : blockingConflict
                    ? 'Ticker or name unavailable'
                    : 'Launch token'}
            </button>
            {checkingCooldown && !cannotLaunch ? (
              <p className="muted" style={{ textAlign: 'center', fontSize: '0.8rem' }}>
                Checking availability…
              </p>
            ) : null}
          </form>
        )}

        {submitConflict && !liveTickerConflict && !liveNameConflict ? (
          <ExistingTokenConflict conflict={submitConflict} />
        ) : null}
        {error && !submitConflict ? <p className="error">{error}</p> : null}
      </div>

      <aside className="launch-preview-col">
        <p className="section-label">Live preview</p>
        <div className="lp-card preview-card">
          <div className="preview-header">
            <TokenAvatar symbol={previewSymbol} imageUrl={previewImage} size={48} />
            <div>
              <div className="lp-display preview-name">{previewName}</div>
              <div className="lp-mono muted">${previewSymbol.replace(/^\$/, '')}</div>
            </div>
          </div>
          <p className="preview-desc">
            {description.trim() ||
              'Your description shows here — exactly how traders see it in Explore.'}
          </p>
        </div>
        <div className="lp-card preview-tip">
          <strong>Tip:</strong> if $TEST was launched in the last {cooldownHours}h, you&apos;ll see the
          existing <strong>Test</strong> token and contract before you deploy.
        </div>
      </aside>
    </div>
  );
}
