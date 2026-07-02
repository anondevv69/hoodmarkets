import { buildTradingLinks, type TradingLinks } from '../lib/tradingLinks';

export function TradingLinksRow({
  links,
  dexIndexed,
}: {
  links: TradingLinks;
  dexIndexed?: boolean;
}) {
  return (
    <div>
      <div className="trade-links">
        <a href={links.hoodmarkets}>hood.markets</a>
        <a href={links.dexscreener} target="_blank" rel="noreferrer">
          DexScreener{dexIndexed ? '' : ' (pending)'}
        </a>
        <a href={links.uniswapSwap} target="_blank" rel="noreferrer" title="May show no routes until hook is allowlisted">
          Uniswap (pending)
        </a>
        <a href={links.explorer} target="_blank" rel="noreferrer">
          Explorer
        </a>
      </div>
      {!dexIndexed ? (
        <p className="muted trade-links-note">
          External chart and swap links stay empty until DexScreener indexes the pool and Uniswap
          routes hood.markets pools. Your token is still live here and on-chain.
        </p>
      ) : null}
    </div>
  );
}

export function TradingLinksRowForToken({ tokenAddress }: { tokenAddress: string }) {
  return <TradingLinksRow links={buildTradingLinks(tokenAddress)} />;
}
