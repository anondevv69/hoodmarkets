/** Format tiny USD prices with subscript zero count — e.g. $0.0₄2303 (NOXA-style). */
export function formatSubscriptUsdPrice(n: number | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;

  const s = n.toFixed(18);
  const [, frac = ''] = s.split('.');
  let zeroRun = 0;
  for (const ch of frac) {
    if (ch === '0') zeroRun += 1;
    else break;
  }
  const sig = frac.slice(zeroRun, zeroRun + 4).replace(/0+$/, '') || '0';
  const sub = String(zeroRun)
    .split('')
    .map((d) => SUB[d] ?? d)
    .join('');
  return `$0.0${sub}${sig}`;
}

const SUB: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
};
