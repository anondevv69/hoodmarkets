import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeEventLog,
  getAddress,
  http,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import { robinhood } from '../chain';
import { HOODMARKETS_V3_FACTORY, isHoodMarketsV3Factory } from './launchType';

const FRACTION_FACTORY_ABI = [
  {
    type: 'function',
    name: 'fractionCollectionForToken',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const FRACTION_ABI = [
  {
    type: 'function',
    name: 'FRACTION_COUNT',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'FRACTION_TOKEN_ID',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'tokensPerFraction',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'claimTradingFees',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'pendingTradingFees',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'pending0', type: 'uint256' },
      { name: 'pending1', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'rewardToken0',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'event',
    name: 'TransferSingle',
    inputs: [
      { name: 'operator', type: 'address', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'id', type: 'uint256', indexed: false },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'FractionRedeemed',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'underlyingAmount', type: 'uint256', indexed: false },
    ],
  },
] as const;

export type FractionHolder = {
  address: Address;
  shares: number;
  pct: number;
};

export type TokenFractionInfo = {
  collectionAddress: Address;
  launchToken: Address;
  totalShares: number;
  tokenId: number;
  tokensPerShare: bigint;
  outstandingShares: number;
  redeemedShares: number;
  holderCount: number;
  holders: FractionHolder[];
};

function publicClient() {
  return createPublicClient({ chain: robinhood, transport: http() });
}

async function resolveCollectionAddress(
  token: Address,
  factoryAddress?: string | null,
): Promise<Address | null> {
  const factory = (() => {
    const fromCatalog = factoryAddress?.trim();
    if (fromCatalog && isHoodMarketsV3Factory(fromCatalog)) return getAddress(fromCatalog);
    return getAddress(HOODMARKETS_V3_FACTORY);
  })();
  const client = publicClient();
  try {
    const collection = await client.readContract({
      address: factory,
      abi: FRACTION_FACTORY_ABI,
      functionName: 'fractionCollectionForToken',
      args: [token],
    });
    if (!collection || collection === zeroAddress) return null;
    return getAddress(collection);
  } catch {
    return null;
  }
}

function aggregateHoldersFromLogs(
  logs: { data: Hex; topics: readonly Hex[] }[],
  tokenId: bigint,
): Map<Address, bigint> {
  const balances = new Map<Address, bigint>();

  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: FRACTION_ABI,
        eventName: 'TransferSingle',
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      if (decoded.args.id !== tokenId) continue;
      const from = getAddress(decoded.args.from);
      const to = getAddress(decoded.args.to);
      const value = decoded.args.value;
      if (from !== zeroAddress) {
        balances.set(from, (balances.get(from) ?? 0n) - value);
      }
      if (to !== zeroAddress) {
        balances.set(to, (balances.get(to) ?? 0n) + value);
      }
    } catch {
      // skip malformed logs
    }
  }

  return balances;
}

export async function fetchWalletFractionBalance(
  collectionAddress: Address,
  walletAddress: Address,
  tokenId = 0,
): Promise<number> {
  const client = publicClient();
  const bal = await client.readContract({
    address: collectionAddress,
    abi: FRACTION_ABI,
    functionName: 'balanceOf',
    args: [walletAddress, BigInt(tokenId)],
  });
  return Number(bal);
}

export async function fetchTokenFractionInfo(
  tokenAddress: string,
  opts?: { fromBlock?: bigint; factoryAddress?: string | null },
): Promise<TokenFractionInfo | null> {
  const launchToken = getAddress(tokenAddress.trim());
  const collectionAddress = await resolveCollectionAddress(launchToken, opts?.factoryAddress);
  if (!collectionAddress) return null;

  const client = publicClient();
  const [totalShares, tokenId, tokensPerShare] = await Promise.all([
    client.readContract({
      address: collectionAddress,
      abi: FRACTION_ABI,
      functionName: 'FRACTION_COUNT',
    }),
    client.readContract({
      address: collectionAddress,
      abi: FRACTION_ABI,
      functionName: 'FRACTION_TOKEN_ID',
    }),
    client.readContract({
      address: collectionAddress,
      abi: FRACTION_ABI,
      functionName: 'tokensPerFraction',
    }),
  ]);

  const total = Number(totalShares);
  const id = Number(tokenId);
  const fromBlock = opts?.fromBlock ?? 0n;

  const logs = await client.getLogs({
    address: collectionAddress,
    event: {
      type: 'event',
      name: 'TransferSingle',
      inputs: [
        { name: 'operator', type: 'address', indexed: true },
        { name: 'from', type: 'address', indexed: true },
        { name: 'to', type: 'address', indexed: true },
        { name: 'id', type: 'uint256', indexed: false },
        { name: 'value', type: 'uint256', indexed: false },
      ],
    },
    fromBlock,
    toBlock: 'latest',
  });

  const balances = aggregateHoldersFromLogs(logs, BigInt(id));
  const holders: FractionHolder[] = [];

  let outstanding = 0n;
  for (const [address, shares] of balances) {
    if (shares <= 0n) continue;
    const n = Number(shares);
    outstanding += shares;
    holders.push({
      address,
      shares: n,
      pct: total > 0 ? (n / total) * 100 : 0,
    });
  }

  holders.sort((a, b) => b.shares - a.shares || a.address.localeCompare(b.address));

  const outstandingShares = Number(outstanding);
  const redeemedShares = Math.max(0, total - outstandingShares);

  return {
    collectionAddress,
    launchToken,
    totalShares: total,
    tokenId: id,
    tokensPerShare,
    outstandingShares,
    redeemedShares,
    holderCount: holders.length,
    holders,
  };
}

export async function fetchPendingFractionTradingFees(
  collectionAddress: Address,
  walletAddress: Address,
): Promise<{ pending0: bigint; pending1: bigint } | null> {
  const client = publicClient();
  try {
    const [pending0, pending1] = await client.readContract({
      address: collectionAddress,
      abi: FRACTION_ABI,
      functionName: 'pendingTradingFees',
      args: [walletAddress],
    });
    return { pending0, pending1 };
  } catch {
    return null;
  }
}

export async function claimFractionTradingFees(
  collectionAddress: Address,
  walletAddress: Address,
  ethereumProvider: unknown,
): Promise<Hex> {
  const client = createWalletClient({
    account: walletAddress,
    chain: robinhood,
    transport: custom(ethereumProvider as Parameters<typeof custom>[0]),
  });
  return client.writeContract({
    address: collectionAddress,
    abi: FRACTION_ABI,
    functionName: 'claimTradingFees',
    args: [],
    chain: robinhood,
  });
}
