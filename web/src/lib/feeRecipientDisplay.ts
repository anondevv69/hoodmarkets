/** Catalog label when rate-limited deploy routes 100% LP fees to the platform wallet. */
export const HOODMARKETS_PLATFORM_FEE_LABEL = 'Hood.markets is fee recipient';

const PLATFORM_FEE_LABEL_MARKERS = [
  'hoodmarkets platform',
  'hood.markets is fee recipient',
  'rate limit',
] as const;

export function isHoodmarketsPlatformFeeRecipient(feeRecipientLabel?: string): boolean {
  const label = (feeRecipientLabel ?? '').trim().toLowerCase();
  if (!label) return false;
  return PLATFORM_FEE_LABEL_MARKERS.some((m) => label.includes(m));
}

export function feeRecipientHeadline(
  feeRecipientAddress: string,
  feeRecipientLabel?: string,
): string {
  if (isHoodmarketsPlatformFeeRecipient(feeRecipientLabel)) {
    return HOODMARKETS_PLATFORM_FEE_LABEL;
  }
  return feeRecipientAddress;
}
