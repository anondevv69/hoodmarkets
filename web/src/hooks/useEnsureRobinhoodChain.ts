import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect } from 'react';
import { ensureRobinhoodChainInWallet } from '../lib/ensureRobinhoodChain';

/** After Privy connects an external wallet, register Robinhood Chain (4663) in MetaMask. */
export function useEnsureRobinhoodChain(): void {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();

  useEffect(() => {
    if (!authenticated || wallets.length === 0) return;

    const wallet = wallets[0];
    if (wallet.walletClientType === 'privy') return;

    void wallet.getEthereumProvider().then((provider) => {
      void ensureRobinhoodChainInWallet(provider as Parameters<typeof ensureRobinhoodChainInWallet>[0]);
    });
  }, [authenticated, wallets]);
}
