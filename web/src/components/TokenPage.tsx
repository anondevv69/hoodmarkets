import { useEffect, useState } from 'react';
import { fetchDeploymentByAddress, fetchTokenDexBranding, type TokenDetail } from '../api';
import { shortenAddress, tokenUrl } from '../chain';
import { fetchTokenMetricsFromDexscreener, type DexTokenMetrics } from '../lib/dexscreenerVolume';
import { fetchTokenDescriptionFromChain } from '../lib/tokenOnChainMetadata';
import { closeTokenPage } from '../lib/tokenRoute';
import { formatTickerAge } from '../lib/exploreTokens';
import { resolveTokenImageUrl } from '../lib/tokenImageUrl';
import { splitTokenDescriptionForDisplay } from '../lib/tokenDescriptionDisplay';
import { DexScreenerChartEmbed } from './TokenListingStatus';
import { LiveTradesTable } from './LiveTradesTable';
import { TokenAvatar } from './TokenAvatar';
import { TokenHeroMetrics } from './TokenHeroMetrics';
import { TokenPageSidebar } from './TokenPageSidebar';
import { TokenSocialLinks } from './TokenSocialLinks';
import { TokenSpaceComments } from './TokenSpaceComments';
import { TokenBrandingPanel } from './TokenBrandingPanel';
import { TokenFractionPanel } from './TokenFractionPanel';

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 5h5v5M10 14 19 5M15 5h4v4M5 10v9a1 1 0 0 0 1 1h9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5 9.5 17 19 7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TokenPage({ tokenAddress }: { tokenAddress: string }) {
  const [token, setToken] = useState<TokenDetail | null>(null);
  const [description, setDescription] = useState<string | undefined>();
  const [metrics, setMetrics] = useState<DexTokenMetrics | undefined>();
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [displayImageUrl, setDisplayImageUrl] = useState<string | undefined>();
  const [displayBannerUrl, setDisplayBannerUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setToken(null);
      setDescription(undefined);
      setMetrics(undefined);
      setDisplayImageUrl(undefined);
      setDisplayBannerUrl(undefined);
      setMetricsLoading(true);
      try {
        const row = await fetchDeploymentByAddress(tokenAddress);
        if (cancelled) return;
        setToken(row);
        const catalogDesc = row.tokenDescription?.trim();
        if (catalogDesc) setDescription(catalogDesc);
        setLoading(false);

        void (async () => {
          try {
            if (!catalogDesc) {
              const onChainDesc = await fetchTokenDescriptionFromChain(tokenAddress);
              if (!cancelled) setDescription(onChainDesc);
            }
            const [m, branding] = await Promise.all([
              fetchTokenMetricsFromDexscreener([row.tokenAddress]),
              fetchTokenDexBranding(row.tokenAddress).catch(() => null),
            ]);
            if (!cancelled) {
              const metricsRow = m[row.tokenAddress];
              setMetrics(metricsRow);
              const paid = branding?.dex.enhancedInfoPaid ?? metricsRow?.enhancedInfoPaid;
              setDisplayImageUrl(
                branding?.displayImageUrl ||
                  row.tokenImageUrl ||
                  (paid ? metricsRow?.dexIconUrl ?? undefined : undefined),
              );
              setDisplayBannerUrl(
                branding?.displayBannerUrl ||
                  row.tokenBannerUrl ||
                  (paid ? metricsRow?.dexBannerUrl ?? undefined : undefined),
              );
            }
          } finally {
            if (!cancelled) setMetricsLoading(false);
          }
        })();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load token');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenAddress]);

  useEffect(() => {
    const img = displayImageUrl ?? token?.tokenImageUrl;
    if (!img) return;
    const href = resolveTokenImageUrl(img);
    if (!href) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [displayImageUrl, token?.tokenImageUrl]);

  const refreshBrandingDisplay = () => {
    void fetchDeploymentByAddress(tokenAddress).then((row) => {
      setToken(row);
      setDisplayImageUrl(row.tokenImageUrl);
      setDisplayBannerUrl(row.tokenBannerUrl);
    });
  };

  if (loading) return <p className="muted">Loading token…</p>;
  if (error || !token) {
    return (
      <div>
        <button type="button" className="btn btn-ghost" onClick={closeTokenPage}>
          ← Back
        </button>
        <p className="error" style={{ marginTop: '1rem' }}>
          {error ?? 'Token not found'}
        </p>
      </div>
    );
  }

  const sym = token.tokenSymbol.replace(/^\$/, '');
  const age = formatTickerAge(token.createdAt);
  const { userText: descriptionUser, deployNotes: descriptionDeployNote } =
    splitTokenDescriptionForDisplay(description);

  const onCopyAddress = () => {
    void navigator.clipboard?.writeText(token.tokenAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="token-page lp-fade-in">
      {displayBannerUrl ? (
        <div className="tp-page-banner-wrap">
          <img
            className="tp-page-banner"
            src={resolveTokenImageUrl(displayBannerUrl) ?? displayBannerUrl}
            alt=""
            loading="lazy"
          />
        </div>
      ) : null}
      <section className="tp-token-card">
        <div className="tp-token-card-top">
          <div className="tp-token-card-id">
            <TokenAvatar
              symbol={sym}
              imageUrl={displayImageUrl ?? token.tokenImageUrl}
              size={52}
              priority
            />
            <div className="tp-token-card-title">
              <div className="tp-token-card-name-row">
                <h1 className="tp-token-card-name">{token.tokenName}</h1>
                <span className="tp-token-card-ticker">${sym}</span>
              </div>
              <div className="tp-token-card-meta">
                <span className="tp-token-card-addr lp-mono">
                  {shortenAddress(token.tokenAddress)}
                </span>
                <button
                  type="button"
                  className="tp-token-card-copy"
                  onClick={onCopyAddress}
                  aria-label={copied ? 'Address copied' : 'Copy token address'}
                  title={copied ? 'Copied' : 'Copy address'}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </button>
                <span className="tp-dot-live" aria-hidden />
                <span className="tp-token-card-age">{age}</span>
              </div>
            </div>
          </div>
          <a
            className="tp-btn-icon tp-token-card-ext"
            href={tokenUrl(token.tokenAddress)}
            target="_blank"
            rel="noreferrer"
            aria-label="View on Blockscout"
          >
            <ExternalLinkIcon />
          </a>
        </div>

        {descriptionUser ? <p className="tp-token-card-desc">{descriptionUser}</p> : null}
        {descriptionDeployNote ? (
          <p className="tp-token-card-desc tp-token-card-desc--note">{descriptionDeployNote}</p>
        ) : null}

        <TokenSocialLinks
          websiteUrl={token.tokenWebsiteUrl}
          xUrl={token.tokenXUrl}
          variant="card"
        />

        <TokenHeroMetrics metrics={metrics} loading={metricsLoading} variant="card" />
      </section>

      <TokenBrandingPanel tokenAddress={token.tokenAddress} onImported={refreshBrandingDisplay} />

      <div className="token-page-grid">
        <div className="token-page-main">
          <section className="tp-zone tp-chart-zone">
            <p className="tp-zone-label">Chart</p>
            <DexScreenerChartEmbed
              tokenAddress={token.tokenAddress}
              metrics={metrics}
              forceShow
            />
          </section>

          <LiveTradesTable
            tokenAddress={token.tokenAddress}
            tokenSymbol={sym}
            variant="compact"
          />
        </div>

        <TokenPageSidebar token={token} sym={sym} />
      </div>

      <div className="token-page-full-bleed">
        <TokenFractionPanel
          tokenAddress={token.tokenAddress}
          factoryAddress={token.factoryAddress}
          poolId={token.poolId}
          deployBlockNumber={token.blockNumber}
          feeRecipientAddress={token.feeRecipientAddress}
        />
      </div>

      <div className="token-page-full-bleed">
        <TokenSpaceComments tokenAddress={token.tokenAddress} />
      </div>
    </div>
  );
}
