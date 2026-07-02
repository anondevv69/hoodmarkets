import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  erc20Abi,
  getAddress,
  parseEther,
  toHex,
  type Hex,
} from 'viem';
import { robinhood } from '../chain';
import { API_BASE } from '../api';

/** Universal Router — V4_SWAP only (WETH must be deposited + Permit2-approved first). */
const CMD_V4_SWAP = 0x10;

const ACTION_SWAP_EXACT_IN_SINGLE = 0x06;
const ACTION_SETTLE_ALL = 0x0c;
const ACTION_TAKE_ALL = 0x0f;

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

const wethAbi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  ...erc20Abi,
] as const;

const permit2Abi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
    ],
    outputs: [],
  },
] as const;

const universalRouterAbi = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'payable',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

const multicall3Abi = [
  {
    type: 'function',
    name: 'aggregate3Value',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'value', type: 'uint256' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple[]',
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
      },
    ],
  },
] as const;

export interface HoodmarketsPoolKey {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
}

export interface TokenSwapConfig {
  chainId: number;
  tokenAddress: `0x${string}`;
  poolId?: string;
  poolKey: HoodmarketsPoolKey;
  weth: `0x${string}`;
  universalRouter: `0x${string}`;
  permit2: `0x${string}`;
  zeroForOne: boolean;
  pairedToken: `0x${string}`;
}

export async function fetchTokenSwapConfig(tokenAddress: string): Promise<TokenSwapConfig> {
  const res = await fetch(`${API_BASE}/api/tokens/${tokenAddress}/swap-config`);
  const data = (await res.json()) as TokenSwapConfig & { error?: string };
  if (!res.ok) throw new Error(data.error || 'Failed to load swap config');
  if (!data.permit2) {
    throw new Error('Swap config missing Permit2 address.');
  }
  return data;
}

function encodeV4WethToTokenSwap(
  config: TokenSwapConfig,
  amountInWei: bigint,
  amountOutMinimum = 1n,
): { commands: Hex; inputs: Hex[] } {
  const weth = getAddress(config.weth);
  const token = getAddress(config.tokenAddress);
  const poolKey = {
    ...config.poolKey,
    currency0: getAddress(config.poolKey.currency0),
    currency1: getAddress(config.poolKey.currency1),
    hooks: getAddress(config.poolKey.hooks),
  };

  const swapParams = encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          {
            name: 'poolKey',
            type: 'tuple',
            components: [
              { name: 'currency0', type: 'address' },
              { name: 'currency1', type: 'address' },
              { name: 'fee', type: 'uint24' },
              { name: 'tickSpacing', type: 'int24' },
              { name: 'hooks', type: 'address' },
            ],
          },
          { name: 'zeroForOne', type: 'bool' },
          { name: 'amountIn', type: 'uint128' },
          { name: 'amountOutMinimum', type: 'uint128' },
          { name: 'hookData', type: 'bytes' },
        ],
      },
    ],
    [
      {
        poolKey,
        zeroForOne: config.zeroForOne,
        amountIn: amountInWei,
        amountOutMinimum,
        hookData: '0x',
      },
    ],
  );

  const actions = encodePacked(
    ['uint8', 'uint8', 'uint8'],
    [ACTION_SWAP_EXACT_IN_SINGLE, ACTION_SETTLE_ALL, ACTION_TAKE_ALL],
  );

  const params: Hex[] = [
    swapParams,
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      [weth, amountInWei],
    ),
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      [token, amountOutMinimum],
    ),
  ];

  const v4Input = encodeAbiParameters(
    [{ type: 'bytes' }, { type: 'bytes[]' }],
    [actions, params],
  );

  return {
    commands: toHex(Uint8Array.from([CMD_V4_SWAP])),
    inputs: [v4Input],
  };
}

function buildSwapMulticallData(
  config: TokenSwapConfig,
  amountInWei: bigint,
  deadline: bigint,
): { to: `0x${string}`; data: Hex; value: bigint } {
  const weth = getAddress(config.weth);
  const permit2 = getAddress(config.permit2);
  const router = getAddress(config.universalRouter);
  const expiry = Math.floor(Date.now() / 1000) + 60 * 20;

  const { commands, inputs } = encodeV4WethToTokenSwap(config, amountInWei);

  const depositData = encodeFunctionData({
    abi: wethAbi,
    functionName: 'deposit',
  });

  const approveErc20Data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [permit2, amountInWei],
  });

  const permit2ApproveData = encodeFunctionData({
    abi: permit2Abi,
    functionName: 'approve',
    args: [weth, router, amountInWei, expiry],
  });

  const executeData = encodeFunctionData({
    abi: universalRouterAbi,
    functionName: 'execute',
    args: [commands, inputs, deadline],
  });

  const calls = [
    { target: weth, allowFailure: false, value: amountInWei, callData: depositData },
    { target: weth, allowFailure: false, value: 0n, callData: approveErc20Data },
    { target: permit2, allowFailure: false, value: 0n, callData: permit2ApproveData },
    { target: router, allowFailure: false, value: 0n, callData: executeData },
  ] as const;

  const data = encodeFunctionData({
    abi: multicall3Abi,
    functionName: 'aggregate3Value',
    args: [calls],
  });

  return { to: MULTICALL3, data, value: amountInWei };
}

export async function swapEthForHoodmarketsToken(opts: {
  config: TokenSwapConfig;
  amountEth: string;
  walletProvider: unknown;
  account: `0x${string}`;
}): Promise<Hex> {
  const amountInWei = parseEther(opts.amountEth);
  if (amountInWei <= 0n) throw new Error('Enter an ETH amount greater than zero.');

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
  const batch = buildSwapMulticallData(opts.config, amountInWei, deadline);

  const transport = custom(opts.walletProvider as Parameters<typeof custom>[0]);
  const publicClient = createPublicClient({ chain: robinhood, transport });
  const walletClient = createWalletClient({
    account: opts.account,
    chain: robinhood,
    transport,
  });

  let gas: bigint | undefined;
  try {
    gas = await publicClient.estimateGas({
      account: opts.account,
      to: batch.to,
      data: batch.data,
      value: batch.value,
    });
    gas = (gas * 12n) / 10n;
  } catch {
    gas = 2_500_000n;
  }

  return walletClient.sendTransaction({
    chain: robinhood,
    to: batch.to,
    data: batch.data,
    value: batch.value,
    gas,
  });
}
