import { PrivyProvider } from '@privy-io/react-auth';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { robinhood } from './chain';
import './index.css';

const appId = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;
if (!appId) {
  console.warn('VITE_PRIVY_APP_ID is not set — Privy login will not work.');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId={appId || 'missing-privy-app-id'}
      config={{
        defaultChain: robinhood,
        supportedChains: [robinhood],
        appearance: {
          theme: 'dark',
          accentColor: '#00c805',
          walletList: ['metamask', 'detected_ethereum_wallets', 'wallet_connect'],
          walletChainType: 'ethereum-only',
        },
        loginMethods: ['wallet', 'twitter', 'discord', 'github'],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>,
);
