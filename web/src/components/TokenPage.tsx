import { useEffect, useState } from 'react';
import { fetchDeploymentByAddress, type TokenDetail } from '../api';
import { shortenAddress, tokenUrl, txUrl } from '../chain';
import {
  fetchTokenMetricsFromDexscreener,
  type DexTokenMetrics,
} from '../lib/dexscreenerVolume';
import {
  feeRecipientHeadline,
  isHoodmarketsPlatformFeeRecipient,
} from '../lib/feeRecipientDisplay';
import { isV3PoolId } from '../lib/poolId';
import { buildTradingLinks } from '../lib/tradingLinks';
import { closeTokenPage } from '../lib/tokenRoute';
import { CopyButton } from './CopyButton';
import { ClaimFeesActions } from './ClaimFeesActions';
import { DexMetricsStrip } from './DexMetricsStrip';
import { DexScreenerChartEmbed } from './TokenListingStatus';
import { TokenAvatar } from './TokenAvatar';
import { TokenSocialLinks } from './TokenSocialLinks';
import { TradingLinksRow } from './TradingLinksRow';

export function TokenPage({ tokenAddress }: { tokenAddress: string }) {
  const [token, setToken] = useState<TokenDetail | null>(null);
  const [metrics, setMetrics] = useState<DexTokenMetrics | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const row = await fetchDeploymentByAddress(tokenAddress);
        if (cancelled) return;
        setToken(row);
        const m = await fetchTokenMetricsFromDexscreener([row.tokenAddress]);
        if (!cancelled) setMetrics(m[row.tokenAddress]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load token');
      } finally {
        if (!cancelled) setLoading(false);
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
  const links = buildTradingLinks(token.tokenAddress, metrics);
  const feeLabel = token.feeRecipientLabel?.trim();
  const platformFees = isHoodmarketsPlatformFeeRecipient(feeLabel);
  const feeHeadline = feeRecipientHeadline(token.feeRecipientAddress, feeLabel);
  const feeNote = platformFees
    ? 'Trading fees on this launch go to hood.markets (24h deploy limit).'
    : token.feeToSelf
      ? 'Trading fees go to this wallet (launcher deploy).'
      : feeLabel || 'Fees routed per launch settings (see label).';
  const showV4PoolId = token.poolId && !isV3PoolId(token.poolId);

  return (
    <div className="token-page lp-fade-in">
      <button type="button" className="btn btn-ghost token-page-back" onClick={closeTokenPage}>
        ← Explore
      </button>

      <div className="lp-card token-page-hero">
        <div className="token-page-header">
          <TokenAvatar symbol={sym} imageUrl={token.tokenImageUrl} size={72} />
          <div>
            <h2 className="lp-display token-page-name">
              {token.tokenName}{' '}
              <span className="muted">${sym}</span>
            </h2>
            <DexMetricsStrip metrics={metrics} />
            <DexScreenerChartEmbed tokenAddress={token.tokenAddress} metrics={metrics} />
          </div>
        </div>

        <TokenSocialLinks websiteUrl={token.tokenWebsiteUrl} xUrl={token.tokenXUrl} />

        <dl className="token-detail-grid">
          {showV4PoolId ? (
            <div>
              <dt>Uniswap v4 pool</dt>
              <dd className="mono">
                <span className="token-address-row">
                  <span>{token.poolId}</span>
                  <CopyButton text={token.poolId!} />
                </span>
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Contract</dt>
            <dd className="mono">
              <span className="token-address-row">
                <a href={tokenUrl(token.tokenAddress)} target="_blank" rel="noreferrer">
                  {token.tokenAddress}
                </a>
                <CopyButton text={token.tokenAddress} />
              </span>
            </dd>
          </div>
          <div>
            <dt>Launched</dt>
            <dd>{new Date(token.createdAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Deployed by</dt>
            <dd>{token.deployerLabel || 'Unknown'}</dd>
          </div>
          <div>
            <dt>Fee recipient</dt>
            <dd>
              {platformFees ? (
                <span className="lp-display">{feeHeadline}</span>
              ) : (
                <span className="mono token-address-row">
                  <a
                    href={tokenUrl(token.feeRecipientAddress)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {token.feeRecipientAddress}
                  </a>
                  <CopyButton text={token.feeRecipientAddress} />
                </span>
              )}
              {feeLabel && !platformFees ? (
                <p className="muted token-fee-label">{feeLabel}</p>
              ) : null}
              <p className="muted token-fee-note">{feeNote}</p>
            </dd>
          </div>
          <div>
            <dt>Deploy transaction</dt>
            <dd className="mono">
              <span className="token-address-row">
                <a href={txUrl(token.transactionHash)} target="_blank" rel="noreferrer">
                  {shortenAddress(token.transactionHash)}
                </a>
                <CopyButton text={token.transactionHash} />
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="lp-card token-page-trade">
        <p className="section-label">Trade</p>
        <p className="muted token-swap-note">
          Buy and sell on DexScreener or Uniswap — hood.markets does not run in-app swaps for this
          token.
        </p>
        <TradingLinksRow links={links} />
      </div>

      <ClaimFeesActions
        tokenAddress={token.tokenAddress}
        feeRecipientAddress={token.feeRecipientAddress}
        feeRecipientLabel={token.feeRecipientLabel}
      />
    </div>
  );
}
