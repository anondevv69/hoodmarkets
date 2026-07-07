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

const LP_LOCKER_COLLECT_ABI = [
  {
    type: 'function',
    name: 'collectRewards',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

const FEE_LOCKER_CLAIM_ABI = [
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

function walletClientFor(walletAddress: Address, ethereumProvider: unknown) {
  return createWalletClient({
    account: walletAddress,
    chain: robinhood,
    transport: custom(ethereumProvider as Parameters<typeof custom>[0]),
  });
}

async function resolveV3ClaimTarget(tokenAddress: Address): Promise<{
  to: Address;
  data: Hex;
  usesFraction: boolean;
}> {
  const publicClient = createPublicClient({
    chain: robinhood,
    transport: http(),
  });
  const factory = getAddress(HOODMARKETS_V3_FACTORY);
  const fractionCollection = await publicClient.readContract({
    address: factory,
    abi: FRACTION_FACTORY_ABI,
    functionName: 'fractionCollectionForToken',
    args: [tokenAddress],
  });

  if (fractionCollection && fractionCollection !== zeroAddress) {
    return {
      to: getAddress(fractionCollection),
      data: encodeFunctionData({
        abi: [{ type: 'function', name: 'claimTradingFees', inputs: [], outputs: [] }],
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
  const token = getAddress(params.tokenAddress);
  const target = await resolveV3ClaimTarget(token);
  if (target.usesFraction) {
    return claimFractionTradingFees(target.to, params.walletAddress, params.ethereumProvider);
  }
  const client = walletClientFor(params.walletAddress, params.ethereumProvider);
  return client.writeContract({
    address: target.to,
    abi: HOODMARKETS_V3_ABI,
    functionName: 'claimRewards',
    args: [token],
    chain: robinhood,
  });
}

export async function collectV4PoolFeesFromWallet(params: {
  tokenAddress: string;
  walletAddress: Address;
  ethereumProvider: unknown;
}): Promise<Hex> {
  const cfg = await fetchWebDeployConfig();
  const lpLocker = cfg.feeClaimContracts?.liquidLpLocker;
  if (!lpLocker) {
    throw new Error('LP locker is not configured. Try again later.');
  }
  const client = walletClientFor(params.walletAddress, params.ethereumProvider);
  return client.writeContract({
    address: getAddress(lpLocker),
    abi: LP_LOCKER_COLLECT_ABI,
    functionName: 'collectRewards',
    args: [getAddress(params.tokenAddress)],
    chain: robinhood,
  });
}

export async function claimV4LockerFeesFromWallet(params: {
  feeRecipientAddress: string;
  walletAddress: Address;
  ethereumProvider: unknown;
}): Promise<Hex> {
  const cfg = await fetchWebDeployConfig();
  const feeLocker = cfg.feeClaimContracts?.feeLocker;
  if (!feeLocker) {
    throw new Error('Fee locker is not configured. Try again later.');
  }
  const weth = (cfg.feeClaimContracts?.weth || ROBINHOOD_WETH) as Address;
  const feeOwner = getAddress(params.feeRecipientAddress);
  const client = walletClientFor(params.walletAddress, params.ethereumProvider);
  return client.writeContract({
    address: getAddress(feeLocker),
    abi: FEE_LOCKER_CLAIM_ABI,
    functionName: 'claim',
    args: [feeOwner, weth],
    chain: robinhood,
  });
}
