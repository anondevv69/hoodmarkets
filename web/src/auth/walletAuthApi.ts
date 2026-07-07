import { API_BASE } from '../api';

export async function fetchWalletLoginChallenge(walletAddress: string): Promise<{
  message: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}> {
  const params = new URLSearchParams({ address: walletAddress });
  const res = await fetch(`${API_BASE}/api/wallet-auth/challenge?${params}`);
  const data = (await res.json()) as { error?: string; message?: string };
  if (!res.ok) throw new Error(data.error || 'Could not start wallet login.');
  if (!data.message) throw new Error('Invalid challenge response.');
  return data as { message: string; nonce: string; issuedAt: string; expiresAt: string };
}

export async function verifyWalletLogin(params: {
  walletAddress: string;
  message: string;
  signature: string;
  walletKind?: string;
}): Promise<{
  token: string;
  walletAddress: string;
  walletKind: string;
  expiresAt: string;
}> {
  const res = await fetch(`${API_BASE}/api/wallet-auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as {
    error?: string;
    token?: string;
    walletAddress?: string;
    walletKind?: string;
    expiresAt?: string;
  };
  if (!res.ok || !data.token) {
    throw new Error(data.error || 'Wallet login verification failed.');
  }
  return {
    token: data.token,
    walletAddress: data.walletAddress || params.walletAddress,
    walletKind: data.walletKind || params.walletKind || 'injected',
    expiresAt: data.expiresAt || '',
  };
}

export async function fetchBankrWalletAddress(apiKey: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/bankr/wallet/me`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Bankr-Api-Key': apiKey,
    },
    body: JSON.stringify({ apiKey }),
  });
  const data = (await res.json()) as { error?: string; address?: string };
  if (!res.ok || !data.address) {
    throw new Error(data.error || 'Could not load Bankr wallet.');
  }
  return data.address;
}

export async function signMessageWithBankr(apiKey: string, message: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/bankr/wallet/sign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Bankr-Api-Key': apiKey,
    },
    body: JSON.stringify({ message, apiKey }),
  });
  const data = (await res.json()) as { error?: string; signature?: string };
  if (!res.ok || !data.signature) {
    throw new Error(data.error || 'Bankr could not sign the login message.');
  }
  return data.signature;
}
