import { useEffect, useState, type ReactNode } from 'react';
import { fetchDeploymentByAddress, type TokenDetail } from '../api';
import { shortenAddress, tokenUrl } from '../chain';
import { fetchTokenMetricsFromDexscreener, type DexTokenMetrics } from '../lib/dexscreenerVolume';
import { fetchTokenDescriptionFromChain } from '../lib/tokenOnChainMetadata';
import { closeTokenPage } from '../lib/tokenRoute';
import { resolveTokenLaunchTweetUrl } from '../lib/launchTweet';
import { splitTokenDescriptionForDisplay } from '../lib/tokenDescriptionDisplay';
import { formatTickerAge } from '../lib/exploreTokens';
import { DexScreenerChartEmbed } from './TokenListingStatus';
import { LiveTradesTable } from './LiveTradesTable';
import { TokenAvatar } from './TokenAvatar';
import { TokenHeroMetrics } from './TokenHeroMetrics';
import { TokenPageSidebar } from './TokenPageSidebar';
import { TokenSocialLinks } from './TokenSocialLinks';
import { TokenTimeframeStrip } from './TokenTimeframeStrip';

function TokenHeaderAction({
  children,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button type="button" className="tp-btn-ghost" onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
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
  const launchTweetUrl = resolveTokenLaunchTweetUrl(token);
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
      <div className="tp-top-bar">
        <button type="button" className="btn btn-ghost token-page-back" onClick={closeTokenPage}>
          ← Explore
        </button>
        <div className="tp-header-actions">
          <TokenHeaderAction onClick={onCopyAddress} ariaLabel="Copy token address">
            {copied ? 'Copied' : 'Copy address'}
          </TokenHeaderAction>
          <TokenHeaderAction onClick={onShare} ariaLabel="Share token page">
            Share
          </TokenHeaderAction>
        </div>
      </div>

      <header className="tp-header">
        <div className="tp-token-id">
          <TokenAvatar symbol={sym} imageUrl={token.tokenImageUrl} size={48} priority />
          <div>
            <h1 className="tp-token-name">
              {token.tokenName}{' '}
              <span className="tp-token-sym">${sym}</span>
            </h1>
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
            <TokenTimeframeStrip metrics={metrics} loading={metricsLoading} />
          </section>

          <section className="tp-zone tp-trades-zone">
            <LiveTradesTable
              tokenAddress={token.tokenAddress}
              tokenSymbol={sym}
              metrics={metrics}
              variant="compact"
            />
          </section>
        </div>

        <TokenPageSidebar token={token} launchTweetUrl={launchTweetUrl ?? null} sym={sym} />
      </div>
    </div>
  );
}
