import { useAccount, useConnectorClient } from 'wagmi';
import { useWebAuth } from '../auth/WebAuthContext';

export type ActiveWallet = {
  address: string;
  getEthereumProvider: () => Promise<unknown>;
};

/** Connected wallet for on-chain actions (swap, deploy seed, fraction ops). */
export function useActiveWallet(): ActiveWallet | null {
  const { authenticated, walletAddress } = useWebAuth();
  const { address, isConnected, connector } = useAccount();
  const { data: connectorClient } = useConnectorClient();

  if (!authenticated || !walletAddress) return null;

  const activeAddress = isConnected && address ? address : walletAddress;

  return {
    address: activeAddress,
    getEthereumProvider: async () => {
      if (connector) {
        try {
          const provider = await connector.getProvider();
          if (provider) return provider;
        } catch {
          // fall through
        }
      }
      const transport = connectorClient?.transport as { value?: unknown } | undefined;
      if (transport?.value) return transport.value;
      const eth = (window as { ethereum?: unknown }).ethereum;
      if (eth) return eth;
      throw new Error('Connect a wallet in your browser to sign transactions.');
    },
  };
}

export function useWebLogin() {
  const { authenticated, connectWallet } = useWebAuth();
  return { authenticated, login: connectWallet, connectWallet };
}
