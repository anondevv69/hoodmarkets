import type { TokenDetail, TokenPageProfile } from '../api';

const API = 'https://api.hood.markets';
const WEB = 'https://hood.markets';
const CHAIN_ID = 4663;
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const V3_FACTORY = '0x9BDdC8ddf28f5629C989A36Eb5bb6C73cBA60Df5';

export type TokenWebsitePromptInput = {
  token: TokenDetail;
  profile?: TokenPageProfile | null;
};

/** Build a paste-ready prompt for Claude / Cursor / Grok to scaffold a token landing page. */
export function buildTokenWebsitePrompt(input: TokenWebsitePromptInput): string {
  const { token, profile } = input;
  const sym = token.tokenSymbol.replace(/^\$/, '');
  const tokenPage = `${WEB}/?token=${token.tokenAddress}`;
  const imageUrl =
    profile?.displayImageUrl?.trim() ||
    token.tokenImageUrl?.trim() ||
    '';
  const bannerUrl =
    profile?.displayBannerUrl?.trim() ||
    token.tokenBannerUrl?.trim() ||
    '';
  const description =
    profile?.description?.trim() ||
    token.tokenDescription?.trim() ||
    '';
  const website =
    profile?.websiteUrl?.trim() || token.tokenWebsiteUrl?.trim() || '';
  const xUrl = profile?.xUrl?.trim() || token.tokenXUrl?.trim() || '';
  const telegram = profile?.telegramUrl?.trim() || '';
  const discord = profile?.discordUrl?.trim() || '';
  const github = profile?.githubUrl?.trim() || '';

  const lines: string[] = [
    `Build a polished single-page marketing website for my hood.markets token.`,
    ``,
    `## Token (use these exact values)`,
    `- Name: ${token.tokenName}`,
    `- Symbol: $${sym}`,
    `- Contract: ${token.tokenAddress}`,
    `- Chain: Robinhood Chain (chain ID ${CHAIN_ID})`,
    `- Fee recipient: ${token.feeRecipientAddress}`,
    `- Canonical hood.markets page: ${tokenPage}`,
    `- Explorer: https://robinhoodchain.blockscout.com/token/${token.tokenAddress}`,
    `- DexScreener: https://dexscreener.com/robinhood/${token.tokenAddress}`,
    `- Uniswap: https://app.uniswap.org/swap?chain=robinhood&outputCurrency=${token.tokenAddress}`,
  ];

  if (imageUrl) lines.push(`- Token icon / logo URL: ${imageUrl}`);
  if (bannerUrl) lines.push(`- Banner / hero image URL: ${bannerUrl}`);
  if (description) lines.push(`- Description: ${description}`);
  if (website) lines.push(`- Project website: ${website}`);
  if (xUrl) lines.push(`- X / Twitter: ${xUrl}`);
  if (telegram) lines.push(`- Telegram: ${telegram}`);
  if (discord) lines.push(`- Discord: ${discord}`);
  if (github) lines.push(`- GitHub: ${github}`);
  if (profile?.verified) lines.push(`- Verified on hood.markets: yes`);

  lines.push(
    ``,
    `## Design`,
    `- One composition first viewport: brand/name as hero, one short headline, one CTA (Buy / Trade), full-bleed banner if available.`,
    `- Use the icon and banner URLs above as real assets (do not invent placeholder art).`,
    `- Mobile-friendly. Avoid generic purple AI gradients and card clutter.`,
    `- Sections after hero: About, Holder NFTs (shares for sale / burned / rewards), Market stats, Links.`,
    ``,
    `## Live data — call these public APIs (no auth)`,
    `Base: ${API}`,
    ``,
    `1. Catalog (name, image, fee recipient, launch meta):`,
    `   GET ${API}/api/deployments/${token.tokenAddress}`,
    ``,
    `2. Profile (description, socials, displayImageUrl, displayBannerUrl, verified):`,
    `   GET ${API}/api/tokens/${token.tokenAddress}/profile`,
    ``,
    `3. Market stats (mcap, price, liquidity, volume):`,
    `   GET ${API}/api/tokens/${token.tokenAddress}/market-stats`,
    ``,
    `4. Buyer rewards (enabled, remaining shares, issued):`,
    `   GET ${API}/api/deployments/${token.tokenAddress}/buyer-rewards-status`,
    ``,
    `5. Discussion posts (optional):`,
    `   GET ${API}/api/token-spaces/${token.tokenAddress}/posts?limit=20`,
    ``,
    `6. Recent trades (optional):`,
    `   GET ${API}/api/tokens/${token.tokenAddress}/trades`,
    ``,
    `Prefer server-side or build-time fetch if browser CORS blocks a third-party origin.`,
    ``,
    `## Holder NFTs (on-chain — no REST yet)`,
    `Robinhood RPC: ${RPC}`,
    `V3 factory: ${V3_FACTORY}`,
    ``,
    `1. Read fractionCollectionForToken(${token.tokenAddress}) on the factory → Holder NFT (ERC-1155) collection.`,
    `2. From the collection, show:`,
    `   - Total shares (usually 1000) and outstandingShares`,
    `   - Burned / redeemed ≈ total − outstanding (or redeemedShares if available)`,
    `   - Active marketplace listings via nextListingId + listings(id) (listShares / buyShares)`,
    `   - Buyer reward pool remaining (or use buyer-rewards-status API above)`,
    `3. Deep-link users to trade shares on: ${tokenPage}`,
    ``,
    `## CTAs`,
    `- Primary: Buy / Trade on Uniswap (link above)`,
    `- Secondary: Open on hood.markets (${tokenPage}) and DexScreener`,
    `- Optional: Claim trading fees / Holder NFT actions → hood.markets token page`,
    ``,
    `## Output`,
    `Ship a working static or Next/Vite site. Fetch live data on load. Use the real icon and banner URLs.`,
    `Do not invent fake mcap, holders, or listings — pull from the APIs / RPC above.`,
  );

  return lines.join('\n');
}
