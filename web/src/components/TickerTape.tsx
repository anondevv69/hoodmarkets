import { buildTickerItems, type ExploreToken } from '../lib/exploreTokens';
import { openTokenPage } from '../lib/tokenRoute';

const CATEGORY_STYLES = {
  hot: { label: 'HOT', color: '#ff3b3b' },
  trending: { label: 'TRND', color: '#00ff66' },
  new: { label: 'NEW', color: '#ffd400' },
} as const;

export function TickerTape({ tokens }: { tokens: ExploreToken[] }) {
  const items = buildTickerItems(tokens);
  if (items.length === 0) return null;

  const loop = [...items, ...items];

  return (
    <div className="led-ticker" aria-label="Hot, trending, and new tokens">
      <div className="led-ticker__track">
        {loop.map((t, i) => {
          const cat = CATEGORY_STYLES[t.category];
          const isUp = (t.change24h ?? 0) >= 0;
          const tagGlow =
            t.category === 'hot'
              ? 'led-glow-red'
              : t.category === 'new'
                ? 'led-glow-amber'
                : 'led-glow-green';
          return (
            <button
              type="button"
              key={`${t.address}-${t.category}-${i}`}
              className="led-item"
              onClick={() => openTokenPage(t.address)}
            >
              <span className={`led-tag ${tagGlow}`} style={{ color: cat.color }}>
                [{cat.label}]
              </span>
              <span className="led-symbol">${t.symbol}</span>
              {typeof t.change24h === 'number' ? (
                <span className={`led-change ${isUp ? 'led-glow-green' : 'led-glow-red'}`}>
                  {isUp ? '▲' : '▼'}
                  {isUp ? '+' : ''}
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
