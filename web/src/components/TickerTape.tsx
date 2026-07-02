import {
  buildTickerItems,
  expandTickerSequence,
  formatTickerAge,
  type ExploreToken,
} from '../lib/exploreTokens';
import { formatUsdVol } from '../lib/dexscreenerVolume';
import { openTokenPage } from '../lib/tokenRoute';

const CATEGORY_STYLES = {
  hot: { label: 'HOT', className: 'led-tag-hot' },
  trending: { label: 'TRND', className: 'led-tag-trnd' },
  new: { label: 'NEW', className: 'led-tag-new' },
} as const;

export function TickerTape({ tokens }: { tokens: ExploreToken[] }) {
  const base = buildTickerItems(tokens);
  if (base.length === 0) return null;

  const sequence = expandTickerSequence(base);
  const loop = [...sequence, ...sequence];

  return (
    <div className="led-ticker" aria-label="Hot, trending, and new tokens">
      <div className="led-ticker__track">
        {loop.map((t, i) => {
          const cat = CATEGORY_STYLES[t.category];
          const isUp = (t.change24h ?? 0) >= 0;
          const hasChange = typeof t.change24h === 'number';

          return (
            <button
              type="button"
              key={`${t.address}-${t.category}-${i}`}
              className="led-item"
              onClick={() => openTokenPage(t.address)}
            >
              <span className={`led-tag ${cat.className}`}>{cat.label}</span>
              <span className="led-symbol">${t.symbol}</span>
              {hasChange ? (
                <span className={`led-change ${isUp ? 'led-up' : 'led-down'}`}>
                  {isUp ? '▲' : '▼'}
                  {isUp ? '+' : ''}
                  {t.change24h!.toFixed(1)}%
                </span>
              ) : null}
              {t.category === 'new' ? (
                <span className="led-meta">{formatTickerAge(t.createdAt)}</span>
              ) : t.volume24h > 0 ? (
                <span className="led-meta">VOL {formatUsdVol(t.volume24h)}</span>
              ) : t.mcap != null && t.mcap > 0 ? (
                <span className="led-meta">MCAP {formatUsdVol(t.mcap)}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
