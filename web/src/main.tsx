import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, lightTheme, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import App from './App';
import { WebAuthProvider } from './auth/WebAuthContext';
import { wagmiConfig } from './wagmi';
import { initTheme } from './lib/theme';
import './index.css';

initTheme();

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={{
            lightMode: lightTheme({
              accentColor: '#CCFF00',
              accentColorForeground: '#110E08',
              borderRadius: 'medium',
            }),
            darkMode: darkTheme({
              accentColor: '#CCFF00',
              accentColorForeground: '#110E08',
              borderRadius: 'medium',
            }),
          }}
          modalSize="compact"
        >
          <WebAuthProvider>
            <App />
          </WebAuthProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
