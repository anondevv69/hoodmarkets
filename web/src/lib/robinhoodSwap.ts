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
  parseUnits,
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
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'wad', type: 'uint256' }],
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

const swapHelperAbi = [
  {
    type: 'function',
    name: 'buy',
    stateMutability: 'payable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amountOutMinimum', type: 'uint128' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'sell',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMinimum', type: 'uint128' },
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
  swapHelper?: `0x${string}`;
  zeroForOne: boolean;
  sellZeroForOne: boolean;
  pairedToken: `0x${string}`;
}

export type OnChainPoolStats = {
  poolId: string;
  tokenAddress: string;
  priceEthPerToken: string;
  liquidityEth: string;
  marketCapEth: string;
  tick: number;
  source: 'on-chain';
};

export type SwapResult = {
  swapTxHash: Hex;
  amountOut: string;
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
  if (data.sellZeroForOne === undefined) {
    data.sellZeroForOne = !data.zeroForOne;
  }
  return data;
}

export async function fetchOnChainPoolStats(tokenAddress: string): Promise<OnChainPoolStats | null> {
  const res = await fetch(`${API_BASE}/api/tokens/${tokenAddress}/pool-stats`);
  if (!res.ok) return null;
  const data = (await res.json()) as OnChainPoolStats & { error?: string };
  if (data.error || !data.priceEthPerToken) return null;
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

function encodeV4ExactInSwap(
  config: TokenSwapConfig,
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  zeroForOne: boolean,
  amountInWei: bigint,
  amountOutMinimum = 1n,
): { commands: Hex; inputs: Hex[] } {
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
        zeroForOne,
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
      [tokenIn, amountInWei],
    ),
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      [tokenOut, amountOutMinimum],
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

function walletClients(walletProvider: unknown, account: `0x${string}`) {
  const transport = custom(walletProvider as Parameters<typeof custom>[0]);
  const publicClient = createPublicClient({ chain: robinhood, transport });
  const walletClient = createWalletClient({
    account,
    chain: robinhood,
    transport,
  });
  return { publicClient, walletClient };
}

async function simulateAuctionError(
  publicClient: ReturnType<typeof createPublicClient>,
  account: `0x${string}`,
  router: `0x${string}`,
  commands: Hex,
  inputs: Hex[],
  deadline: bigint,
): Promise<void> {
  try {
    await publicClient.simulateContract({
      account,
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
}

/** One-tx ETH → token via HoodMarketsSwapHelper (when deployed). */
export async function buyViaSwapHelper(opts: {
  config: TokenSwapConfig;
  amountEth: string;
  walletProvider: unknown;
  account: `0x${string}`;
}): Promise<SwapResult> {
  const helper = opts.config.swapHelper;
  if (!helper) throw new Error('Swap helper is not configured on the API yet.');

  const amountInWei = parseEther(opts.amountEth);
  if (amountInWei <= 0n) throw new Error('Enter an ETH amount greater than zero.');

  const token = getAddress(opts.config.tokenAddress);
  const { publicClient, walletClient } = walletClients(opts.walletProvider, opts.account);
  const balanceBefore = await readTokenBalance(publicClient, token, opts.account);
  const fees = await robinhoodTxFees(publicClient);

  const hash = await walletClient.writeContract({
    chain: robinhood,
    address: getAddress(helper),
    abi: swapHelperAbi,
    functionName: 'buy',
    args: [token, 1n],
    value: amountInWei,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  await waitForTx(publicClient, hash);

  const balanceAfter = await readTokenBalance(publicClient, token, opts.account);
  const received = balanceAfter - balanceBefore;
  if (received <= 0n) {
    throw new Error('Buy confirmed but no tokens arrived. Try a smaller amount.');
  }

  return {
    swapTxHash: hash,
    amountOut: formatEther(received),
    stepsRun: ['Buy (one transaction)'],
    stepsSkipped: [],
  };
}

/** One- or two-tx token → ETH via HoodMarketsSwapHelper. */
export async function sellViaSwapHelper(opts: {
  config: TokenSwapConfig;
  amountTokens: string;
  walletProvider: unknown;
  account: `0x${string}`;
  onStep?: (step: number, total: number, label: string) => void;
}): Promise<SwapResult> {
  const helper = opts.config.swapHelper;
  if (!helper) throw new Error('Swap helper is not configured on the API yet.');

  const amountIn = parseUnits(opts.amountTokens, 18);
  if (amountIn <= 0n) throw new Error('Enter a token amount greater than zero.');

  const token = getAddress(opts.config.tokenAddress);
  const helperAddr = getAddress(helper);
  const { publicClient, walletClient } = walletClients(opts.walletProvider, opts.account);

  const ethBefore = await publicClient.getBalance({ address: opts.account });
  const allowance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [opts.account, helperAddr],
  });

  const stepsRun: string[] = [];
  const stepsSkipped: string[] = [];
  const pending: { label: string; run: () => Promise<Hex> }[] = [];

  if (allowance < amountIn) {
    pending.push({
      label: 'Approve token for swap helper',
      run: async () => {
        const fees = await robinhoodTxFees(publicClient);
        return walletClient.writeContract({
          chain: robinhood,
          address: token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [helperAddr, amountIn],
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        });
      },
    });
  } else {
    stepsSkipped.push('Approve token for swap helper');
  }

  pending.push({
    label: 'Sell token for ETH',
    run: async () => {
      const fees = await robinhoodTxFees(publicClient);
      return walletClient.writeContract({
        chain: robinhood,
        address: helperAddr,
        abi: swapHelperAbi,
        functionName: 'sell',
        args: [token, amountIn, 1n],
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      });
    },
  });

  let lastHash: Hex | undefined;
  for (let i = 0; i < pending.length; i += 1) {
    const step = pending[i];
    opts.onStep?.(i + 1, pending.length, step.label);
    const hash = await step.run();
    await waitForTx(publicClient, hash);
    stepsRun.push(step.label);
    lastHash = hash;
  }

  if (!lastHash) throw new Error('Sell did not submit.');

  const ethAfter = await publicClient.getBalance({ address: opts.account });
  const received = ethAfter - ethBefore;
  if (received <= 0n) {
    throw new Error('Sell confirmed but no ETH arrived. Try a smaller amount.');
  }

  return {
    swapTxHash: lastHash,
    amountOut: formatEther(received),
    stepsRun,
    stepsSkipped,
  };
}

export async function swapEthForHoodmarketsToken(opts: {
  config: TokenSwapConfig;
  amountEth: string;
  walletProvider: unknown;
  account: `0x${string}`;
  onStep?: (step: number, total: number, label: string) => void;
}): Promise<SwapResult> {
  if (opts.config.swapHelper) {
    return buyViaSwapHelper(opts);
  }

  const amountInWei = parseEther(opts.amountEth);
  if (amountInWei <= 0n) throw new Error('Enter an ETH amount greater than zero.');

  const weth = getAddress(opts.config.weth);
  const permit2 = getAddress(opts.config.permit2);
  const router = getAddress(opts.config.universalRouter);
  const token = getAddress(opts.config.tokenAddress);
  const expiry = Math.floor(Date.now() / 1000) + 60 * 20;
  const deadline = BigInt(expiry);
  const { commands, inputs } = encodeV4ExactInSwap(
    opts.config,
    weth,
    token,
    opts.config.zeroForOne,
    amountInWei,
  );

  const { publicClient, walletClient } = walletClients(opts.walletProvider, opts.account);
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
        await simulateAuctionError(publicClient, opts.account, router, commands, inputs, deadline);
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
    amountOut: formatEther(received),
    stepsRun,
    stepsSkipped,
  };
}

export async function swapHoodmarketsTokenForEth(opts: {
  config: TokenSwapConfig;
  amountTokens: string;
  walletProvider: unknown;
  account: `0x${string}`;
  onStep?: (step: number, total: number, label: string) => void;
}): Promise<SwapResult> {
  if (opts.config.swapHelper) {
    return sellViaSwapHelper(opts);
  }

  const amountInWei = parseUnits(opts.amountTokens, 18);
  if (amountInWei <= 0n) throw new Error('Enter a token amount greater than zero.');

  const weth = getAddress(opts.config.weth);
  const permit2 = getAddress(opts.config.permit2);
  const router = getAddress(opts.config.universalRouter);
  const token = getAddress(opts.config.tokenAddress);
  const expiry = Math.floor(Date.now() / 1000) + 60 * 20;
  const deadline = BigInt(expiry);
  const { commands, inputs } = encodeV4ExactInSwap(
    opts.config,
    token,
    weth,
    opts.config.sellZeroForOne,
    amountInWei,
  );

  const { publicClient, walletClient } = walletClients(opts.walletProvider, opts.account);
  const ethBefore = await publicClient.getBalance({ address: opts.account });

  const tokenAllowancePermit2 = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [opts.account, permit2],
  });
  const permit2Allowance = await publicClient.readContract({
    address: permit2,
    abi: permit2Abi,
    functionName: 'allowance',
    args: [opts.account, token, router],
  });

  const stepsRun: string[] = [];
  const stepsSkipped: string[] = [];

  const allSteps: { label: string; skip: boolean; run: () => Promise<Hex> }[] = [
    {
      label: 'Approve token for Permit2',
      skip: tokenAllowancePermit2 >= amountInWei,
      run: async () => {
        const fees = await robinhoodTxFees(publicClient);
        return walletClient.writeContract({
          chain: robinhood,
          address: token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [permit2, amountInWei],
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        });
      },
    },
    {
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
          args: [token, router, amountInWei, expiry],
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        });
      },
    },
    {
      label: 'Swap token for WETH',
      skip: false,
      run: async () => {
        await simulateAuctionError(publicClient, opts.account, router, commands, inputs, deadline);
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
    {
      label: 'Unwrap WETH to ETH',
      skip: false,
      run: async () => {
        const wethBal = await publicClient.readContract({
          address: weth,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [opts.account],
        });
        if (wethBal <= 0n) {
          stepsSkipped.push('Unwrap WETH to ETH');
          return '0x' as Hex;
        }
        const fees = await robinhoodTxFees(publicClient);
        return walletClient.writeContract({
          chain: robinhood,
          address: weth,
          abi: wethAbi,
          functionName: 'withdraw',
          args: [wethBal],
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        });
      },
    },
  ];

  const pending = allSteps.filter((s) => !s.skip);
  allSteps.filter((s) => s.skip).forEach((s) => stepsSkipped.push(s.label));

  let lastHash: Hex | undefined;
  for (let i = 0; i < pending.length; i += 1) {
    const step = pending[i];
    opts.onStep?.(i + 1, pending.length, step.label);
    const hash = await step.run();
    if (hash !== '0x') {
      await waitForTx(publicClient, hash);
      stepsRun.push(step.label);
      lastHash = hash;
    }
  }

  if (!lastHash) throw new Error('Sell did not submit.');

  const ethAfter = await publicClient.getBalance({ address: opts.account });
  const received = ethAfter - ethBefore;
  if (received <= 0n) {
    throw new Error('Sell confirmed but no ETH arrived. Try a smaller amount.');
  }

  return {
    swapTxHash: lastHash,
    amountOut: formatEther(received),
    stepsRun,
    stepsSkipped,
  };
}
