import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeAbiParameters,
  encodePacked,
  erc20Abi,
  formatEther,
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
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
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

export type SwapBuyResult = {
  swapTxHash: Hex;
  tokenBalance: string;
  stepsRun: string[];
  stepsSkipped: string[];
};

export async function fetchTokenSwapConfig(tokenAddress: string): Promise<TokenSwapConfig> {
  const res = await fetch(`${API_BASE}/api/tokens/${tokenAddress}/swap-config`);
  const data = (await res.json()) as TokenSwapConfig & { error?: string };
  if (!res.ok) throw new Error(data.error || 'Failed to load swap config');
  if (!data.permit2) {
    throw new Error('Swap config missing Permit2 address.');
  }
  return data;
}

/** Robinhood base fee moves every block — refresh with headroom so MetaMask won't reject. */
async function robinhoodTxFees(publicClient: ReturnType<typeof createPublicClient>) {
  const block = await publicClient.getBlock({ blockTag: 'latest' });
  const baseFee = block.baseFeePerGas ?? 20_000_000n;
  const maxPriorityFeePerGas = 2_000_000n;
  const maxFeePerGas = baseFee + baseFee / 2n + maxPriorityFeePerGas;
  return { maxFeePerGas, maxPriorityFeePerGas };
}

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

async function readTokenBalance(
  publicClient: ReturnType<typeof createPublicClient>,
  token: `0x${string}`,
  account: `0x${string}`,
): Promise<bigint> {
  return publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account],
  });
}

export async function swapEthForHoodmarketsToken(opts: {
  config: TokenSwapConfig;
  amountEth: string;
  walletProvider: unknown;
  account: `0x${string}`;
  onStep?: (step: number, total: number, label: string) => void;
}): Promise<SwapBuyResult> {
  const amountInWei = parseEther(opts.amountEth);
  if (amountInWei <= 0n) throw new Error('Enter an ETH amount greater than zero.');

  const weth = getAddress(opts.config.weth);
  const permit2 = getAddress(opts.config.permit2);
  const router = getAddress(opts.config.universalRouter);
  const token = getAddress(opts.config.tokenAddress);
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

  const balanceBefore = await readTokenBalance(publicClient, token, opts.account);

  const wethBalance = await publicClient.readContract({
    address: weth,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [opts.account],
  });
  const wethAllowancePermit2 = await publicClient.readContract({
    address: weth,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [opts.account, permit2],
  });
  const permit2Allowance = await publicClient.readContract({
    address: permit2,
    abi: permit2Abi,
    functionName: 'allowance',
    args: [opts.account, weth, router],
  });

  const stepsRun: string[] = [];
  const stepsSkipped: string[] = [];

  const allSteps: { id: string; label: string; skip: boolean; run: () => Promise<Hex> }[] = [
    {
      id: 'deposit',
      label: 'Wrap ETH to WETH',
      skip: wethBalance >= amountInWei,
      run: async () => {
        const fees = await robinhoodTxFees(publicClient);
        return walletClient.writeContract({
          chain: robinhood,
          address: weth,
          abi: wethAbi,
          functionName: 'deposit',
          value: amountInWei,
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        });
      },
    },
    {
      id: 'approve-weth',
      label: 'Approve WETH for Permit2',
      skip: wethAllowancePermit2 >= amountInWei,
      run: async () => {
        const fees = await robinhoodTxFees(publicClient);
        return walletClient.writeContract({
          chain: robinhood,
          address: weth,
          abi: erc20Abi,
          functionName: 'approve',
          args: [permit2, amountInWei],
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        });
      },
    },
    {
      id: 'approve-permit2',
      label: 'Approve router on Permit2',
      skip:
        permit2Allowance[0] >= amountInWei && Number(permit2Allowance[1]) > Math.floor(Date.now() / 1000),
      run: async () => {
        const fees = await robinhoodTxFees(publicClient);
        return walletClient.writeContract({
          chain: robinhood,
          address: permit2,
          abi: permit2Abi,
          functionName: 'approve',
          args: [weth, router, amountInWei, expiry],
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        });
      },
    },
    {
      id: 'swap',
      label: 'Swap WETH for token',
      skip: false,
      run: async () => {
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
              'This pool is still in its anti-sniper auction window. Wait a minute and try again.',
            );
          }
          throw new Error(
            `Swap simulation failed — the pool may have low liquidity or the anti-sniper window may still be active. (${msg.slice(0, 180)})`,
          );
        }

        const fees = await robinhoodTxFees(publicClient);
        return walletClient.writeContract({
          chain: robinhood,
          address: router,
          abi: universalRouterAbi,
          functionName: 'execute',
          args: [commands, inputs, deadline],
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        });
      },
    },
  ];

  const pending = allSteps.filter((s) => !s.skip);
  allSteps.filter((s) => s.skip).forEach((s) => stepsSkipped.push(s.label));

  if (pending.length === 0) {
    throw new Error('Swap steps already completed — retry the buy or check your token balance.');
  }

  let lastHash: Hex | undefined;
  for (let i = 0; i < pending.length; i += 1) {
    const step = pending[i];
    opts.onStep?.(i + 1, pending.length, step.label);
    const hash = await step.run();
    await waitForTx(publicClient, hash);
    stepsRun.push(step.label);
    lastHash = hash;
  }

  if (!lastHash) throw new Error('Swap did not submit.');

  const balanceAfter = await readTokenBalance(publicClient, token, opts.account);
  const received = balanceAfter - balanceBefore;
  if (received <= 0n) {
    throw new Error(
      'Swap transactions confirmed but no tokens arrived in your wallet. The pool may have rejected the trade — try a smaller amount.',
    );
  }

  return {
    swapTxHash: lastHash,
    tokenBalance: formatEther(received),
    stepsRun,
    stepsSkipped,
  };
}
