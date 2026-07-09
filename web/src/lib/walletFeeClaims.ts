import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  getAddress,
  http,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import { fetchWebDeployConfig } from '../api';
import { robinhood } from '../chain';
import { formatClaimError } from './formatClaimError';
import { ensureRobinhoodChainInWallet } from './ensureRobinhoodChain';
import { HOODMARKETS_V3_FACTORY } from './launchType';
import { claimFractionTradingFees } from './tokenFractions';
import { HOODMARKETS_V3_ABI } from './hoodmarketsV3Abi';

const FRACTION_FACTORY_ABI = [
  {
    type: 'function',
    name: 'fractionCollectionForToken',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const FRACTION_CLAIM_ABI = [
  {
    type: 'function',
    name: 'claimTradingFees',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

const LP_LOCKER_COLLECT_ABI = [
  {
    type: 'function',
    name: 'collectRewards',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

const FEE_LOCKER_ABI = [
  {
    type: 'function',
    name: 'feesToClaim',
    inputs: [
      { name: 'feeOwner', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: 'balance', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'claim',
    inputs: [
      { name: 'feeOwner', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

const ROBINHOOD_WETH = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' as const;

function publicClient() {
  return createPublicClient({
    chain: robinhood,
    transport: http(),
  });
}

function walletClientFor(walletAddress: Address, ethereumProvider: unknown) {
  return createWalletClient({
    account: walletAddress,
    chain: robinhood,
    transport: custom(ethereumProvider as Parameters<typeof custom>[0]),
  });
}

async function prepareWallet(ethereumProvider: unknown) {
  await ensureRobinhoodChainInWallet(
    ethereumProvider as Parameters<typeof ensureRobinhoodChainInWallet>[0],
  );
}

async function simulateOrThrow(
  walletAddress: Address,
  call: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  },
): Promise<void> {
  const pc = publicClient();
  try {
    await pc.simulateContract({
      address: call.address,
      abi: call.abi as never,
      functionName: call.functionName as never,
      args: (call.args ?? []) as never,
      account: walletAddress,
    });
  } catch (e) {
    throw new Error(formatClaimError(e));
  }
}

async function resolveV3ClaimTarget(tokenAddress: Address): Promise<{
  to: Address;
  data: Hex;
  usesFraction: boolean;
}> {
  const pc = publicClient();
  const factory = getAddress(HOODMARKETS_V3_FACTORY);
  const fractionCollection = await pc.readContract({
    address: factory,
    abi: FRACTION_FACTORY_ABI,
    functionName: 'fractionCollectionForToken',
    args: [tokenAddress],
  });

  if (fractionCollection && fractionCollection !== zeroAddress) {
    return {
      to: getAddress(fractionCollection),
      data: encodeFunctionData({
        abi: FRACTION_CLAIM_ABI,
        functionName: 'claimTradingFees',
        args: [],
      }),
      usesFraction: true,
    };
  }

  return {
    to: factory,
    data: encodeFunctionData({
      abi: HOODMARKETS_V3_ABI,
      functionName: 'claimRewards',
      args: [tokenAddress],
    }),
    usesFraction: false,
  };
}

export async function claimV3TradingFeesFromWallet(params: {
  tokenAddress: string;
  walletAddress: Address;
  ethereumProvider: unknown;
}): Promise<Hex> {
  await prepareWallet(params.ethereumProvider);
  const token = getAddress(params.tokenAddress);
  const target = await resolveV3ClaimTarget(token);

  if (target.usesFraction) {
    await simulateOrThrow(params.walletAddress, {
      address: target.to,
      abi: FRACTION_CLAIM_ABI,
      functionName: 'claimTradingFees',
      args: [],
    });
    try {
      return await claimFractionTradingFees(
        target.to,
        params.walletAddress,
        params.ethereumProvider,
      );
    } catch (e) {
      throw new Error(formatClaimError(e));
    }
  }

  await simulateOrThrow(params.walletAddress, {
    address: target.to,
    abi: HOODMARKETS_V3_ABI,
    functionName: 'claimRewards',
    args: [token],
  });

  try {
    const client = walletClientFor(params.walletAddress, params.ethereumProvider);
    return await client.writeContract({
      address: target.to,
      abi: HOODMARKETS_V3_ABI,
      functionName: 'claimRewards',
      args: [token],
      chain: robinhood,
    });
  } catch (e) {
    throw new Error(formatClaimError(e));
  }
}

export async function collectV4PoolFeesFromWallet(params: {
  tokenAddress: string;
  walletAddress: Address;
  ethereumProvider: unknown;
}): Promise<Hex> {
  await prepareWallet(params.ethereumProvider);
  const cfg = await fetchWebDeployConfig();
  const lpLocker = cfg.feeClaimContracts?.liquidLpLocker;
  if (!lpLocker) {
    throw new Error('LP locker is not configured. Try again later.');
  }
  const token = getAddress(params.tokenAddress);
  const locker = getAddress(lpLocker);

  await simulateOrThrow(params.walletAddress, {
    address: locker,
    abi: LP_LOCKER_COLLECT_ABI,
    functionName: 'collectRewards',
    args: [token],
  });

  try {
    const client = walletClientFor(params.walletAddress, params.ethereumProvider);
    return await client.writeContract({
      address: locker,
      abi: LP_LOCKER_COLLECT_ABI,
      functionName: 'collectRewards',
      args: [token],
      chain: robinhood,
    });
  } catch (e) {
    throw new Error(formatClaimError(e));
  }
}

export async function claimV4LockerFeesFromWallet(params: {
  feeRecipientAddress: string;
  walletAddress: Address;
  ethereumProvider: unknown;
}): Promise<Hex> {
  await prepareWallet(params.ethereumProvider);
  const cfg = await fetchWebDeployConfig();
  const feeLocker = cfg.feeClaimContracts?.feeLocker;
  if (!feeLocker) {
    throw new Error('Fee locker is not configured. Try again later.');
  }
  const weth = (cfg.feeClaimContracts?.weth || ROBINHOOD_WETH) as Address;
  const feeOwner = getAddress(params.feeRecipientAddress);
  const locker = getAddress(feeLocker);
  const pc = publicClient();

  const pending = await pc.readContract({
    address: locker,
    abi: FEE_LOCKER_ABI,
    functionName: 'feesToClaim',
    args: [feeOwner, weth],
  });
  if (pending === 0n) {
    throw new Error(
      'No WETH in the fee locker yet. Collect pool fees first after trading activity.',
    );
  }

  await simulateOrThrow(params.walletAddress, {
    address: locker,
    abi: FEE_LOCKER_ABI,
    functionName: 'claim',
    args: [feeOwner, weth],
  });

  try {
    const client = walletClientFor(params.walletAddress, params.ethereumProvider);
    return await client.writeContract({
      address: locker,
      abi: FEE_LOCKER_ABI,
      functionName: 'claim',
      args: [feeOwner, weth],
      chain: robinhood,
    });
  } catch (e) {
    throw new Error(formatClaimError(e));
  }
}
