import { defineChain } from 'viem';

export const ROBINHOOD_CHAIN_ID = 4663;

export const ROBINHOOD_EXPLORER = 'https://robinhoodchain.blockscout.com';

export const robinhood = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.chain.robinhood.com'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: ROBINHOOD_EXPLORER },
  },
});

export function tokenUrl(address: string): string {
  return `${ROBINHOOD_EXPLORER}/token/${address}`;
}

export function addressUrl(address: string): string {
  return `${ROBINHOOD_EXPLORER}/address/${address}`;
}

export function txUrl(hash: string): string {
  return `${ROBINHOOD_EXPLORER}/tx/${hash}`;
}

export function shortenAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
