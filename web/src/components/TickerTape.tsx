import { buildTickerItems, type ExploreToken } from '../lib/exploreTokens';
import { openTokenPage } from '../lib/tokenRoute';

const CATEGORY_STYLES = {
  hot: { label: '🔥 HOT', color: 'var(--danger)' },
  trending: { label: '📈 TRENDING', color: 'var(--accent)' },
  new: { label: '🆕 NEW', color: '#7c4dff' },
} as const;

export function TickerTape({ tokens }: { tokens: ExploreToken[] }) {
  const items = buildTickerItems(tokens);
  if (items.length === 0) return null;

  const loop = [...items, ...items];

  return (
    <div className="ticker-tape" aria-label="Hot, trending, and new tokens">
      <div className="ticker-tape__track">
        {loop.map((t, i) => {
          const cat = CATEGORY_STYLES[t.category];
          const isUp = (t.change24h ?? 0) >= 0;
          return (
            <button
              type="button"
              key={`${t.address}-${t.category}-${i}`}
              className="ticker-tape__item"
              onClick={() => openTokenPage(t.address)}
            >
              <span className="ticker-tape__tag" style={{ color: cat.color }}>
                {cat.label}
              </span>
              <span className="ticker-tape__symbol">${t.symbol}</span>
              {typeof t.change24h === 'number' ? (
                <span
                  className="ticker-tape__change"
                  style={{ color: isUp ? 'var(--accent)' : 'var(--danger)' }}
                >
                  {isUp ? '▲' : '▼'} {isUp ? '+' : ''}
                  {t.change24h.toFixed(1)}%
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
