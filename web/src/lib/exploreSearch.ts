/** Pull a 0x contract from pasted search text. */
export function extractContractAddressFromSearch(raw: string): string | null {
  const m = raw.trim().match(/0x[a-fA-F0-9]{40}/);
  return m ? m[0].toLowerCase() : null;
}

/** True when the query is clearly an address fragment (partial paste). */
export function looksLikeAddressSearch(raw: string): boolean {
  const t = raw.trim();
  return /^0x[a-fA-F0-9]{6,}$/i.test(t);
}
