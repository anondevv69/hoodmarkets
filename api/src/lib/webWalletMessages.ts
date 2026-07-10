import { getAddress, type Address } from 'viem';
import { ROBINHOOD_CHAIN_ID } from './robinhoodChain.js';

/** EIP-191 message users sign to obtain a hood.markets web session (Rainbow, Bankr, etc.). */
export function buildWebWalletLoginMessage(params: {
  walletAddress: Address;
  nonce: string;
  issuedAt: string;
}): string {
  const addr = getAddress(params.walletAddress);
  return [
    'hoodmarkets wallet login',
    `Robinhood Chain ID: ${ROBINHOOD_CHAIN_ID}`,
    `Wallet: ${addr}`,
    `Nonce: ${params.nonce}`,
    `Issued: ${params.issuedAt}`,
  ].join('\n');
}

export function parseWebWalletLoginMessage(message: string): {
  walletAddress: Address;
  nonce: string;
  issuedAt: string;
} | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith('hoodmarkets wallet login')) return null;

  let wallet: string | undefined;
  let nonce: string | undefined;
  let issuedAt: string | undefined;
  for (const line of trimmed.split('\n')) {
    if (line.startsWith('Wallet: ')) wallet = line.slice('Wallet: '.length).trim();
    else if (line.startsWith('Nonce: ')) nonce = line.slice('Nonce: '.length).trim();
    else if (line.startsWith('Issued: ')) issuedAt = line.slice('Issued: '.length).trim();
  }
  if (!wallet || !nonce || !issuedAt) return null;
  try {
    return { walletAddress: getAddress(wallet), nonce, issuedAt };
  } catch {
    return null;
  }
}

export function webWalletDeployerId(walletAddress: Address): string {
  return `web-wallet:${getAddress(walletAddress).toLowerCase()}`;
}
