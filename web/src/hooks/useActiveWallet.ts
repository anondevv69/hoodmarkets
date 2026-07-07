import { useAccount } from 'wagmi';
import { useWebAuth } from '../auth/WebAuthContext';

export type ActiveWallet = {
  address: string;
  getEthereumProvider: () => Promise<unknown>;
};

/** Connected wallet for on-chain actions (swap, deploy seed, fraction ops). */
export function useActiveWallet(): ActiveWallet | null {
  const { authenticated, walletAddress } = useWebAuth();
  const { address, isConnected } = useAccount();

  if (!authenticated || !walletAddress) return null;

  const activeAddress = isConnected && address ? address : walletAddress;

  return {
    address: activeAddress,
    getEthereumProvider: async () => {
      const eth = (window as { ethereum?: unknown }).ethereum;
      if (!eth) {
        throw new Error('Connect a wallet in your browser to sign transactions.');
      }
      return eth;
    },
  };
}

export function useWebLogin() {
  const { authenticated, connectWallet } = useWebAuth();
  return { authenticated, login: connectWallet, connectWallet };
}
