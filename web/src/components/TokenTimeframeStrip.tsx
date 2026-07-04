import type { DexTokenMetrics } from '../lib/dexscreenerVolume';

function formatChange(pct: number | undefined): { text: string; neg: boolean } {
  if (pct == null || !Number.isFinite(pct)) return { text: '—', neg: false };
  const neg = pct < 0;
  return { text: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`, neg };
}

export function TokenTimeframeStrip({
  metrics,
  loading,
}: {
  metrics?: DexTokenMetrics;
  loading?: boolean;
}) {
  const frames = [
    { label: '5m', pct: metrics?.changeM5Pct },
    { label: '1h', pct: metrics?.changeH1Pct },
    { label: '6h', pct: metrics?.changeH6Pct },
    { label: '24h', pct: metrics?.change24hPct },
  ];

  return (
    <div className="tp-timeframe-strip" aria-busy={loading && !metrics}>
      {frames.map(({ label, pct }) => {
        const { text, neg } = formatChange(pct);
        return (
          <div key={label} className="tp-timeframe-item">
            <span className="tp-timeframe-label">{label}</span>
            <span className={`tp-timeframe-value${neg ? ' neg' : ''}`}>
              {loading && !metrics ? '…' : text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
