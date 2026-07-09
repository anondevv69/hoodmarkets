function extractErrorText(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const parts: string[] = [];
  const push = (s: unknown) => {
    if (typeof s === 'string' && s.trim()) parts.push(s.trim());
  };
  push(error.message);
  push((error as { shortMessage?: string }).shortMessage);
  push((error as { details?: string }).details);
  const cause = (error as { cause?: unknown }).cause;
  if (cause instanceof Error) {
    push(cause.message);
    push((cause as { shortMessage?: string }).shortMessage);
    push((cause as { details?: string }).details);
  }
  return parts.join('\n') || 'Claim failed';
}

/** Short, user-facing claim errors — hide raw RPC / viem dumps. */
export function formatClaimError(error: unknown): string {
  const raw = extractErrorText(error);
  const lower = raw.toLowerCase();

  if (/user rejected|user denied|denied transaction signature|rejected the request/i.test(lower)) {
    return 'Transaction cancelled in wallet.';
  }

  if (
    lower.includes('nothingtoclaim') ||
    lower.includes('nothing to claim') ||
    lower.includes('zerotoclaim') ||
    lower.includes('zero to claim') ||
    lower.includes('0x969bf728')
  ) {
    return (
      'Waiting on new swap fees. The last claim already paid out what was available — ' +
      'holders get paid again after more trading adds fees to the locked LP. ' +
      'You can click Claim anytime; it is not locked or on a timer.'
    );
  }

  if (
    lower.includes('no weth trading fees') ||
    lower.includes('no weth in the fee locker') ||
    lower.includes('zero_balance')
  ) {
    return 'No WETH in the fee locker yet. Collect pool fees first after trading activity.';
  }

  if (
    lower.includes('unrecognized chain') ||
    lower.includes('chain id') ||
    lower.includes('wrong network') ||
    lower.includes('invalid chain')
  ) {
    return 'Switch your wallet to Robinhood Chain (chain ID 4663) and try again.';
  }

  if (
    lower.includes('insufficient funds') ||
    lower.includes('exceeds the balance') ||
    lower.includes('gas * price + value') ||
    lower.includes('insufficient balance for gas')
  ) {
    return (
      'Not enough Robinhood Chain ETH for gas. Claims run on Robinhood Chain — ' +
      'Base or other network ETH cannot pay these fees. Switch network and fund this wallet on Robinhood Chain.'
    );
  }

  if (lower.includes('execution reverted') || lower.includes('revert')) {
    if (lower.includes('collect')) {
      return (
        'Could not collect pool fees yet. The pool may still be in its anti-sniper window, ' +
        'or no LP fees have accrued. Try again after more trading activity.'
      );
    }
    return (
      'Waiting on new swap fees since the last payout. ' +
      'Claim anytime after more trading — not a cooldown or lockout.'
    );
  }

  if (
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('timeout') ||
    lower.includes('502') ||
    lower.includes('503')
  ) {
    return 'Network error talking to Robinhood Chain. Wait a moment and try again.';
  }

  const firstLine = raw.split('\n').find((l) => l.trim())?.trim() ?? raw;
  if (firstLine.length > 180) return `${firstLine.slice(0, 177)}…`;
  return firstLine || 'Claim failed';
}

export function shouldReportClaimError(userMessage: string): boolean {
  const lower = userMessage.toLowerCase();
  if (/cancelled in wallet/.test(lower)) return false;
  if (
    /nothing to claim|no weth in the fee locker|no unclaimed fees|waiting on new swap fees/i.test(
      lower,
    )
  ) {
    return false;
  }
  return true;
}
