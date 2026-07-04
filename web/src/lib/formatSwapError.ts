/** Short, user-facing swap errors — hide viem/MetaMask dumps. */
export function formatSwapError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/user rejected|user denied|denied transaction signature|rejected the request/i.test(raw)) {
    return 'Transaction cancelled in wallet.';
  }
  const firstLine = raw.split('\n').find((l) => l.trim())?.trim() ?? raw;
  if (firstLine.length > 160) return `${firstLine.slice(0, 157)}…`;
  return firstLine || 'Swap failed';
}
