/** Client-side check before calling deploy preview / deploy. */
export function looksLikeFeeRecipientInput(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 3) return false;
  if (/^0x[a-fA-F0-9]{40}$/i.test(t)) return true;
  if (/^@?[a-zA-Z0-9_]{1,32}$/.test(t)) return true;
  if (
    /warpcast\.com|x\.com|twitter\.com|t\.me\/|github\.com|discord\.com\/users\//i.test(t)
  ) {
    return true;
  }
  return /0x[a-fA-F0-9]{40}/.test(t);
}
