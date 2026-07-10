import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  formatUnits,
  getAddress,
  parseEther,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { robinhood } from '../chain';
import { parseHumanTokenAmount } from './formatTokenBalance';

/** Uniswap V3 SwapRouter02 on Robinhood Chain mainnet. */
export const ROBINHOOD_V3_SWAP_ROUTER =
  '0xCaf681a66D020601342297493863E78C959E5cb2' as const;

export const ROBINHOOD_WETH = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' as const;

/** HoodMarkets V3 pools use 1% fee tier. */
export const HOODMARKETS_V3_POOL_FEE = 10_000;

const swapRouter02Abi = [
  {
    type: 'function',
    name: 'exactInputSingle',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'multicall',
    stateMutability: 'payable',
    inputs: [{ name: 'data', type: 'bytes[]' }],
    outputs: [{ name: 'results', type: 'bytes[]' }],
  },
  {
    type: 'function',
    name: 'unwrapWETH9',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountMinimum', type: 'uint256' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [],
  },
] as const;

function walletClients(walletProvider: unknown, account: `0x${string}`) {
  const transport = custom(walletProvider as Parameters<typeof custom>[0]);
  const publicClient = createPublicClient({ chain: robinhood, transport });
  const walletClient = createWalletClient({ account, chain: robinhood, transport });
  return { publicClient, walletClient };
}

async function tokenDecimals(publicClient: PublicClient, token: `0x${string}`): Promise<number> {
  try {
    const d = await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'decimals',
    });
    return Number(d);
  } catch {
    return 18;
  }
}

export type V3SwapResult = {
  swapTxHash: Hex;
  amountOut: string;
};

/** ETH → HoodMarkets V3 token via Uniswap V3 SwapRouter02. */
export async function swapEthForV3Token(opts: {
  tokenAddress: string;
  amountEth: string;
  walletProvider: unknown;
  account: `0x${string}`;
  amountOutMinimum?: bigint;
}): Promise<V3SwapResult> {
  const amountInWei = parseEther(opts.amountEth);
  if (amountInWei <= 0n) throw new Error('Enter an ETH amount greater than zero.');

  const token = getAddress(opts.tokenAddress);
  const { publicClient, walletClient } = walletClients(opts.walletProvider, opts.account);
  const balanceBefore = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [opts.account],
  });

  const hash = await walletClient.writeContract({
    address: ROBINHOOD_V3_SWAP_ROUTER,
    abi: swapRouter02Abi,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: ROBINHOOD_WETH,
        tokenOut: token,
        fee: HOODMARKETS_V3_POOL_FEE,
        recipient: opts.account,
        amountIn: amountInWei,
        amountOutMinimum: opts.amountOutMinimum ?? 1n,
        sqrtPriceLimitX96: 0n,
      },
    ],
    value: amountInWei,
    chain: robinhood,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  const balanceAfter = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [opts.account],
  });
  const received = balanceAfter - balanceBefore;
  if (received <= 0n) {
    throw new Error('Swap confirmed but no tokens arrived. Try a smaller amount.');
  }

  const decimals = await tokenDecimals(publicClient, token);
  return {
    swapTxHash: hash,
    amountOut: formatUnits(received, decimals),
  };
}

/** HoodMarkets V3 token → ETH via Uniswap V3 SwapRouter02 (unwraps WETH). */
export async function swapV3TokenForEth(opts: {
  tokenAddress: string;
  amountTokens: string;
  walletProvider: unknown;
  account: `0x${string}`;
}): Promise<V3SwapResult> {
  const token = getAddress(opts.tokenAddress);
  const { publicClient, walletClient } = walletClients(opts.walletProvider, opts.account);
  const decimals = await tokenDecimals(publicClient, token);
  const amountIn = parseHumanTokenAmount(opts.amountTokens, decimals);
  if (amountIn <= 0n) throw new Error('Enter a token amount greater than zero.');

  const balance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [opts.account],
  });
  if (balance < amountIn) throw new Error('Insufficient token balance.');

  const allowance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [opts.account, ROBINHOOD_V3_SWAP_ROUTER],
  });
  if (allowance < amountIn) {
    const approveHash = await walletClient.writeContract({
      address: token,
      abi: erc20Abi,
      functionName: 'approve',
      args: [ROBINHOOD_V3_SWAP_ROUTER, amountIn],
      chain: robinhood,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const ethBefore = await publicClient.getBalance({ address: opts.account });
  const swapData = encodeFunctionData({
    abi: swapRouter02Abi,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: token,
        tokenOut: ROBINHOOD_WETH,
        fee: HOODMARKETS_V3_POOL_FEE,
        recipient: ROBINHOOD_V3_SWAP_ROUTER,
        amountIn,
        amountOutMinimum: 1n,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  const unwrapData = encodeFunctionData({
    abi: swapRouter02Abi,
    functionName: 'unwrapWETH9',
    args: [0n, opts.account],
  });

  const hash = await walletClient.writeContract({
    address: ROBINHOOD_V3_SWAP_ROUTER,
    abi: swapRouter02Abi,
    functionName: 'multicall',
    args: [[swapData, unwrapData]],
    chain: robinhood,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  const ethAfter = await publicClient.getBalance({ address: opts.account });
  const received = ethAfter - ethBefore;
  if (received <= 0n) {
    throw new Error('Swap confirmed but no ETH arrived. Try a smaller amount.');
  }

  return {
    swapTxHash: hash,
    amountOut: formatEther(received),
  };
}

export function uniswapBuyUrl(tokenAddress: string, ethAmount?: string): string {
  const addr = getAddress(tokenAddress.trim());
  const base = `https://app.uniswap.org/swap?chain=robinhood&outputCurrency=${addr}&inputCurrency=NATIVE`;
  const amt = ethAmount?.trim();
  if (amt && /^\d+(\.\d+)?$/.test(amt)) return `${base}&exactAmount=${amt}`;
  return base;
}

export function uniswapSellUrl(tokenAddress: string): string {
  const addr = getAddress(tokenAddress.trim());
  return `https://app.uniswap.org/swap?chain=robinhood&inputCurrency=${addr}&outputCurrency=NATIVE`;
}
