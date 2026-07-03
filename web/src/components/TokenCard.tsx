import { ClaimFeesActions } from './ClaimFeesActions';
import type { Deployment } from '../api';
import type { DexTokenMetrics } from '../lib/dexscreenerVolume';
import type { TradingLinks } from '../lib/tradingLinks';
import { buildTradingLinks } from '../lib/tradingLinks';
import { shortenAddress, tokenUrl, txUrl } from '../chain';
import { DexMetricsStrip } from './DexMetricsStrip';
import { TokenAvatar } from './TokenAvatar';
import { TokenSocialLinks } from './TokenSocialLinks';
import { openTokenPage } from '../lib/tokenRoute';
import { formatLaunchTimeEastern } from '../lib/launchTime';
import { TradingLinksRow, TradingLinksRowForToken } from './TradingLinksRow';

interface TokenCardProps {
  deployment: Deployment;
  metrics?: DexTokenMetrics;
  showDeployer?: boolean;
}

export function TokenCard({ deployment: d, metrics, showDeployer = true }: TokenCardProps) {
  const sym = d.tokenSymbol.replace(/^\$/, '');

  return (
    <li className="token-card">
      <div className="token-card-header">
        <div className="token-card-title-row">
          <TokenAvatar symbol={sym} imageUrl={d.tokenImageUrl} size={40} />
          <h3>
            <button type="button" className="token-card-name-link" onClick={() => openTokenPage(d.tokenAddress)}>
              {d.tokenName} <span className="muted">${sym}</span>
            </button>
          </h3>
        </div>
        <DexMetricsStrip metrics={metrics} />
      </div>

      <p className="token-contract">
        <span className="label">Contract</span>
        <br />
        <a href={tokenUrl(d.tokenAddress)} target="_blank" rel="noreferrer" className="mono">
          {d.tokenAddress}
        </a>
      </p>

      <p className="token-meta">
        {formatLaunchTimeEastern(d.createdAt)}
        {showDeployer && d.deployerLabel ? ` · ${d.deployerLabel}` : ''}
      </p>

      <TokenSocialLinks websiteUrl={d.tokenWebsiteUrl} xUrl={d.tokenXUrl} />

      <div className="trade-section">
        <p className="label">Trade</p>
        <TradingLinksRowForToken tokenAddress={d.tokenAddress} />
      </div>

      {!showDeployer && d.feeRecipientAddress ? (
        <ClaimFeesActions
          tokenAddress={d.tokenAddress}
          feeRecipientAddress={d.feeRecipientAddress}
          feeRecipientLabel={d.feeRecipientLabel}
          poolId={d.poolId}
          factoryAddress={d.factoryAddress}
        />
      ) : null}
    </li>
  );
}

export function LaunchSuccessLinks({
  tokenAddress,
  tokenName,
  tokenSymbol,
  imageUrl,
  links,
  txHash,
}: {
  tokenAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  imageUrl?: string;
  links?: TradingLinks;
  txHash?: string;
}) {
  const sym = (tokenSymbol ?? '').replace(/^\$/, '');
  const tradeLinks = links ?? buildTradingLinks(tokenAddress);
  return (
    <div className="launch-success">
      <div className="preview-header" style={{ marginBottom: '0.75rem' }}>
        <TokenAvatar symbol={sym || '?'} imageUrl={imageUrl} size={48} />
        <div>
          <p className="success" style={{ margin: 0 }}>
            Launched{tokenName ? ` ${tokenName}` : ''}
            {tokenSymbol ? ` ($${sym})` : ''}!
          </p>
          <p className="token-meta mono">
            <a href={tradeLinks.explorer} target="_blank" rel="noreferrer">
              {shortenAddress(tokenAddress)}
            </a>
            {txHash ? (
              <>
                {' · '}
                <a href={txUrl(txHash)} target="_blank" rel="noreferrer">
                  Tx
                </a>
              </>
            ) : null}
          </p>
        </div>
      </div>
      <div className="trade-section">
        <p className="label">Trade</p>
        <TradingLinksRow links={tradeLinks} />
      </div>
    </div>
  );
}
