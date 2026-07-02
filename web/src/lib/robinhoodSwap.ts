import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeAbiParameters,
  encodePacked,
  erc20Abi,
  getAddress,
  parseEther,
  toHex,
  type Hex,
} from 'viem';
import { robinhood } from '../chain';
import { API_BASE } from '../api';

/** Universal Router — V4_SWAP only (WETH deposited on the user wallet first). */
const CMD_V4_SWAP = 0x10;

const ACTION_SWAP_EXACT_IN_SINGLE = 0x06;
const ACTION_SETTLE_ALL = 0x0c;
const ACTION_TAKE_ALL = 0x0f;

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

/** HoodMarketsHookV2 expects ABI-encoded PoolSwapData (empty bytes when not in sniper bid). */
function encodeHoodmarketsHookData(): Hex {
  return encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'mevModuleSwapData', type: 'bytes' },
          { name: 'poolExtensionSwapData', type: 'bytes' },
        ],
      },
    ],
    [{ mevModuleSwapData: '0x', poolExtensionSwapData: '0x' }],
  );
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
        hookData: encodeHoodmarketsHookData(),
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

async function waitForTx(
  publicClient: ReturnType<typeof createPublicClient>,
  hash: Hex,
): Promise<void> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (receipt.status !== 'success') {
    throw new Error(`Transaction reverted: ${hash}`);
  }
}

export async function swapEthForHoodmarketsToken(opts: {
  config: TokenSwapConfig;
  amountEth: string;
  walletProvider: unknown;
  account: `0x${string}`;
  onStep?: (step: number, total: number, label: string) => void;
}): Promise<Hex> {
  const amountInWei = parseEther(opts.amountEth);
  if (amountInWei <= 0n) throw new Error('Enter an ETH amount greater than zero.');

  const weth = getAddress(opts.config.weth);
  const permit2 = getAddress(opts.config.permit2);
  const router = getAddress(opts.config.universalRouter);
  const expiry = Math.floor(Date.now() / 1000) + 60 * 20;
  const deadline = BigInt(expiry);
  const { commands, inputs } = encodeV4WethToTokenSwap(opts.config, amountInWei);

  const transport = custom(opts.walletProvider as Parameters<typeof custom>[0]);
  const publicClient = createPublicClient({ chain: robinhood, transport });
  const walletClient = createWalletClient({
    account: opts.account,
    chain: robinhood,
    transport,
  });

  const steps = [
    { label: 'Wrap ETH to WETH', run: () =>
      walletClient.writeContract({
        chain: robinhood,
        address: weth,
        abi: wethAbi,
        functionName: 'deposit',
        value: amountInWei,
      }),
    },
    { label: 'Approve WETH for Permit2', run: () =>
      walletClient.writeContract({
        chain: robinhood,
        address: weth,
        abi: erc20Abi,
        functionName: 'approve',
        args: [permit2, amountInWei],
      }),
    },
    { label: 'Approve router on Permit2', run: () =>
      walletClient.writeContract({
        chain: robinhood,
        address: permit2,
        abi: permit2Abi,
        functionName: 'approve',
        args: [weth, router, amountInWei, expiry],
      }),
    },
    { label: 'Swap WETH for token', run: async () => {
      try {
        await publicClient.simulateContract({
          account: opts.account,
          address: router,
          abi: universalRouterAbi,
          functionName: 'execute',
          args: [commands, inputs, deadline],
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/NotAuctionBlock|auction/i.test(msg)) {
          throw new Error(
            'This pool is still in its anti-sniper auction window. Try again in a few blocks, or use a smaller amount after the fee decay period.',
          );
        }
        throw new Error(
          `Swap simulation failed — the pool may have low liquidity or the anti-sniper window may still be active. (${msg.slice(0, 180)})`,
        );
      }

      return walletClient.writeContract({
        chain: robinhood,
        address: router,
        abi: universalRouterAbi,
        functionName: 'execute',
        args: [commands, inputs, deadline],
      });
    }},
  ] as const;

  let lastHash: Hex | undefined;
  for (let i = 0; i < steps.length; i += 1) {
    opts.onStep?.(i + 1, steps.length, steps[i].label);
    const hash = await steps[i].run();
    await waitForTx(publicClient, hash);
    lastHash = hash;
  }

  if (!lastHash) throw new Error('Swap did not submit.');
  return lastHash;
}
