/** Short address for X/DM replies (0xAbcd…1234). */
function shortAddr(addr: string): string {
  const a = addr.trim();
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * Ready-to-post claim success line for Bankr — hood.markets already broadcast the tx.
 * Do not require Bankr /wallet/submit; ok:true means the claim landed on-chain.
 */
export function agentClaimSuccessReplyHint(input: {
  tokenName?: string;
  tokenSymbol: string;
  feeRecipientAddress: string;
  feeAmountEth?: string;
}): string {
  const sym = input.tokenSymbol.replace(/^\$/, '').trim() || '?';
  const name = input.tokenName?.trim();
  const label = name ? `${name} ($${sym})` : `$${sym}`;
  const wallet = shortAddr(input.feeRecipientAddress);
  const amount =
    input.feeAmountEth && Number.parseFloat(input.feeAmountEth) > 0
      ? ` (~${input.feeAmountEth} WETH)`
      : '';
  return (
    `Claim successful — ${label} trading fees pulled to fee wallet ${wallet}${amount}. ` +
    `WETH should show in ${wallet} shortly. (hood.markets broadcast the on-chain claim; no Bankr wallet tx needed.)`
  );
}
