import { robinhood, ROBINHOOD_CHAIN_ID } from '../chain';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function isUnknownChainError(error: unknown): boolean {
  const code = (error as { code?: number })?.code;
  return code === 4902;
}

/** Prompt MetaMask (etc.) to switch to Robinhood Chain — only when an on-chain action needs it. */
export async function ensureRobinhoodChainInWallet(
  ethereum: EthereumProvider | undefined,
): Promise<void> {
  if (!ethereum) return;

  const chainIdHex = `0x${ROBINHOOD_CHAIN_ID.toString(16)}`;

  try {
    const current = (await ethereum.request({ method: 'eth_chainId' })) as string;
    if (current?.toLowerCase() === chainIdHex.toLowerCase()) return;
  } catch {
    // continue to switch/add
  }

  const addChain = () =>
    ethereum.request({
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

  const switchChain = () =>
    ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });

  try {
    await switchChain();
    return;
  } catch (error) {
    if (!isUnknownChainError(error)) return;
  }

  try {
    await addChain();
    await switchChain();
  } catch {
    // user rejected or wallet already on the chain
  }
}
