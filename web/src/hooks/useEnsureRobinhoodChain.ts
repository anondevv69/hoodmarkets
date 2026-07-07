import { useEffect } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { robinhood } from '../chain';
import { ensureRobinhoodChainInWallet } from '../lib/ensureRobinhoodChain';

/** After Rainbow connects, register Robinhood Chain (4663) in the wallet. */
export function useEnsureRobinhoodChain(): void {
  const { isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  useEffect(() => {
    if (!isConnected) return;
    const eth = (window as { ethereum?: unknown }).ethereum;
    if (!eth) return;
    void ensureRobinhoodChainInWallet(eth as Parameters<typeof ensureRobinhoodChainInWallet>[0]);
    void switchChainAsync?.({ chainId: robinhood.id }).catch(() => undefined);
  }, [isConnected, switchChainAsync]);
}
