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
import { API_BASE } from '../api';
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
    name: 'exactInput',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'path', type: 'bytes' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
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

function encodeV3Path(tokens: readonly `0x${string}`[], fees: readonly number[]): Hex {
  if (tokens.length !== fees.length + 1) {
    throw new Error('Invalid V3 path encoding.');
  }
  let path = '';
  for (let i = 0; i < fees.length; i++) {
    path += tokens[i]!.slice(2).toLowerCase();
    path += fees[i]!.toString(16).padStart(6, '0');
  }
  path += tokens[tokens.length - 1]!.slice(2).toLowerCase();
  return `0x${path}` as Hex;
}

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
  quoteToken?: `0x${string}`;
  wethHopPoolFee?: number;
}): Promise<V3SwapResult> {
  const amountInWei = parseEther(opts.amountEth);
  if (amountInWei <= 0n) throw new Error('Enter an ETH amount greater than zero.');

  const token = getAddress(opts.tokenAddress);
  const weth = getAddress(ROBINHOOD_WETH);
  const quote = opts.quoteToken ? getAddress(opts.quoteToken) : weth;
  const isWethQuote = quote.toLowerCase() === weth.toLowerCase();
  const hopFee = opts.wethHopPoolFee ?? HOODMARKETS_V3_POOL_FEE;
  const { publicClient, walletClient } = walletClients(opts.walletProvider, opts.account);
  const balanceBefore = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [opts.account],
  });

  const hash = isWethQuote
    ? await walletClient.writeContract({
        address: ROBINHOOD_V3_SWAP_ROUTER,
        abi: swapRouter02Abi,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn: weth,
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
      })
    : await walletClient.writeContract({
        address: ROBINHOOD_V3_SWAP_ROUTER,
        abi: swapRouter02Abi,
        functionName: 'exactInput',
        args: [
          {
            path: encodeV3Path([weth, quote, token], [hopFee, HOODMARKETS_V3_POOL_FEE]),
            recipient: opts.account,
            amountIn: amountInWei,
            amountOutMinimum: opts.amountOutMinimum ?? 1n,
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
  quoteToken?: `0x${string}`;
  wethHopPoolFee?: number;
}): Promise<V3SwapResult> {
  const token = getAddress(opts.tokenAddress);
  const quote = opts.quoteToken ? getAddress(opts.quoteToken) : getAddress(ROBINHOOD_WETH);
  const weth = getAddress(ROBINHOOD_WETH);
  const isWethQuote = quote.toLowerCase() === weth.toLowerCase();
  const hopFee = opts.wethHopPoolFee ?? HOODMARKETS_V3_POOL_FEE;
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

  let hash: Hex;
  if (isWethQuote) {
    const swapData = encodeFunctionData({
      abi: swapRouter02Abi,
      functionName: 'exactInputSingle',
      args: [
        {
          tokenIn: token,
          tokenOut: weth,
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
    hash = await walletClient.writeContract({
      address: ROBINHOOD_V3_SWAP_ROUTER,
      abi: swapRouter02Abi,
      functionName: 'multicall',
      args: [[swapData, unwrapData]],
      chain: robinhood,
    });
  } else {
    const swapData = encodeFunctionData({
      abi: swapRouter02Abi,
      functionName: 'exactInput',
      args: [
        {
          path: encodeV3Path([token, quote, weth], [HOODMARKETS_V3_POOL_FEE, hopFee]),
          recipient: ROBINHOOD_V3_SWAP_ROUTER,
          amountIn,
          amountOutMinimum: 1n,
        },
      ],
    });
    const unwrapData = encodeFunctionData({
      abi: swapRouter02Abi,
      functionName: 'unwrapWETH9',
      args: [0n, opts.account],
    });
    hash = await walletClient.writeContract({
      address: ROBINHOOD_V3_SWAP_ROUTER,
      abi: swapRouter02Abi,
      functionName: 'multicall',
      args: [[swapData, unwrapData]],
      chain: robinhood,
    });
  }

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

export type V3SimpleSwapConfig = {
  quoteToken: `0x${string}`;
  quoteTokenSymbol: string;
  isWethQuote: boolean;
  wethHopPoolFee: number;
};

export async function fetchV3SimpleSwapConfig(tokenAddress: string): Promise<V3SimpleSwapConfig> {
  const res = await fetch(`${API_BASE}/api/tokens/${tokenAddress}/swap-config`);
  const data = (await res.json()) as {
    quoteToken?: string;
    quoteTokenSymbol?: string;
    isWethQuote?: boolean;
    hoodmarketsPoolFee?: number;
    wethHopPoolFee?: number;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || 'Failed to load swap config.');
  const quote = getAddress((data.quoteToken ?? ROBINHOOD_WETH) as `0x${string}`);
  return {
    quoteToken: quote,
    quoteTokenSymbol: data.quoteTokenSymbol?.trim() || 'WETH',
    isWethQuote: data.isWethQuote ?? quote.toLowerCase() === ROBINHOOD_WETH.toLowerCase(),
    wethHopPoolFee: data.wethHopPoolFee ?? 10_000,
  };
}
