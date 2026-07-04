import { useEffect, useState, type ReactNode } from 'react';
import { fetchDeploymentByAddress, type TokenDetail } from '../api';
import { shortenAddress, tokenUrl } from '../chain';
import { fetchTokenMetricsFromDexscreener, type DexTokenMetrics } from '../lib/dexscreenerVolume';
import { fetchTokenDescriptionFromChain } from '../lib/tokenOnChainMetadata';
import { closeTokenPage } from '../lib/tokenRoute';
import { formatTickerAge } from '../lib/exploreTokens';
import { splitTokenDescriptionForDisplay } from '../lib/tokenDescriptionDisplay';
import { DexScreenerChartEmbed } from './TokenListingStatus';
import { LiveTradesTable } from './LiveTradesTable';
import { TokenAvatar } from './TokenAvatar';
import { TokenHeroMetrics } from './TokenHeroMetrics';
import { TokenPageSidebar } from './TokenPageSidebar';
import { TokenSocialLinks } from './TokenSocialLinks';
import { TokenSpaceComments } from './TokenSpaceComments';
import { TokenFractionPanel } from './TokenFractionPanel';

function TokenHeaderIcon({
  onClick,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <button type="button" className="tp-btn-icon" onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

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

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8.5 10.5 15 7l-6.5-3.5v3M15 7v10M7 14.5v2.5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2"
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
            const m = await fetchTokenMetricsFromDexscreener([row.tokenAddress]);
            if (!cancelled) setMetrics(m[row.tokenAddress]);
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

  const onShare = () => {
    const url = window.location.href;
    const title = `${token.tokenName} ($${sym}) · hood.markets`;
    if (navigator.share) {
      void navigator.share({ url, title }).catch(() => {
        void navigator.clipboard?.writeText(url);
      });
    } else {
      void navigator.clipboard?.writeText(url);
    }
  };

  return (
    <div className="token-page lp-fade-in">
      <header className="tp-header">
        <div className="tp-token-id">
          <TokenAvatar symbol={sym} imageUrl={token.tokenImageUrl} size={48} priority />
          <div className="tp-token-title-block">
            <div className="tp-token-title-row">
              <h1 className="tp-token-name">
                {token.tokenName}{' '}
                <span className="tp-token-sym">${sym}</span>
              </h1>
              <div className="tp-header-actions">
                <TokenHeaderIcon
                  onClick={onCopyAddress}
                  ariaLabel={copied ? 'Address copied' : 'Copy token address'}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </TokenHeaderIcon>
                <TokenHeaderIcon onClick={onShare} ariaLabel="Share token page">
                  <ShareIcon />
                </TokenHeaderIcon>
              </div>
            </div>
            <div className="tp-token-meta">
              <a
                className="tp-meta-addr lp-mono"
                href={tokenUrl(token.tokenAddress)}
                target="_blank"
                rel="noreferrer"
              >
                {shortenAddress(token.tokenAddress)}
              </a>
              <span className="tp-meta-dot">·</span>
              <span className="tp-live-pulse">
                <span className="tp-dot-live" aria-hidden />
                {age}
              </span>
            </div>
          </div>
        </div>
      </header>

      {(descriptionUser || descriptionDeployNote || token.tokenWebsiteUrl || token.tokenXUrl) && (
        <div className="tp-description-block">
          {descriptionUser ? <p className="token-description">{descriptionUser}</p> : null}
          {descriptionDeployNote ? (
            <p className="token-description token-page-deploy-note">{descriptionDeployNote}</p>
          ) : null}
          <TokenSocialLinks websiteUrl={token.tokenWebsiteUrl} xUrl={token.tokenXUrl} />
        </div>
      )}

      <TokenHeroMetrics metrics={metrics} loading={metricsLoading} />

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

          <section className="tp-zone tp-trades-zone" aria-labelledby="live-trades-heading">
            <p id="live-trades-heading" className="tp-zone-label">
              Trades
            </p>
            <LiveTradesTable
              tokenAddress={token.tokenAddress}
              tokenSymbol={sym}
              metrics={metrics}
              variant="compact"
            />
          </section>

          <TokenFractionPanel
            tokenAddress={token.tokenAddress}
            factoryAddress={token.factoryAddress}
            poolId={token.poolId}
            deployBlockNumber={token.blockNumber}
            feeRecipientAddress={token.feeRecipientAddress}
          />

          <TokenSpaceComments tokenAddress={token.tokenAddress} />
        </div>

        <TokenPageSidebar token={token} sym={sym} />
      </div>
    </div>
  );
}
