import crypto from 'crypto';
import { getAddress, type Address } from 'viem';
import { buildWebWalletLoginMessage, parseWebWalletLoginMessage } from './webWalletMessages.js';

const TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

/** Replay guard — keyed by nonce, value is expiry timestamp. */
const consumedNonces = new Map<string, number>();

function purgeConsumedNonces(): void {
  const now = Date.now();
  for (const [nonce, expiresAt] of consumedNonces) {
    if (expiresAt <= now) consumedNonces.delete(nonce);
  }
}

export function createWebWalletChallenge(walletAddress: string): {
  message: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
} {
  let addr: Address;
  try {
    addr = getAddress(walletAddress);
  } catch {
    throw new Error('walletAddress must be a valid 0x address.');
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  const issuedAt = new Date().toISOString();
  const expiresAt = Date.now() + TTL_MS;

  const message = buildWebWalletLoginMessage({ walletAddress: addr, nonce, issuedAt });
  return { message, nonce, issuedAt, expiresAt: new Date(expiresAt).toISOString() };
}

export function consumeWebWalletChallenge(
  walletAddress: string,
  message: string,
): { walletAddress: Address } {
  purgeConsumedNonces();

  let addr: Address;
  try {
    addr = getAddress(walletAddress);
  } catch {
    throw new Error('walletAddress must be a valid 0x address.');
  }

  const parsed = parseWebWalletLoginMessage(message);
  if (!parsed) {
    throw new Error('Invalid login message format.');
  }
  if (parsed.walletAddress.toLowerCase() !== addr.toLowerCase()) {
    throw new Error('Signed message wallet does not match the login request.');
  }

  const issuedMs = Date.parse(parsed.issuedAt);
  if (!Number.isFinite(issuedMs)) {
    throw new Error('Login challenge has an invalid issue time.');
  }

  const ageMs = Date.now() - issuedMs;
  if (ageMs > TTL_MS) {
    throw new Error('Login challenge expired. Request a new challenge.');
  }
  if (ageMs < -CLOCK_SKEW_MS) {
    throw new Error('Login challenge is not valid yet. Request a new challenge.');
  }

  const expected = buildWebWalletLoginMessage({
    walletAddress: parsed.walletAddress,
    nonce: parsed.nonce,
    issuedAt: parsed.issuedAt,
  });
  if (message.trim() !== expected) {
    throw new Error('Signed message does not match the active login challenge.');
  }

  if (consumedNonces.has(parsed.nonce)) {
    throw new Error('Login challenge already used. Request a new challenge.');
  }
  consumedNonces.set(parsed.nonce, issuedMs + TTL_MS);

  return { walletAddress: addr };
}
