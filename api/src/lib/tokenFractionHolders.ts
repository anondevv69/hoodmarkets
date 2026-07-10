import {
  createPublicClient,
  decodeEventLog,
  getAddress,
  http,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import { config } from '../config.js';
import { robinhood } from './robinhoodChain.js';

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
    name: 'FRACTION_TOKEN_ID',
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
    name: 'shareHolderCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'shareHolderAt',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
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
] as const;

export type ShareHolder = {
  address: Address;
  shares: number;
};

function publicClient() {
  return createPublicClient({
    chain: robinhood,
    transport: http(config.chainRpcUrl),
  });
}

async function resolveCollectionAddress(token: Address, factoryAddress?: string | null): Promise<Address | null> {
  const factory = factoryAddress?.trim() ? getAddress(factoryAddress.trim()) : null;
  if (!factory) return null;
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
      if (from !== zeroAddress) balances.set(from, (balances.get(from) ?? 0n) - value);
      if (to !== zeroAddress) balances.set(to, (balances.get(to) ?? 0n) + value);
    } catch {
      continue;
    }
  }
  return balances;
}

const LOG_CHUNK_BLOCKS = 20_000n;

async function fetchHoldersViaRegistry(
  client: ReturnType<typeof publicClient>,
  collection: Address,
  tokenId: bigint,
): Promise<ShareHolder[] | null> {
  try {
    const count = await client.readContract({
      address: collection,
      abi: FRACTION_ABI,
      functionName: 'shareHolderCount',
    });
    const n = Number(count);
    if (n === 0) return [];

    const addresses = await Promise.all(
      Array.from({ length: n }, (_, i) =>
        client.readContract({
          address: collection,
          abi: FRACTION_ABI,
          functionName: 'shareHolderAt',
          args: [BigInt(i)],
        }),
      ),
    );

    const balances = await Promise.all(
      addresses.map((addr) =>
        client.readContract({
          address: collection,
          abi: FRACTION_ABI,
          functionName: 'balanceOf',
          args: [getAddress(addr as Address), tokenId],
        }),
      ),
    );

    const holders: ShareHolder[] = [];
    for (let i = 0; i < n; i++) {
      const shares = Number(balances[i]);
      if (shares <= 0) continue;
      holders.push({ address: getAddress(addresses[i] as Address), shares });
    }
    holders.sort((a, b) => b.shares - a.shares || a.address.localeCompare(b.address));
    return holders;
  } catch {
    return null;
  }
}

async function fetchTransferSingleLogsChunked(
  client: ReturnType<typeof publicClient>,
  collection: Address,
  fromBlock: bigint,
) {
  const latest = await client.getBlockNumber();
  const logs: Awaited<ReturnType<typeof client.getLogs>> = [];
  let start = fromBlock > latest ? latest : fromBlock;

  while (start <= latest) {
    const end = start + LOG_CHUNK_BLOCKS > latest ? latest : start + LOG_CHUNK_BLOCKS;
    const chunk = await client.getLogs({
      address: collection,
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
      fromBlock: start,
      toBlock: end,
    });
    logs.push(...chunk);
    start = end + 1n;
  }

  return logs;
}

/** Top Holder NFT (share) holders for a launch token — used for page admin. */
export async function fetchTopShareHolders(
  tokenAddress: string,
  opts?: { fromBlock?: bigint; factoryAddress?: string | null; limit?: number },
): Promise<ShareHolder[]> {
  const launchToken = getAddress(tokenAddress.trim());
  const collection = await resolveCollectionAddress(launchToken, opts?.factoryAddress);
  if (!collection) return [];

  const client = publicClient();
  const tokenId = await client.readContract({
    address: collection,
    abi: FRACTION_ABI,
    functionName: 'FRACTION_TOKEN_ID',
  });

  const fromBlock = opts?.fromBlock ?? 0n;
  const viaRegistry = await fetchHoldersViaRegistry(client, collection, BigInt(tokenId));
  if (viaRegistry !== null) {
    return viaRegistry.slice(0, opts?.limit ?? 5);
  }

  const logs = await fetchTransferSingleLogsChunked(client, collection, fromBlock);
  const balances = aggregateHoldersFromLogs(logs, BigInt(tokenId));
  const holders: ShareHolder[] = [];
  for (const [address, shares] of balances) {
    if (shares <= 0n) continue;
    holders.push({ address, shares: Number(shares) });
  }
  holders.sort((a, b) => b.shares - a.shares || a.address.localeCompare(b.address));
  return holders.slice(0, opts?.limit ?? 5);
}

export async function fetchTopShareHolder(
  tokenAddress: string,
  opts?: { fromBlock?: bigint; factoryAddress?: string | null },
): Promise<ShareHolder | null> {
  const top = await fetchTopShareHolders(tokenAddress, { ...opts, limit: 1 });
  return top[0] ?? null;
}
