import { useEffect, useState } from 'react';
import { fetchDeploymentByAddress, type TokenDetail } from '../api';
import { shortenAddress, tokenUrl, txUrl } from '../chain';
import {
  fetchTokenMetricsFromDexscreener,
  type DexTokenMetrics,
} from '../lib/dexscreenerVolume';
import { isHoodmarketsPlatformFeeRecipient } from '../lib/feeRecipientDisplay';
import { isV3PoolId } from '../lib/poolId';
import { buildTradingLinks } from '../lib/tradingLinks';
import { formatDeployChannel } from '../lib/deploySourceDisplay';
import { fetchTokenDescriptionFromChain } from '../lib/tokenOnChainMetadata';
import { closeTokenPage } from '../lib/tokenRoute';
import { openDeployerProfile, openWalletProfile } from '../lib/deployerProfileRoute';
import { resolveRequesterXUsername } from '../lib/requesterXDisplay';
import { CopyButton } from './CopyButton';
import { ClaimFeesActions } from './ClaimFeesActions';
import { DexMetricsStrip } from './DexMetricsStrip';
import { DexScreenerEmbed } from './TokenListingStatus';
import { TokenAvatar } from './TokenAvatar';
import { TokenSocialLinks } from './TokenSocialLinks';
import { TradingLinksRow } from './TradingLinksRow';
import { LaunchTweetEmbed } from './LaunchTweetEmbed';
import { resolveTokenLaunchTweetUrl } from '../lib/launchTweet';

function PartyCountNote({
  count,
  singular,
  plural,
}: {
  count: number | undefined;
  singular: string;
  plural: string;
}) {
  if (typeof count !== 'number' || count <= 0) return null;
  return (
    <p className="muted token-fee-note">
      {count === 1 ? `1 ${singular}` : `${count} ${plural}`}
    </p>
  );
}

function WalletPartyRow({
  label,
  address,
  count,
  countSingular,
  countPlural,
  onProfile,
}: {
  label: string;
  address: string;
  count?: number;
  countSingular: string;
  countPlural: string;
  onProfile: () => void;
}) {
  return (
    <div className="token-detail-full">
      <dt>{label}</dt>
      <dd>
        <span className="mono token-address-row">
          <button type="button" className="btn-link mono" onClick={onProfile}>
            {address}
          </button>
          <CopyButton text={address} />
        </span>
        <PartyCountNote count={count} singular={countSingular} plural={countPlural} />
        <p className="muted token-fee-note">
          <button type="button" className="btn-link" onClick={onProfile}>
            View profile
          </button>
          {' · '}
          <a href={tokenUrl(address)} target="_blank" rel="noreferrer">
            Blockscout
          </a>
        </p>
      </dd>
    </div>
  );
}

export function TokenPage({ tokenAddress }: { tokenAddress: string }) {
  const [token, setToken] = useState<TokenDetail | null>(null);
  const [description, setDescription] = useState<string | undefined>();
  const [metrics, setMetrics] = useState<DexTokenMetrics | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setDescription(undefined);
      try {
        const row = await fetchDeploymentByAddress(tokenAddress);
        if (cancelled) return;
        setToken(row);
        const catalogDesc = row.tokenDescription?.trim();
        if (catalogDesc) {
          setDescription(catalogDesc);
        } else {
          const onChainDesc = await fetchTokenDescriptionFromChain(tokenAddress);
          if (!cancelled) setDescription(onChainDesc);
        }
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
  const showV4PoolId = token.poolId && !isV3PoolId(token.poolId);
  const launchTweetUrl = resolveTokenLaunchTweetUrl(token);
  const requesterX = resolveRequesterXUsername({
    requesterXUsername: token.requesterXUsername,
    deployerLabel: token.deployerLabel,
    agentMetadata: token.agentMetadata,
    sourceUrl: token.sourceUrl,
  });

  const deployChannel = formatDeployChannel({
    platform: token.platform,
    deployerLabel: token.deployerLabel,
    clientKind: token.clientKind,
    agentMetadata: token.agentMetadata,
    deployerId: token.deployerId,
    requesterXUsername: token.requesterXUsername,
    sourceUrl: token.sourceUrl,
  });

  const deployerWallet = token.deployerWalletAddress?.trim() || null;
  const deployerLaunchCount = token.deployerDeploymentCount;
  const feeRecipientCount = token.feeRecipientDeploymentCount;

  return (
    <div className="token-page lp-fade-in">
      <button type="button" className="btn btn-ghost token-page-back" onClick={closeTokenPage}>
        ← Explore
      </button>

      <div className="lp-card token-page-hero">
        <div className="token-page-header">
          <TokenAvatar symbol={sym} imageUrl={token.tokenImageUrl} size={72} />
          <div className="token-page-header-main">
            <h2 className="lp-display token-page-name">
              {token.tokenName}{' '}
              <span className="muted">${sym}</span>
            </h2>
            <DexMetricsStrip metrics={metrics} />
            <div className="token-hero-trade-links">
              <TradingLinksRow links={links} />
            </div>
          </div>
        </div>
        <TokenSocialLinks websiteUrl={token.tokenWebsiteUrl} xUrl={token.tokenXUrl} />
        {description ? <p className="token-description">{description}</p> : null}
      </div>

      <DexScreenerEmbed tokenAddress={token.tokenAddress} metrics={metrics} />

      {launchTweetUrl ? <LaunchTweetEmbed tweetUrl={launchTweetUrl} /> : null}

      <div className="lp-card token-page-details">
        <div className="token-launch-details-header">
          <p className="section-label">Launch details</p>
          <div className="token-deploy-channel">
            <p className="lp-display token-deploy-channel-headline">{deployChannel.headline}</p>
            {deployChannel.subline ? (
              <p className="muted token-fee-note">{deployChannel.subline}</p>
            ) : null}
            {deployChannel.xUsername ? (
              <p className="token-fee-note">
                <button
                  type="button"
                  className="btn-link lp-display"
                  onClick={() => openDeployerProfile(deployChannel.xUsername!)}
                >
                  @{deployChannel.xUsername}
                </button>
              </p>
            ) : null}
            {deployChannel.tweetUrl ? (
              <p className="token-fee-note">
                <a href={deployChannel.tweetUrl} target="_blank" rel="noreferrer">
                  Launch tweet
                </a>
              </p>
            ) : null}
          </div>
        </div>

        <dl className="token-detail-grid token-detail-grid-single">
          {showV4PoolId ? (
            <div className="token-detail-full">
              <dt>Uniswap v4 pool</dt>
              <dd className="mono">
                <span className="token-address-row">
                  <span>{token.poolId}</span>
                  <CopyButton text={token.poolId!} />
                </span>
              </dd>
            </div>
          ) : null}

          <div className="token-detail-full">
            <dt>Token contract address</dt>
            <dd className="mono">
              <span className="token-address-row">
                <a href={tokenUrl(token.tokenAddress)} target="_blank" rel="noreferrer">
                  {token.tokenAddress}
                </a>
                <CopyButton text={token.tokenAddress} />
              </span>
            </dd>
          </div>

          {requesterX && !deployerWallet ? (
            <div className="token-detail-full">
              <dt>Deployer</dt>
              <dd>
                <button
                  type="button"
                  className="btn-link lp-display"
                  onClick={() => openDeployerProfile(requesterX)}
                >
                  @{requesterX}
                </button>
                <PartyCountNote
                  count={token.requesterXLaunchCount}
                  singular="launch on hood.markets"
                  plural="launches on hood.markets"
                />
                <p className="muted token-fee-note">
                  <button type="button" className="btn-link" onClick={() => openDeployerProfile(requesterX)}>
                    View profile
                  </button>
                </p>
              </dd>
            </div>
          ) : deployerWallet ? (
            <WalletPartyRow
              label="Deployer"
              address={deployerWallet}
              count={deployerLaunchCount}
              countSingular="launch on hood.markets"
              countPlural="launches on hood.markets"
              onProfile={() => openWalletProfile(deployerWallet)}
            />
          ) : (
            <div className="token-detail-full">
              <dt>Deployer</dt>
              <dd>
                <span className="lp-display">{token.deployerLabel || '—'}</span>
                <PartyCountNote
                  count={deployerLaunchCount}
                  singular="launch on hood.markets"
                  plural="launches on hood.markets"
                />
              </dd>
            </div>
          )}

          {platformFees ? (
            <div className="token-detail-full">
              <dt>Fee recipient</dt>
              <dd>
                <span className="lp-display">hood.markets platform</span>
                <p className="muted token-fee-note">Trading fees go to hood.markets.</p>
              </dd>
            </div>
          ) : (
            <WalletPartyRow
              label="Fee recipient"
              address={token.feeRecipientAddress}
              count={feeRecipientCount}
              countSingular="token on hood.markets"
              countPlural="tokens on hood.markets"
              onProfile={() => openWalletProfile(token.feeRecipientAddress)}
            />
          )}

          <div className="token-detail-full">
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

      <ClaimFeesActions
        tokenAddress={token.tokenAddress}
        feeRecipientAddress={token.feeRecipientAddress}
        feeRecipientLabel={token.feeRecipientLabel}
        publicCollect
      />
    </div>
  );
}
