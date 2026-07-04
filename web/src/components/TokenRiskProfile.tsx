import type { DexTokenMetrics } from '../lib/dexscreenerVolume';
import { formatUsdVol } from '../lib/dexscreenerVolume';

function liquidityMeterPct(usd: number | undefined): number {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return 4;
  if (usd >= 50_000) return 100;
  if (usd >= 10_000) return 82;
  if (usd >= 1_000) return 55;
  if (usd >= 100) return 28;
  return Math.max(4, Math.min(100, Math.round((usd / 100) * 28)));
}

function liquidityRisk(usd: number | undefined): {
  label: string;
  tone: 'ok' | 'mid' | 'bad';
  score: string;
  scoreClass: string;
  footnote: string;
} {
  const liq = usd ?? 0;
  if (liq >= 10_000) {
    return {
      label: formatUsdVol(liq),
      tone: 'ok',
      score: 'Moderate',
      scoreClass: 'mid',
      footnote:
        'Launched on hood.markets with locked Uniswap V3 liquidity. Standard ERC-20 — no sell tax. DYOR before trading.',
    };
  }
  if (liq >= 500) {
    return {
      label: formatUsdVol(liq),
      tone: 'mid',
      score: 'Elevated',
      scoreClass: 'mid',
      footnote:
        'Thin liquidity can mean high slippage on larger trades. hood.markets tokens have no sell tax and use a verified launch factory.',
    };
  }
  return {
    label: formatUsdVol(liq),
    tone: 'bad',
    score: 'High risk',
    scoreClass: 'high',
    footnote:
      'Very low pool liquidity — small trades can move price sharply. Verify the contract and pool before buying.',
  };
}

function RiskMeter({
  label,
  value,
  tone,
  widthPct,
}: {
  label: string;
  value: string;
  tone: 'ok' | 'mid' | 'bad';
  widthPct: number;
}) {
  return (
    <div className="tp-risk-item">
      <div className="tp-risk-item-top">
        <span className="tp-risk-item-label">{label}</span>
        <span className={`tp-risk-item-val ${tone}`}>{value}</span>
      </div>
      <div className="tp-meter">
        <div className={`tp-meter-fill ${tone}`} style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}

export function TokenRiskProfile({ metrics }: { metrics?: DexTokenMetrics }) {
  const risk = liquidityRisk(metrics?.liquidityUsd);
  const liqPct = liquidityMeterPct(metrics?.liquidityUsd);

  return (
    <div className="tp-card tp-risk-card">
      <div className="tp-risk-head">
        <div className="tp-risk-title">Launch profile</div>
        <div className={`tp-risk-score ${risk.scoreClass}`}>{risk.score}</div>
      </div>
      <div className="tp-risk-meter-grid">
        <RiskMeter label="Sell tax" value="0%" tone="ok" widthPct={8} />
        <RiskMeter label="Liquidity" value={risk.label} tone={risk.tone} widthPct={liqPct} />
        <RiskMeter label="Pool" value="Locked V3" tone="ok" widthPct={100} />
        <RiskMeter label="Factory" value="Verified" tone="ok" widthPct={100} />
      </div>
      <p className="tp-footnote">{risk.footnote}</p>
    </div>
  );
}
