/**
 * Third-party trading bots / terminals (hood.markets referral slugs).
 * Link shapes follow NOXA Fun / each platform’s documented deep-link format.
 */

export interface ExternalTradeBotLink {
  id: 'basedBot' | 'maestro' | 'gmgn' | 'sigma' | 'fomo';
  label: string;
  href: string;
  logoSrc: string;
}

/** hood.markets partner slug on Based Bot (`r_{slug}_b_{token}`). */
const BASED_BOT_REF = 'hoodmarket';

/** Maestro suffix (`{token}-{slug}`), same pattern as NOXA’s `-noxafi`. */
const MAESTRO_REF = 'hoodmarkets';

/** Sigma partner ref (`ref=hoodmarkets`); token appended per NOXA `xnoxafi-{token}` style. */
const SIGMA_REF = 'hoodmarkets';

/** GMGN referral code (web + bot). */
const GMGN_REF = 'hood004';

function tokenLowerHex(address: string): string {
  return address.trim().toLowerCase();
}

export function buildExternalTradeBotLinks(tokenAddress: string): ExternalTradeBotLink[] {
  const token = tokenLowerHex(tokenAddress);

  return [
    {
      id: 'basedBot',
      label: 'Based Bot',
      logoSrc: '/trade-bots/based-bot.png',
      href: `https://t.me/based_eth_bot?start=r_${BASED_BOT_REF}_b_${token}`,
    },
    {
      id: 'maestro',
      label: 'Maestro',
      logoSrc: '/trade-bots/maestro.png',
      href: `https://t.me/maestro?start=${token}-${MAESTRO_REF}`,
    },
    {
      id: 'gmgn',
      label: 'GMGN',
      logoSrc: '/trade-bots/gmgn.png',
      href: `https://gmgn.ai/robinhood/token/${GMGN_REF}_${token}`,
    },
    {
      id: 'sigma',
      label: 'Sigma',
      logoSrc: '/trade-bots/sigma.png',
      href: `https://t.me/Sigma_buyBot?start=ref=${SIGMA_REF}-${token}`,
    },
    {
      id: 'fomo',
      label: 'fomo',
      logoSrc: '/trade-bots/fomo.png',
      href: `https://fomo.family/tokens/robinhood/${token}`,
    },
  ];
}
