/**
 * Telegram bot deep links + DexScreener for a Base token (same pattern as the web app).
 */

function tokenLowerHex(address: string): string {
  const t = address.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(t)) return t.toLowerCase();
  return t;
}

export function telegramTradeLinks(tokenAddress: string): {
  dexscreener: string;
  gmgn: string;
  sigma: string;
  basebot: string;
} {
  const a = tokenLowerHex(tokenAddress);
  return {
    dexscreener: `https://dexscreener.com/base/${a}`,
    gmgn: `https://t.me/GMGN_swap_bot?start=i_infobot_c_${a}`,
    sigma: `https://t.me/Sigma_buyBot?start=xinfo-${a}`,
    basebot: `https://t.me/based_eth_bot?start=r_infobot_b_${a}`,
  };
}
