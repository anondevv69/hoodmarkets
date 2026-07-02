import {
  buildTickerItems,
  expandTickerSequence,
  formatTickerAge,
  isNewLaunch,
  type ExploreToken,
} from '../lib/exploreTokens';
import { openTokenPage } from '../lib/tokenRoute';

export function TickerTape({ tokens }: { tokens: ExploreToken[] }) {
  const base = buildTickerItems(tokens);
  if (base.length === 0) return null;

  const sequence = expandTickerSequence(base);
  const loop = [...sequence, ...sequence];

  return (
    <div className="market-ticker" aria-label="Recently launched tokens">
      <div className="market-ticker__track">
        {loop.map((t, i) => {
          const isUp = (t.change24h ?? 0) >= 0;
          const hasChange = typeof t.change24h === 'number';
          const isNew = isNewLaunch(t.createdAt);

          return (
            <button
              type="button"
              key={`${t.address}-${i}`}
              className="market-ticker__item"
              onClick={() => openTokenPage(t.address)}
            >
              {isNew ? <span className="market-ticker__badge">NEW</span> : null}
              <span className="market-ticker__symbol">${t.symbol}</span>
              {hasChange ? (
                <span className={`market-ticker__change ${isUp ? 'up' : 'down'}`}>
                  {isUp ? '▲' : '▼'}
                  {isUp ? '+' : ''}
                  {t.change24h!.toFixed(1)}%
                </span>
              ) : isNew ? (
                <span className="market-ticker__meta">{formatTickerAge(t.createdAt)}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
