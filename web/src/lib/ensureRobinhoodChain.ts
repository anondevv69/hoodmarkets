import { robinhood, ROBINHOOD_CHAIN_ID } from '../chain';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

/** Prompt MetaMask (etc.) to add Robinhood Chain — avoids "Unrecognized chain ID 0x1237". */
export async function ensureRobinhoodChainInWallet(
  ethereum: EthereumProvider | undefined,
): Promise<void> {
  if (!ethereum) return;

  const chainIdHex = `0x${ROBINHOOD_CHAIN_ID.toString(16)}`;

  try {
    const current = (await ethereum.request({ method: 'eth_chainId' })) as string;
    if (current?.toLowerCase() === chainIdHex.toLowerCase()) return;
  } catch {
    // continue to add/switch
  }

  try {
    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: chainIdHex,
          chainName: robinhood.name,
          nativeCurrency: robinhood.nativeCurrency,
          rpcUrls: robinhood.rpcUrls.default.http,
          blockExplorerUrls: [robinhood.blockExplorers!.default.url],
        },
      ],
    });
  } catch {
    // user rejected or wallet already knows the chain
  }

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch {
    // non-fatal — deploy is server-side; chain only needed for wallet UX
  }
}
