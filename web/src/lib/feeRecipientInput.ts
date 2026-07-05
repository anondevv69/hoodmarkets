/** Client-side check before calling deploy preview / deploy (wallet address only). */
export function looksLikeFeeRecipientInput(raw: string): boolean {
  const t = raw.trim();
  return /^0x[a-fA-F0-9]{40}$/i.test(t);
}
