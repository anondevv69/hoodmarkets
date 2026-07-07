/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_IPFS_GATEWAY_URL?: string;
  readonly VITE_ROBINHOOD_TRADES_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
