import type { TokenDetail } from '../api';
import { shortenAddress } from '../chain';
import { isHoodmarketsPlatformFeeRecipient } from '../lib/feeRecipientDisplay';
import { openDeployerProfile, openWalletProfile } from '../lib/deployerProfileRoute';
import { resolveRequesterXUsername } from '../lib/requesterXDisplay';
import { ClaimFeesActions } from './ClaimFeesActions';
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

  return (
    <aside className="token-page-sidebar">
      <TokenSwap tokenAddress={token.tokenAddress} symbol={sym} variant="sidebar" />

      <div className="tp-zone tp-deploy-zone">
        <div className="tp-side-title">Deploy details</div>

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
