import type { ConnectedWallet } from '@privy-io/react-auth';

/** Prefer the Privy embedded wallet used for hood.markets deploys and fee claims. */
export function pickPrivyEmbeddedWallet(
  wallets: ConnectedWallet[],
): ConnectedWallet | undefined {
  const embedded = wallets.find((w) => w.walletClientType === 'privy');
  return embedded ?? wallets[0];
}
