import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeEventLog,
  getAddress,
  http,
  formatEther,
  parseEther,
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
    name: 'redeem',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'safeTransferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'id', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
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
    type: 'function',
    name: 'launchToken',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'pool',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'buyerRewardShareCap',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'buyerRewardAdmin',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'buyerRewardSharesRemaining',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'fundBuyerRewardPool',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'shareAmount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelBuyerRewardPool',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'airdropShares',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'buyerShareIssued',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'nextListingId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'listings',
    stateMutability: 'view',
    inputs: [{ name: 'listingId', type: 'uint256' }],
    outputs: [
      { name: 'seller', type: 'address' },
      { name: 'shareAmount', type: 'uint256' },
      { name: 'paymentToken', type: 'address' },
      { name: 'price', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'listShares',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'shareAmount', type: 'uint256' },
      { name: 'paymentToken', type: 'address' },
      { name: 'price', type: 'uint256' },
    ],
    outputs: [{ name: 'listingId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'buyShares',
    stateMutability: 'payable',
    inputs: [{ name: 'listingId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelListing',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'listingId', type: 'uint256' }],
    outputs: [],
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
  { type: 'error', name: 'InvalidListAmount', inputs: [] },
  { type: 'error', name: 'ArrayLengthMismatch', inputs: [] },
  { type: 'error', name: 'InsufficientFractionBalance', inputs: [] },
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

const POOL_TOKEN0_ABI = [
  {
    type: 'function',
    name: 'token0',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const SWAP_EVENT = {
  type: 'event',
  name: 'Swap',
  inputs: [
    { name: 'sender', type: 'address', indexed: true },
    { name: 'recipient', type: 'address', indexed: true },
    { name: 'amount0', type: 'int256', indexed: false },
    { name: 'amount1', type: 'int256', indexed: false },
    { name: 'sqrtPriceX96', type: 'uint160', indexed: false },
    { name: 'liquidity', type: 'uint128', indexed: false },
    { name: 'tick', type: 'int24', indexed: false },
  ],
} as const;

export type FractionHolder = {
  address: Address;
  shares: number;
  pct: number;
};

export type FractionListing = {
  id: number;
  seller: Address;
  shareAmount: number;
  paymentToken: Address;
  priceWei: bigint;
  active: boolean;
};

export type TokenFractionInfo = {
  collectionAddress: Address;
  launchToken: Address;
  poolAddress: Address | null;
  totalShares: number;
  tokenId: number;
  tokensPerShare: bigint;
  outstandingShares: number;
  redeemedShares: number;
  holderCount: number;
  holders: FractionHolder[];
};

export type AirdropEntry = { address: Address; amount: number };

export type BuyerRewardPoolState = {
  cap: number;
  remaining: number;
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
  const [totalShares, tokenId, tokensPerShare, poolRaw, launchTokenOnChain] = await Promise.all([
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
    client.readContract({
      address: collectionAddress,
      abi: FRACTION_ABI,
      functionName: 'pool',
    }).catch(() => zeroAddress),
    client.readContract({
      address: collectionAddress,
      abi: FRACTION_ABI,
      functionName: 'launchToken',
    }).catch(() => launchToken),
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
  const poolAddress =
    poolRaw && poolRaw !== zeroAddress ? getAddress(poolRaw as Address) : null;

  return {
    collectionAddress,
    launchToken: getAddress(launchTokenOnChain as Address),
    poolAddress,
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

function walletClientFor(
  walletAddress: Address,
  ethereumProvider: unknown,
) {
  return createWalletClient({
    account: walletAddress,
    chain: robinhood,
    transport: custom(ethereumProvider as Parameters<typeof custom>[0]),
  });
}

export async function claimFractionTradingFees(
  collectionAddress: Address,
  walletAddress: Address,
  ethereumProvider: unknown,
): Promise<Hex> {
  const client = walletClientFor(walletAddress, ethereumProvider);
  return client.writeContract({
    address: collectionAddress,
    abi: FRACTION_ABI,
    functionName: 'claimTradingFees',
    args: [],
    chain: robinhood,
  });
}

export async function transferFractionShares(
  collectionAddress: Address,
  walletAddress: Address,
  recipientAddress: Address,
  amount: number,
  tokenId: number,
  ethereumProvider: unknown,
): Promise<Hex> {
  const client = walletClientFor(walletAddress, ethereumProvider);
  return client.writeContract({
    address: collectionAddress,
    abi: FRACTION_ABI,
    functionName: 'safeTransferFrom',
    args: [walletAddress, recipientAddress, BigInt(tokenId), BigInt(amount), '0x'],
    chain: robinhood,
  });
}

export async function redeemFractionShares(
  collectionAddress: Address,
  walletAddress: Address,
  amount: number,
  ethereumProvider: unknown,
): Promise<Hex> {
  const client = walletClientFor(walletAddress, ethereumProvider);
  return client.writeContract({
    address: collectionAddress,
    abi: FRACTION_ABI,
    functionName: 'redeem',
    args: [BigInt(amount)],
    chain: robinhood,
  });
}

export async function fetchFractionListings(collectionAddress: Address): Promise<FractionListing[]> {
  const client = publicClient();
  const nextId = await client.readContract({
    address: collectionAddress,
    abi: FRACTION_ABI,
    functionName: 'nextListingId',
  });
  const max = Number(nextId);
  if (max <= 1) return [];

  const ids = Array.from({ length: max - 1 }, (_, i) => i + 1);
  const rows = await Promise.all(
    ids.map(async (id) => {
      const [seller, shareAmount, paymentToken, price, active] = await client.readContract({
        address: collectionAddress,
        abi: FRACTION_ABI,
        functionName: 'listings',
        args: [BigInt(id)],
      });
      return {
        id,
        seller: seller as Address,
        shareAmount: Number(shareAmount),
        paymentToken: paymentToken as Address,
        priceWei: price as bigint,
        active: active as boolean,
      };
    }),
  );
  return rows.filter((r) => r.active);
}

export async function listFractionShares(
  collectionAddress: Address,
  walletAddress: Address,
  shareAmount: number,
  priceWei: bigint,
  paymentToken: Address,
  ethereumProvider: unknown,
): Promise<Hex> {
  const client = walletClientFor(walletAddress, ethereumProvider);
  return client.writeContract({
    address: collectionAddress,
    abi: FRACTION_ABI,
    functionName: 'listShares',
    args: [BigInt(shareAmount), paymentToken, priceWei],
    chain: robinhood,
  });
}

export async function buyFractionListing(
  collectionAddress: Address,
  walletAddress: Address,
  listingId: number,
  priceWei: bigint,
  paymentToken: Address,
  ethereumProvider: unknown,
): Promise<Hex> {
  const client = walletClientFor(walletAddress, ethereumProvider);
  const isNative = paymentToken.toLowerCase() === zeroAddress;
  return client.writeContract({
    address: collectionAddress,
    abi: FRACTION_ABI,
    functionName: 'buyShares',
    args: [BigInt(listingId)],
    value: isNative ? priceWei : 0n,
    chain: robinhood,
  });
}

export async function cancelFractionListing(
  collectionAddress: Address,
  walletAddress: Address,
  listingId: number,
  ethereumProvider: unknown,
): Promise<Hex> {
  const client = walletClientFor(walletAddress, ethereumProvider);
  return client.writeContract({
    address: collectionAddress,
    abi: FRACTION_ABI,
    functionName: 'cancelListing',
    args: [BigInt(listingId)],
    chain: robinhood,
  });
}

export function parseEthPriceWei(raw: string): bigint | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const wei = parseEther(trimmed);
    if (wei <= 0n) return null;
    return wei;
  } catch {
    return null;
  }
}

export function formatListingPrice(paymentToken: Address, priceWei: bigint): string {
  if (paymentToken.toLowerCase() === zeroAddress) {
    const ethStr = formatEther(priceWei);
    const eth = Number(ethStr);
    if (!Number.isFinite(eth) || eth === 0) return '0 ETH';
    if (eth >= 1) return `${eth.toFixed(4).replace(/\.?0+$/, '')} ETH`;
    if (eth >= 0.0001) return `${eth.toFixed(6).replace(/\.?0+$/, '')} ETH`;
    return `${ethStr.replace(/\.?0+$/, '')} ETH`;
  }
  return `${priceWei.toString()} token`;
}

export function parseFractionShareAmount(raw: string, maxShares: number): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n <= 0 || n > maxShares) return null;
  return n;
}

export function parseFractionRecipient(raw: string): Address | null {
  const trimmed = raw.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return null;
  try {
    return getAddress(trimmed);
  } catch {
    return null;
  }
}

export function parseAirdropRecipients(
  text: string,
  defaultAmount: number,
  maxTotalShares: number,
): { entries: AirdropEntry[] } | { error: string } {
  if (!Number.isFinite(defaultAmount) || defaultAmount <= 0) {
    return { error: 'Default share count must be at least 1.' };
  }
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { error: 'Add at least one wallet address.' };

  const entries: AirdropEntry[] = [];
  const byAddress = new Map<string, AirdropEntry>();
  let total = 0;
  for (const line of lines) {
    let addrPart: string;
    let amtPart: string | undefined;
    const comma = line.indexOf(',');
    if (comma >= 0) {
      addrPart = line.slice(0, comma).trim();
      amtPart = line.slice(comma + 1).trim();
    } else {
      const parts = line.split(/\s+/).filter(Boolean);
      addrPart = parts[0] ?? '';
      amtPart = parts[1];
    }
    const addr = parseFractionRecipient(addrPart);
    if (!addr) return { error: `Invalid address: ${line}` };
    const amount = amtPart ? Number.parseInt(amtPart, 10) : defaultAmount;
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: `Invalid share count on line: ${line}` };
    }
    const key = addr.toLowerCase();
    const existing = byAddress.get(key);
    if (existing) {
      existing.amount += amount;
    } else {
      byAddress.set(key, { address: addr, amount });
    }
    total += amount;
  }
  entries.push(...byAddress.values());
  if (total > maxTotalShares) {
    return { error: `Total ${total} shares exceeds your balance (${maxTotalShares}).` };
  }
  return { entries };
}

function isBuyOfLaunchToken(
  launchToken: Address,
  poolToken0: Address,
  amount0: bigint,
  amount1: bigint,
): boolean {
  const launchIsToken0 = launchToken.toLowerCase() === poolToken0.toLowerCase();
  if (launchIsToken0) return amount0 < 0n;
  return amount1 < 0n;
}

export async function fetchBuyerRewardPoolState(
  collectionAddress: Address,
): Promise<BuyerRewardPoolState> {
  const client = publicClient();
  const [cap, remaining] = await Promise.all([
    client.readContract({
      address: collectionAddress,
      abi: FRACTION_ABI,
      functionName: 'buyerRewardShareCap',
    }),
    client.readContract({
      address: collectionAddress,
      abi: FRACTION_ABI,
      functionName: 'buyerRewardSharesRemaining',
    }),
  ]);
  return { cap: Number(cap), remaining: Number(remaining) };
}

export async function fetchBuyerRewardAdmin(collectionAddress: Address): Promise<Address | null> {
  const client = publicClient();
  try {
    const admin = await client.readContract({
      address: collectionAddress,
      abi: FRACTION_ABI,
      functionName: 'buyerRewardAdmin',
    });
    return admin && admin !== zeroAddress ? getAddress(admin as Address) : null;
  } catch {
    return null;
  }
}

export async function fundBuyerRewardPool(
  collectionAddress: Address,
  walletAddress: Address,
  shareAmount: number,
  ethereumProvider: unknown,
): Promise<Hex> {
  const client = walletClientFor(walletAddress, ethereumProvider);
  return client.writeContract({
    address: collectionAddress,
    abi: FRACTION_ABI,
    functionName: 'fundBuyerRewardPool',
    args: [BigInt(shareAmount)],
    chain: robinhood,
  });
}

export async function cancelBuyerRewardPool(
  collectionAddress: Address,
  walletAddress: Address,
  ethereumProvider: unknown,
): Promise<Hex> {
  const client = walletClientFor(walletAddress, ethereumProvider);
  return client.writeContract({
    address: collectionAddress,
    abi: FRACTION_ABI,
    functionName: 'cancelBuyerRewardPool',
    args: [],
    chain: robinhood,
  });
}

export async function fetchUniquePoolBuyerCandidates(opts: {
  collectionAddress: Address;
  launchToken: Address;
  fromBlock?: bigint;
  maxBuyers: number;
  excludeAddresses?: Address[];
}): Promise<Address[]> {
  const client = publicClient();
  const pool = await client.readContract({
    address: opts.collectionAddress,
    abi: FRACTION_ABI,
    functionName: 'pool',
  });
  if (!pool || pool === zeroAddress) return [];

  const tokenId = await client.readContract({
    address: opts.collectionAddress,
    abi: FRACTION_ABI,
    functionName: 'FRACTION_TOKEN_ID',
  });

  const poolToken0 = getAddress(
    (await client.readContract({
      address: pool as Address,
      abi: POOL_TOKEN0_ABI,
      functionName: 'token0',
    })) as Address,
  );

  const logs = await client.getLogs({
    address: pool as Address,
    event: SWAP_EVENT,
    fromBlock: opts.fromBlock ?? 0n,
    toBlock: 'latest',
  });

  const exclude = new Set(
    (opts.excludeAddresses ?? []).map((a) => a.toLowerCase()).concat([zeroAddress.toLowerCase()]),
  );
  const seen = new Set<string>();
  const candidates: Address[] = [];

  for (const log of logs) {
    if (candidates.length >= opts.maxBuyers) break;
    try {
      const decoded = decodeEventLog({
        abi: [SWAP_EVENT],
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      const recipient = getAddress(decoded.args.recipient as Address);
      const key = recipient.toLowerCase();
      if (exclude.has(key) || seen.has(key)) continue;
      if (
        !isBuyOfLaunchToken(
          opts.launchToken,
          poolToken0,
          decoded.args.amount0 as bigint,
          decoded.args.amount1 as bigint,
        )
      ) {
        continue;
      }

      const [balance, issued] = await Promise.all([
        client.readContract({
          address: opts.collectionAddress,
          abi: FRACTION_ABI,
          functionName: 'balanceOf',
          args: [recipient, tokenId],
        }),
        client.readContract({
          address: opts.collectionAddress,
          abi: FRACTION_ABI,
          functionName: 'buyerShareIssued',
          args: [recipient],
        }).catch(() => false),
      ]);

      if (Number(balance) > 0 || issued) {
        seen.add(key);
        continue;
      }

      seen.add(key);
      candidates.push(recipient);
    } catch {
      // skip malformed logs
    }
  }

  return candidates;
}

export async function transferFractionSharesToMany(
  collectionAddress: Address,
  walletAddress: Address,
  entries: AirdropEntry[],
  tokenId: number,
  ethereumProvider: unknown,
  onProgress?: (done: number, total: number) => void,
): Promise<{ lastHash: Hex; count: number }> {
  const client = walletClientFor(walletAddress, ethereumProvider);
  let lastHash: Hex = '0x';
  let done = 0;
  for (const entry of entries) {
    lastHash = await client.writeContract({
      address: collectionAddress,
      abi: FRACTION_ABI,
      functionName: 'safeTransferFrom',
      args: [walletAddress, entry.address, BigInt(tokenId), BigInt(entry.amount), '0x'],
      chain: robinhood,
    });
    done += 1;
    onProgress?.(done, entries.length);
  }
  return { lastHash, count: entries.length };
}

/** Custom error selectors for v0.10+ fraction contracts (Robinhood RPC often omits decoded names). */
const BATCH_AIRDROP_PROBE_REVERTS = /InvalidListAmount|ArrayLengthMismatch|InsufficientFractionBalance|0x9ba2943a|0xa24a13a6|0x512d1fe6/i;

export async function fractionSupportsBatchAirdrop(collectionAddress: Address): Promise<boolean> {
  try {
    await publicClient().simulateContract({
      address: collectionAddress,
      abi: FRACTION_ABI,
      functionName: 'airdropShares',
      args: [[zeroAddress], [0n]],
      account: '0x0000000000000000000000000000000000000001',
    });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Probe reverted on validation — function exists (v0.10+). Raw selector when RPC omits error name.
    if (BATCH_AIRDROP_PROBE_REVERTS.test(msg)) return true;
    return false;
  }
}

/** One tx when fraction contract supports `airdropShares` (v0.10+); falls back to per-wallet sends. */
export async function airdropFractionShares(
  collectionAddress: Address,
  walletAddress: Address,
  entries: AirdropEntry[],
  tokenId: number,
  ethereumProvider: unknown,
  onProgress?: (done: number, total: number) => void,
): Promise<{ hash: Hex; count: number; batched: boolean }> {
  if (entries.length === 0) {
    throw new Error('No recipients.');
  }

  const batched = await fractionSupportsBatchAirdrop(collectionAddress);
  if (!batched) {
    const fallback = await transferFractionSharesToMany(
      collectionAddress,
      walletAddress,
      entries,
      tokenId,
      ethereumProvider,
      onProgress,
    );
    return { hash: fallback.lastHash, count: fallback.count, batched: false };
  }

  const client = walletClientFor(walletAddress, ethereumProvider);
  const recipients = entries.map((e) => e.address);
  const amounts = entries.map((e) => BigInt(e.amount));
  const hash = await client.writeContract({
    address: collectionAddress,
    abi: FRACTION_ABI,
    functionName: 'airdropShares',
    args: [recipients, amounts],
    chain: robinhood,
  });
  onProgress?.(entries.length, entries.length);
  return { hash, count: entries.length, batched: true };
}
