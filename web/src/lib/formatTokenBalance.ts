import { formatUnits } from 'viem';

/** Trim human token amounts for display (not wei). */
export function formatHumanTokenAmount(raw: string, maxFractionDigits = 6): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 })}B`;
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 })}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toLocaleString('en-US', { maximumFractionDigits: 2 })}K`;
  }
  if (n >= 1) {
    return n.toLocaleString('en-US', {
      maximumFractionDigits: maxFractionDigits,
      useGrouping: false,
    });
  }
  return n.toPrecision(4);
}

export function formatTokenBalance(bal: bigint, decimals: number): string {
  return formatHumanTokenAmount(formatUnits(bal, decimals));
}

export function tokenAmountFromPercent(bal: bigint, pct: number, decimals: number): string {
  const slice = (bal * BigInt(Math.round(pct * 100))) / 10000n;
  return formatHumanTokenAmount(formatUnits(slice, decimals), 8);
}
