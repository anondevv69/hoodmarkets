import { formatUnits, parseUnits } from 'viem';

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

/** Parse display amounts like `158710000`, `158.71M`, `1.5K` into token wei. */
export function parseHumanTokenAmount(raw: string, decimals: number): bigint {
  const s = raw.trim().replace(/,/g, '');
  if (!s) throw new Error('Enter a token amount greater than zero.');
  const m = /^(\d+(?:\.\d+)?)\s*([kKmMbB])?$/i.exec(s);
  if (m) {
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) throw new Error('Enter a token amount greater than zero.');
    const suffix = (m[2] || '').toUpperCase();
    const mult =
      suffix === 'K' ? 1_000 : suffix === 'M' ? 1_000_000 : suffix === 'B' ? 1_000_000_000 : 1;
    return parseUnits(String(n * mult), decimals);
  }
  try {
    return parseUnits(s, decimals);
  } catch {
    throw new Error(
      `Could not parse "${raw.trim()}". Enter a plain number or suffix like 158.71M.`,
    );
  }
}

/** Human-readable token amount for a wallet balance percentage (parseable by swaps). */
export function tokenAmountFromPercent(bal: bigint, pct: number, decimals: number): string {
  const slice = (bal * BigInt(Math.round(pct * 100))) / 10000n;
  return formatHumanTokenAmount(formatUnits(slice, decimals));
}
