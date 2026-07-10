import { getAccount, signMessage } from '@wagmi/core';
import type { Address } from 'viem';
import { wagmiConfig } from '../wagmi';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isWalletUserRejection(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /reject|denied|cancel|declined/i.test(msg);
}

function isTransientConnectorError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /connector not connected|unavailable while reconnecting/i.test(msg);
}

/** Wait until wagmi reports the expected wallet is connected and ready to sign. */
export async function waitForWalletReady(walletAddress: string, timeoutMs = 30_000): Promise<void> {
  const expected = walletAddress.toLowerCase();
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const account = getAccount(wagmiConfig);
    if (account.status === 'reconnecting' || account.status === 'connecting') {
      await delay(100);
      continue;
    }
    if (
      account.status === 'connected' &&
      account.address?.toLowerCase() === expected &&
      account.connector
    ) {
      return;
    }
    await delay(100);
  }

  throw new Error('Wallet connection timed out. Click Connect wallet to try again.');
}

const RETRY_DELAYS_MS = [0, 200, 400, 700, 1100, 1600];

/** Sign immediately — caller must ensure the wallet connector is ready first. */
export async function signWalletMessageNow(
  walletAddress: string,
  message: string,
): Promise<string> {
  let lastError: unknown;
  for (const waitMs of RETRY_DELAYS_MS) {
    if (waitMs > 0) await delay(waitMs);
    try {
      return await signMessage(wagmiConfig, {
        message,
        account: walletAddress as Address,
      });
    } catch (error) {
      lastError = error;
      if (isWalletUserRejection(error)) throw error;
      if (!isTransientConnectorError(error)) throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Wallet connector not ready. Click Connect wallet to try again.');
}

/** Sign a login challenge after wagmi connector is fully ready (retries transient connector races). */
export async function signWalletLoginMessage(
  walletAddress: string,
  message: string,
): Promise<string> {
  await waitForWalletReady(walletAddress);
  return signWalletMessageNow(walletAddress, message);
}
