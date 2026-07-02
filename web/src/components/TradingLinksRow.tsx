import { buildTradingLinks, type TradingLinks } from '../lib/tradingLinks';

export function TradingLinksRow({ links }: { links: TradingLinks }) {
  return (
    <div className="trade-links">
      <a href={links.dexscreener} target="_blank" rel="noreferrer">
        DexScreener
      </a>
      <a href={links.uniswapSwap} target="_blank" rel="noreferrer">
        Uniswap
      </a>
    </div>
  );
}

export function TradingLinksRowForToken({ tokenAddress }: { tokenAddress: string }) {
  return <TradingLinksRow links={buildTradingLinks(tokenAddress)} />;
}
