import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  checkDeployCooldown,
  deployToken,
  DeployApiError,
  fetchDeployPreview,
  fetchWebDeployConfig,
  loadPendingWalletDeploy,
  retryPendingWalletDeployComplete,
  WalletDeployCompleteError,
  type DeployCooldownConflict,
  type DeployResult,
  type WebDeployConfig,
} from '../api';
import { txUrl } from '../chain';
import { readImageFileAsDataUrl, resolveLaunchImagePayload } from '../lib/imageUpload';
import { looksLikeFeeRecipientInput } from '../lib/feeRecipientInput';
import { pickPrivyEmbeddedWallet } from '../lib/privyWallet';
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
  const { wallets } = useWallets();
  const wallet = useMemo(() => pickPrivyEmbeddedWallet(wallets), [wallets]);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [xUrl, setXUrl] = useState('');
  const [feeTarget, setFeeTarget] = useState<'self' | 'other'>('self');
  const [feeRecipient, setFeeRecipient] = useState('');
  const [initialBuyEth, setInitialBuyEth] = useState('');
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
  const [walletCompleteTxHash, setWalletCompleteTxHash] = useState<string | null>(null);
  const [hasPendingFinalize, setHasPendingFinalize] = useState(() => !!loadPendingWalletDeploy());

  const debouncedSymbol = useDebounced(symbol.trim().toUpperCase(), 400);
  const debouncedName = useDebounced(name.trim(), 400);
  const debouncedFeeRecipient = useDebounced(feeRecipient.trim(), 400);

  useEffect(() => {
    fetchWebDeployConfig()
      .then((c) => setConfig(c))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (config?.initialBuyDefaultEth) {
      setInitialBuyEth(config.initialBuyDefaultEth);
    }
  }, [config?.initialBuyDefaultEth]);

  useEffect(() => {
    if (!authenticated) {
      setRateLimitNotice(null);
      return;
    }
    if (feeTarget === 'other' && !looksLikeFeeRecipientInput(debouncedFeeRecipient)) {
      setRateLimitNotice(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;
        const preview = await fetchDeployPreview(token, {
          feeTarget,
          recipientPaste: feeTarget === 'other' ? debouncedFeeRecipient : undefined,
        });
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
  }, [authenticated, feeTarget, debouncedFeeRecipient, getAccessToken]);

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
  const deployHours = config?.deployRateLimitHours ?? 24;
  const recipientDayCap = config?.maxFeeRecipientDeploysPerEasternDay ?? 0;
  const recipientRollingCap = config?.maxThirdPartyFeeToWalletPer24h ?? 0;
  const deployerOtherDayCap = config?.maxOtherFeeDeploysPerEasternDay ?? 0;
  const limitsNote = useMemo(() => {
    const base = `1 token for yourself every ${deployHours}h · each name & symbol unique for ${cooldownHours}h`;
    if (!config?.thirdPartyFeeDeployEnabled) return base;
    const parts: string[] = [base];
    if (deployerOtherDayCap > 0) {
      parts.push(
        `launch for someone else ${deployerOtherDayCap}× per Eastern day`,
      );
    }
    if (recipientDayCap > 0 || recipientRollingCap > 0) {
      const recipientParts: string[] = [];
      if (recipientDayCap > 0) {
        recipientParts.push(`${recipientDayCap} third-party receive per Eastern day`);
      }
      if (recipientRollingCap > 0) {
        recipientParts.push(`${recipientRollingCap} per ${deployHours}h`);
      }
      parts.push(`recipients: ${recipientParts.join(', ')} (they can still launch for themselves)`);
    }
    return parts.join(' · ');
  }, [
    config?.thirdPartyFeeDeployEnabled,
    cooldownHours,
    deployHours,
    recipientDayCap,
    recipientRollingCap,
    deployerOtherDayCap,
  ]);

  const blockingReserved = liveNameReserved ?? liveTickerReserved;

  const blockingConflict = useMemo(
    () => submitConflict ?? liveTickerConflict ?? liveNameConflict,
    [submitConflict, liveTickerConflict, liveNameConflict],
  );

  const cannotLaunch =
    !!blockingConflict ||
    !!blockingReserved ||
    (feeTarget === 'other' && !looksLikeFeeRecipientInput(feeRecipient));

  const previewSymbol = (symbol.trim() || 'TICK').toUpperCase();
  const previewName = name.trim() || 'Your Token';
  const previewImage = imageDataUrl || (imageUrl.trim().startsWith('http') ? imageUrl.trim() : null);
  const hasImage = !!resolveLaunchImagePayload(imageDataUrl, imageUrl);

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
    setWalletCompleteTxHash(null);
    setResult(null);
    setLaunchedMeta(null);

    if (cannotLaunch) return;

    if (feeTarget === 'other' && !looksLikeFeeRecipientInput(feeRecipient)) {
      setError('Enter a wallet (0x…), @handle, or profile link for who receives trading fees.');
      return;
    }

    const resolvedImage = resolveLaunchImagePayload(imageDataUrl, imageUrl);
    if (!resolvedImage) {
      setError('Upload a logo or paste a public HTTPS image URL.');
      return;
    }

    if (!authenticated) {
      login();
      return;
    }

    const defaultBuyEth = config?.initialBuyDefaultEth ?? '0.005';
    const buyEth = initialBuyEth.trim() || defaultBuyEth;
    const needsWallet = Boolean(config?.walletDeployEnabled);

    if (needsWallet && !wallet?.address) {
      setError(
        `Connect your hood.markets embedded wallet to pay the pool seed (~${defaultBuyEth} ETH) plus gas.`,
      );
      return;
    }

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
          feeTarget,
          recipientPaste: feeTarget === 'other' ? feeRecipient.trim() : undefined,
        },
        needsWallet && wallet
          ? {
              address: wallet.address,
              getEthereumProvider: () => wallet.getEthereumProvider(),
            }
          : undefined,
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
      setFeeTarget('self');
      setFeeRecipient('');
      setInitialBuyEth(config?.initialBuyDefaultEth ?? '0.005');
      setRateLimitNotice(null);
      setLiveTickerConflict(null);
      setLiveNameConflict(null);
      openTokenPage(out.tokenAddress);
    } catch (err) {
      if (err instanceof WalletDeployCompleteError) {
        setWalletCompleteTxHash(err.transactionHash);
        setHasPendingFinalize(true);
        setError(
          'Your launch transaction succeeded on-chain, but hood.markets could not finalize it yet. Try “Finalize launch” below or check Blockscout.',
        );
      } else if (err instanceof DeployApiError) {
        setError(err.message);
        if (err.conflict) setSubmitConflict(err.conflict);
      } else {
        setError(err instanceof Error ? err.message : 'Launch failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onFinalizePendingLaunch() {
    setError(null);
    setSubmitting(true);
    try {
      const authToken = await getAccessToken();
      if (!authToken) {
        setError('Could not get auth token. Try signing in again.');
        return;
      }
      const pending = loadPendingWalletDeploy();
      const out = await retryPendingWalletDeployComplete(authToken);
      setHasPendingFinalize(false);
      setWalletCompleteTxHash(null);
      setResult(out);
      setLaunchedMeta(
        pending
          ? { name: pending.payload.name, symbol: pending.payload.symbol }
          : { name: name.trim(), symbol: symbol.trim().toUpperCase() },
      );
      openTokenPage(out.tokenAddress);
    } catch (err) {
      if (err instanceof WalletDeployCompleteError) {
        setWalletCompleteTxHash(err.transactionHash);
        setHasPendingFinalize(true);
        setError(err.message);
      } else if (err instanceof DeployApiError) {
        setError(err.message);
        if (err.conflict) setSubmitConflict(err.conflict);
      } else {
        setError(err instanceof Error ? err.message : 'Finalize failed');
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

            {config?.walletDeployEnabled ? (
              <div className="lp-card form-section">
                <p className="section-label">Pool seed</p>
                <p className="muted" style={{ fontSize: '0.82rem', margin: '0 0 0.75rem' }}>
                  You pay ~{config.initialBuyDefaultEth} ETH plus gas from your hood.markets wallet to
                  deploy and seed the pool. hood.markets does not cover website deployment costs.
                  {feeTarget === 'other'
                    ? ' Trading fees still go to the recipient you choose below.'
                    : null}
                </p>
                <div className="initial-buy-row">
                  <button
                    type="button"
                    className={`initial-buy-preset${initialBuyEth === config.initialBuyDefaultEth ? ' is-active' : ''}`}
                    onClick={() => setInitialBuyEth(config.initialBuyDefaultEth)}
                  >
                    {config.initialBuyDefaultEth} ETH
                  </button>
                  {(config.initialBuyPresetsEth ?? ['0.005', '0.01', '0.05'])
                    .filter((preset) => preset !== config.initialBuyDefaultEth)
                    .map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`initial-buy-preset${initialBuyEth === preset ? ' is-active' : ''}`}
                      onClick={() => setInitialBuyEth(preset)}
                    >
                      {preset} ETH
                    </button>
                  ))}
                </div>
                <label style={{ marginTop: '0.75rem' }}>
                  Custom amount (ETH)
                  <input
                    className="lp-input"
                    value={initialBuyEth}
                    onChange={(e) => setInitialBuyEth(e.target.value.trim())}
                    placeholder={`Min ${config.initialBuyMinEth} — max ${config.initialBuyMaxEth}`}
                    inputMode="decimal"
                  />
                </label>
              </div>
            ) : null}

            <div className="lp-card form-section">
              <p className="section-label">Trading fees</p>
              <div className="launch-mode-row" role="radiogroup" aria-label="Fee recipient">
                <label
                  className={`launch-mode-option${feeTarget === 'self' ? ' active' : ''}`}
                >
                  <span className="launch-mode-title">
                    <input
                      type="radio"
                      name="feeTarget"
                      checked={feeTarget === 'self'}
                      onChange={() => setFeeTarget('self')}
                    />
                    Me
                  </span>
                  <span className="launch-mode-desc muted">
                    Trading fees go to your hood.markets wallet.
                  </span>
                </label>
                <label
                  className={`launch-mode-option${feeTarget === 'other' ? ' active' : ''}`}
                >
                  <span className="launch-mode-title">
                    <input
                      type="radio"
                      name="feeTarget"
                      checked={feeTarget === 'other'}
                      onChange={() => setFeeTarget('other')}
                    />
                    Someone else
                  </span>
                  <span className="launch-mode-desc muted">
                    Launch for a friend — fees go to their wallet or linked @handle.
                  </span>
                </label>
              </div>
              {feeTarget === 'other' ? (
                <label style={{ marginTop: '0.85rem' }}>
                  Fee recipient
                  <input
                    className="lp-input"
                    value={feeRecipient}
                    onChange={(e) => setFeeRecipient(e.target.value)}
                    placeholder="0x… or @handle or https://x.com/…"
                    required
                  />
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    Each wallet can receive at most{' '}
                    {recipientDayCap > 0 ? `${recipientDayCap} launch from others per Eastern day` : '1 launch from others per day'}
                    {recipientRollingCap > 0 ? ` and ${recipientRollingCap} per ${deployHours}h` : ''}.
                    They can still launch one token for themselves.
                    {deployerOtherDayCap > 0
                      ? ` You can launch for someone else ${deployerOtherDayCap}× per Eastern day.`
                      : ''}
                  </span>
                </label>
              ) : null}
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
                  : feeTarget === 'other' && !looksLikeFeeRecipientInput(feeRecipient)
                    ? 'Enter fee recipient'
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
        {error && !submitConflict ? (
          <div className="error-block">
            <p className="error">{error}</p>
            {walletCompleteTxHash ? (
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                On-chain tx:{' '}
                <a href={txUrl(walletCompleteTxHash)} target="_blank" rel="noreferrer">
                  {walletCompleteTxHash.slice(0, 10)}…{walletCompleteTxHash.slice(-8)}
                </a>
              </p>
            ) : null}
            {hasPendingFinalize ? (
              <button
                type="button"
                className="btn secondary"
                disabled={submitting || !authenticated}
                onClick={() => void onFinalizePendingLaunch()}
              >
                {submitting ? 'Finalizing…' : 'Finalize launch'}
              </button>
            ) : null}
          </div>
        ) : null}
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
