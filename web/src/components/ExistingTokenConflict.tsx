import type { DeployCooldownConflict } from '../api';
import { shortenAddress } from '../chain';
import { buildTradingLinks } from '../lib/tradingLinks';
import { CopyButton } from './CopyButton';

function tokenAvatarLetter(symbol: string): string {
  const s = symbol.replace(/^\$/, '').trim();
  return (s.slice(0, 2) || '?').toUpperCase();
}

export function ExistingTokenConflict({ conflict }: { conflict: DeployCooldownConflict }) {
  const { existing, cooldownHours } = conflict;
  const sym = existing.tokenSymbol.replace(/^\$/, '');
  const links = buildTradingLinks(existing.tokenAddress);

  const headline =
    conflict.kind === 'ticker'
      ? `$${conflict.requestedSymbol ?? sym} was deployed in the last ${cooldownHours}h`
      : `"${conflict.requestedName ?? existing.tokenName}" was deployed in the last ${cooldownHours}h`;

  return (
    <div className="conflict-card lp-fade-in" role="alert">
      <p className="conflict-title">{headline}</p>
      <p className="conflict-sub">
        Each ticker and name can only be used once every {cooldownHours} hours on Robinhood Chain.
        Use the existing token below or pick a different name/symbol.
      </p>

      <div className="conflict-token">
        <div className="token-avatar" aria-hidden>
          {tokenAvatarLetter(sym)}
        </div>
        <div className="conflict-token-body">
          <div className="conflict-token-name">
            <span className="lp-display">{existing.tokenName}</span>
            <span className="lp-mono muted">${sym}</span>
          </div>
          <div className="conflict-address-row">
            <span className="lp-mono">{shortenAddress(existing.tokenAddress)}</span>
            <CopyButton text={existing.tokenAddress} />
          </div>
          <p className="lp-mono conflict-full-addr">{existing.tokenAddress}</p>
        </div>
      </div>

      <div className="conflict-actions">
        <a
          href={links.dexscreener}
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost btn-sm"
        >
          Chart
        </a>
        <a
          href={links.uniswapSwap}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary btn-sm"
        >
          Trade
        </a>
        <a
          href={links.explorer}
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost btn-sm"
        >
          Explorer
        </a>
      </div>
    </div>
  );
}
