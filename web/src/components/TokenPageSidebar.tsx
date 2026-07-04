import type { TokenDetail } from '../api';
import { shortenAddress } from '../chain';
import { isHoodmarketsPlatformFeeRecipient } from '../lib/feeRecipientDisplay';
import { openDeployerProfile, openWalletProfile } from '../lib/deployerProfileRoute';
import { resolveRequesterXUsername } from '../lib/requesterXDisplay';
import { resolveTokenLaunchTweetUrl } from '../lib/launchTweet';
import { ClaimFeesActions } from './ClaimFeesActions';
import { LaunchRequestCard } from './LaunchRequestCard';
import { TokenSwap } from './TokenSwap';

export function TokenPageSidebar({
  token,
  sym,
}: {
  token: TokenDetail;
  sym: string;
}) {
  const feeLabel = token.feeRecipientLabel?.trim();
  const platformFees = isHoodmarketsPlatformFeeRecipient(feeLabel);
  const deployerWallet = token.deployerWalletAddress?.trim() || null;
  const requesterX = resolveRequesterXUsername({
    requesterXUsername: token.requesterXUsername,
    deployerLabel: token.deployerLabel,
    agentMetadata: token.agentMetadata,
    sourceUrl: token.sourceUrl,
  });

  const deployerDisplay = requesterX
    ? `@${requesterX}`
    : deployerWallet
      ? shortenAddress(deployerWallet)
      : token.deployerLabel || '—';

  const priorLaunches =
    typeof token.deployerDeploymentCount === 'number'
      ? String(token.deployerDeploymentCount)
      : typeof token.requesterXLaunchCount === 'number'
        ? String(token.requesterXLaunchCount)
        : '—';

  const feeRecipientDisplay = platformFees ? 'hood.markets' : shortenAddress(token.feeRecipientAddress);
  const feeRecipientCount =
    typeof token.feeRecipientDeploymentCount === 'number'
      ? String(token.feeRecipientDeploymentCount)
      : '—';
  const launchTweetUrl = resolveTokenLaunchTweetUrl(token);

  return (
    <aside className="token-page-sidebar">
      <TokenSwap
        tokenAddress={token.tokenAddress}
        symbol={sym}
        poolId={token.poolId}
        factoryAddress={token.factoryAddress}
        variant="sidebar"
      />

      <div className="tp-zone tp-deploy-zone">
        <div className="tp-side-title">Deploy details</div>

        {launchTweetUrl ? (
          <LaunchRequestCard
            tweetUrl={launchTweetUrl}
            username={requesterX}
            tokenName={token.tokenName}
            symbol={sym}
          />
        ) : null}

        <div className="tp-info-row">
          <span className="tp-info-k">Deployer</span>
          {requesterX ? (
            <button
              type="button"
              className="tp-info-v tp-info-link lp-mono"
              onClick={() => openDeployerProfile(requesterX)}
            >
              {deployerDisplay}
            </button>
          ) : deployerWallet ? (
            <button
              type="button"
              className="tp-info-v tp-info-link lp-mono"
              onClick={() => openWalletProfile(deployerWallet)}
            >
              {deployerDisplay}
            </button>
          ) : (
            <span className="tp-info-v">{deployerDisplay}</span>
          )}
        </div>

        <div className="tp-info-row">
          <span className="tp-info-k">Prior launches</span>
          <span className="tp-info-v">{priorLaunches}</span>
        </div>

        <div className="tp-info-row">
          <span className="tp-info-k">Fee recipient</span>
          {platformFees ? (
            <span className="tp-info-v">hood.markets</span>
          ) : (
            <button
              type="button"
              className="tp-info-v tp-info-link"
              onClick={() => openWalletProfile(token.feeRecipientAddress)}
            >
              {feeRecipientDisplay}
            </button>
          )}
        </div>

        {!platformFees ? (
          <div className="tp-info-row">
            <span className="tp-info-k">Recipient for</span>
            <span className="tp-info-v">
              {feeRecipientCount === '—'
                ? feeRecipientCount
                : `${feeRecipientCount} token${feeRecipientCount === '1' ? '' : 's'}`}
            </span>
          </div>
        ) : null}

        <ClaimFeesActions
          tokenAddress={token.tokenAddress}
          feeRecipientAddress={token.feeRecipientAddress}
          feeRecipientLabel={token.feeRecipientLabel}
          poolId={token.poolId}
          factoryAddress={token.factoryAddress}
          publicCollect
          variant="sidebar"
        />
      </div>
    </aside>
  );
}
