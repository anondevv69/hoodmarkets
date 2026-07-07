import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { robinhood } from './chain';

const projectId =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.trim() ||
  '00000000000000000000000000000000';

export const wagmiConfig = getDefaultConfig({
  appName: 'hood.markets',
  projectId,
  chains: [robinhood],
  ssr: false,
});
