import {
  createWalletClient,
  custom,
  encodeAbiParameters,
  encodePacked,
  getAddress,
  parseEther,
  toHex,
  type Hex,
} from 'viem';
import { robinhood } from '../chain';
import { API_BASE } from '../api';

/** Universal Router command bytes (Uniswap v4). */
const CMD_WRAP_ETH = 0x0b;
const CMD_V4_SWAP = 0x10;

const ACTION_SWAP_EXACT_IN_SINGLE = 0x06;
const ACTION_SETTLE_ALL = 0x0c;
const ACTION_TAKE_ALL = 0x0f;

/** Sentinel: keep wrapped ETH on the router for the next command. */
const ADDRESS_THIS = '0x0000000000000000000000000000000000000002' as const;

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
  zeroForOne: boolean;
  pairedToken: `0x${string}`;
}

export async function fetchTokenSwapConfig(tokenAddress: string): Promise<TokenSwapConfig> {
  const res = await fetch(`${API_BASE}/api/tokens/${tokenAddress}/swap-config`);
  const data = (await res.json()) as TokenSwapConfig & { error?: string };
  if (!res.ok) throw new Error(data.error || 'Failed to load swap config');
  return data;
}

function encodeV4EthToTokenSwap(
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

  const wrapInput = encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }],
    [ADDRESS_THIS, amountInWei],
  );

  return {
    commands: toHex(Uint8Array.from([CMD_WRAP_ETH, CMD_V4_SWAP])),
    inputs: [wrapInput, v4Input],
  };
}

export async function swapEthForHoodmarketsToken(opts: {
  config: TokenSwapConfig;
  amountEth: string;
  walletProvider: unknown;
  account: `0x${string}`;
}): Promise<Hex> {
  const amountInWei = parseEther(opts.amountEth);
  if (amountInWei <= 0n) throw new Error('Enter an ETH amount greater than zero.');

  const { commands, inputs } = encodeV4EthToTokenSwap(opts.config, amountInWei);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

  const client = createWalletClient({
    account: opts.account,
    chain: robinhood,
    transport: custom(opts.walletProvider as Parameters<typeof custom>[0]),
  });

  return client.writeContract({
    chain: robinhood,
    address: getAddress(opts.config.universalRouter),
    abi: universalRouterAbi,
    functionName: 'execute',
    args: [commands, inputs, deadline],
    value: amountInWei,
  });
}
