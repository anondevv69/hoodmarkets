import {
  createPublicClient,
  encodeFunctionData,
  formatEther,
  getAddress,
  http,
  parseEther,
  toHex,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import { config } from '../config.js';
import { getDeploymentByTokenAddress, getNewestDeploymentByTickerSymbol } from './deploymentCatalog.js';
import { HOODMARKETS_V3_FRACTION_ABI } from './hoodmarketsV3FractionAbi.js';
import { isV3CatalogDeployment } from './hoodmarketsV3Fees.js';
import type { AgentPreparedTx } from './agentSwapPrepare.js';
import { ROBINHOOD_CHAIN_ID, ROBINHOOD_RPC_DEFAULT } from './robinhoodChain.js';

const FRACTION_TOKEN_ID = 0n;
const SHARE_SALE_PLATFORM_FEE_BPS = 500;
const MAX_AIRDROP_RECIPIENTS = 50;

/** Probe reverts when `airdropShares` exists but validation fails (v0.10+ bytecode). */
const BATCH_AIRDROP_PROBE_REVERTS =
  /InvalidListAmount|ArrayLengthMismatch|InsufficientFractionBalance|0x9ba2943a|0xa24a13a6|0x512d1fe6/i;

const FRACTION_FACTORY_ABI = [
  {
    type: 'function',
    name: 'fractionCollectionForToken',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export type AgentFractionListing = {
  listingId: number;
  seller: Address;
  shareAmount: number;
  paymentToken: Address;
  priceWei: string;
  priceEth: string;
  active: boolean;
};

function publicClient() {
  return createPublicClient({
    transport: http(config.chainRpcUrl || ROBINHOOD_RPC_DEFAULT),
  });
}

function tokenPageUrl(token: Address): string {
  const base = (process.env.LAUNCHER_WEB_URL || 'https://hood.markets').replace(/\/$/, '');
  return `${base}/?token=${token}`;
}

async function resolveTokenAddress(raw: string): Promise<Address | null> {
  const trimmed = raw.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    try {
      return getAddress(trimmed);
    } catch {
      return null;
    }
  }
  const row = await getNewestDeploymentByTickerSymbol(trimmed.toUpperCase());
  return row ? getAddress(row.tokenAddress) : null;
}

async function loadFractionContext(tokenRaw: string) {
  const token = await resolveTokenAddress(tokenRaw);
  if (!token) {
    return { ok: false as const, error: 'Token not found. Use tokenAddress or symbol (e.g. NORMIES).' };
  }

  const row = await getDeploymentByTokenAddress(token);
  if (!row) {
    return {
      ok: false as const,
      error: 'Token not in hood.markets catalog.',
      tokenPageUrl: tokenPageUrl(token),
    };
  }
  if (!isV3CatalogDeployment(row)) {
    return {
      ok: false as const,
      error: 'Holder NFT marketplace is only on simple (V3) launches.',
      tokenPageUrl: tokenPageUrl(token),
    };
  }

  const factoryRaw = row.factoryAddress?.trim() || config.hoodmarketsV3.factory?.trim();
  if (!factoryRaw) {
    return { ok: false as const, error: 'V3 factory not configured on API.' };
  }
  let factory: Address;
  try {
    factory = getAddress(factoryRaw);
  } catch {
    return { ok: false as const, error: 'Invalid factory address for this token.' };
  }

  const client = publicClient();
  const fractionCollection = await client.readContract({
    address: factory,
    abi: FRACTION_FACTORY_ABI,
    functionName: 'fractionCollectionForToken',
    args: [token],
  });

  if (!fractionCollection || fractionCollection === zeroAddress) {
    return {
      ok: false as const,
      error: 'No Holder NFT fraction contract for this token.',
      tokenPageUrl: tokenPageUrl(token),
    };
  }

  return {
    ok: true as const,
    token,
    symbol: row.tokenSymbol.replace(/^\$/, ''),
    fractionCollection: getAddress(fractionCollection),
  };
}

async function fractionSupportsBatchAirdrop(fractionCollection: Address): Promise<boolean> {
  const client = publicClient();
  try {
    await client.simulateContract({
      address: fractionCollection,
      abi: HOODMARKETS_V3_FRACTION_ABI,
      functionName: 'airdropShares',
      args: [[zeroAddress], [0n]],
      account: '0x0000000000000000000000000000000000000001',
    });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return BATCH_AIRDROP_PROBE_REVERTS.test(msg);
  }
}

function parsePositiveInt(raw: unknown): number | null {
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number.parseInt(raw.trim(), 10)
        : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseAirdropEntries(body: {
  recipient?: unknown;
  recipients?: unknown;
  amount?: unknown;
  amounts?: unknown;
  shareAmount?: unknown;
  shares?: unknown;
}): { ok: true; recipients: Address[]; amounts: bigint[] } | { ok: false; error: string } {
  const rawList: unknown[] = [];
  if (typeof body.recipient === 'string' && body.recipient.trim()) {
    rawList.push(body.recipient.trim());
  }
  if (Array.isArray(body.recipients)) {
    for (const item of body.recipients) {
      if (typeof item === 'string' && item.trim()) rawList.push(item.trim());
    }
  }

  if (rawList.length === 0) {
    return {
      ok: false,
      error: 'recipient or recipients[] is required (one or more 0x wallet addresses).',
    };
  }
  if (rawList.length > MAX_AIRDROP_RECIPIENTS) {
    return {
      ok: false,
      error: `Too many recipients (max ${MAX_AIRDROP_RECIPIENTS}). Split into multiple airdrops.`,
    };
  }

  const recipients: Address[] = [];
  const seen = new Set<string>();
  for (const raw of rawList) {
    try {
      const addr = getAddress(raw);
      if (addr === zeroAddress) {
        return { ok: false, error: 'Recipient cannot be the zero address.' };
      }
      const key = addr.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      recipients.push(addr);
    } catch {
      return { ok: false, error: `Invalid recipient address: ${raw}` };
    }
  }

  const defaultAmount =
    parsePositiveInt(body.amount) ??
    parsePositiveInt(body.shareAmount) ??
    parsePositiveInt(body.shares) ??
    1;

  let amounts: bigint[];
  if (body.amounts !== undefined) {
    if (!Array.isArray(body.amounts)) {
      return { ok: false, error: 'amounts must be an array when provided.' };
    }
    if (body.amounts.length !== recipients.length) {
      return {
        ok: false,
        error: 'amounts[] length must match recipients[] length.',
      };
    }
    amounts = [];
    for (const raw of body.amounts) {
      const n = parsePositiveInt(raw);
      if (n == null) {
        return { ok: false, error: 'Each amount in amounts[] must be a positive integer.' };
      }
      amounts.push(BigInt(n));
    }
  } else {
    amounts = recipients.map(() => BigInt(defaultAmount));
  }

  return { ok: true, recipients, amounts };
}

export async function listAgentFractionListings(tokenRaw: string): Promise<
  | {
      ok: true;
      tokenAddress: Address;
      tokenSymbol: string;
      fractionCollection: Address;
      listings: AgentFractionListing[];
      tokenPageUrl: string;
    }
  | { ok: false; error: string; tokenPageUrl?: string }
> {
  const ctx = await loadFractionContext(tokenRaw);
  if (!ctx.ok) return ctx;

  const client = publicClient();
  const nextId = await client.readContract({
    address: ctx.fractionCollection,
    abi: HOODMARKETS_V3_FRACTION_ABI,
    functionName: 'nextListingId',
  });
  const max = Number(nextId);
  if (max <= 1) {
    return {
      ok: true,
      tokenAddress: ctx.token,
      tokenSymbol: ctx.symbol,
      fractionCollection: ctx.fractionCollection,
      listings: [],
      tokenPageUrl: tokenPageUrl(ctx.token),
    };
  }

  const listings: AgentFractionListing[] = [];
  for (let id = 1; id < max; id++) {
    const [seller, shareAmount, paymentToken, price, active] = await client.readContract({
      address: ctx.fractionCollection,
      abi: HOODMARKETS_V3_FRACTION_ABI,
      functionName: 'listings',
      args: [BigInt(id)],
    });
    if (!active) continue;
    const priceWei = price as bigint;
    listings.push({
      listingId: id,
      seller: getAddress(seller as Address),
      shareAmount: Number(shareAmount),
      paymentToken: getAddress(paymentToken as Address),
      priceWei: priceWei.toString(),
      priceEth: formatEther(priceWei),
      active: true,
    });
  }

  return {
    ok: true,
    tokenAddress: ctx.token,
    tokenSymbol: ctx.symbol,
    fractionCollection: ctx.fractionCollection,
    listings,
    tokenPageUrl: tokenPageUrl(ctx.token),
  };
}

export async function prepareAgentBuyShares(params: {
  wallet: Address;
  tokenAddress: string;
  listingId: unknown;
}): Promise<
  | {
      ok: true;
      chainId: number;
      tokenAddress: Address;
      tokenSymbol: string;
      fractionCollection: Address;
      listing: AgentFractionListing;
      transactions: AgentPreparedTx[];
      tokenPageUrl: string;
      replyHint: string;
      confirmHint: string;
      bankrWalletSubmitRequired: true;
      platformFeeNote: string;
    }
  | { ok: false; error: string; hint?: string; tokenPageUrl?: string; listings?: AgentFractionListing[] }
> {
  const listingId =
    typeof params.listingId === 'number'
      ? params.listingId
      : typeof params.listingId === 'string'
        ? Number.parseInt(params.listingId.trim(), 10)
        : NaN;
  if (!Number.isFinite(listingId) || listingId <= 0) {
    return { ok: false, error: 'listingId is required (positive integer).' };
  }

  const ctx = await loadFractionContext(params.tokenAddress);
  if (!ctx.ok) return ctx;

  const client = publicClient();
  const [seller, shareAmount, paymentToken, price, active] = await client.readContract({
    address: ctx.fractionCollection,
    abi: HOODMARKETS_V3_FRACTION_ABI,
    functionName: 'listings',
    args: [BigInt(listingId)],
  });

  if (!active || seller === zeroAddress) {
    const all = await listAgentFractionListings(params.tokenAddress);
    return {
      ok: false,
      error: `Listing #${listingId} is not active.`,
      tokenPageUrl: tokenPageUrl(ctx.token),
      listings: all.ok ? all.listings : undefined,
      hint: 'GET /api/agent/fraction-listings?token=… for current listings.',
    };
  }

  const payToken = getAddress(paymentToken as Address);
  if (payToken.toLowerCase() !== zeroAddress) {
    return {
      ok: false,
      error: 'Only native ETH listings are supported via the agent API right now.',
      hint: 'Use hood.markets token page for ERC-20 priced listings.',
      tokenPageUrl: tokenPageUrl(ctx.token),
    };
  }

  const priceWei = price as bigint;
  const listing: AgentFractionListing = {
    listingId,
    seller: getAddress(seller as Address),
    shareAmount: Number(shareAmount),
    paymentToken: payToken,
    priceWei: priceWei.toString(),
    priceEth: formatEther(priceWei),
    active: true,
  };

  const data = encodeFunctionData({
    abi: HOODMARKETS_V3_FRACTION_ABI,
    functionName: 'buyShares',
    args: [BigInt(listingId)],
  });

  const platformFeeWei = (priceWei * BigInt(SHARE_SALE_PLATFORM_FEE_BPS)) / 10_000n;
  const sellerProceedsWei = priceWei - platformFeeWei;

  return {
    ok: true,
    chainId: ROBINHOOD_CHAIN_ID,
    tokenAddress: ctx.token,
    tokenSymbol: ctx.symbol,
    fractionCollection: ctx.fractionCollection,
    listing,
    transactions: [
      {
        step: 'buyShares',
        to: ctx.fractionCollection,
        data,
        value: toHex(priceWei),
        chainId: ROBINHOOD_CHAIN_ID,
        description: `Buy ${listing.shareAmount} Holder share(s) for $${ctx.symbol} — listing #${listingId} (${listing.priceEth} ETH).`,
      },
    ],
    tokenPageUrl: tokenPageUrl(ctx.token),
    replyHint: `Prepared buyShares for listing #${listingId}: ${listing.shareAmount} share(s) for ${listing.priceEth} ETH on $${ctx.symbol}. Submit via Bankr /wallet/submit on Robinhood (4663).`,
    confirmHint:
      'Submit via Bankr /wallet/submit with waitForConfirmation: true. Send exactly the listing price as msg.value.',
    bankrWalletSubmitRequired: true,
    platformFeeNote: `5% platform fee (~${formatEther(platformFeeWei)} ETH) · seller receives ~${formatEther(sellerProceedsWei)} ETH.`,
  };
}

export async function prepareAgentListShares(params: {
  wallet: Address;
  tokenAddress: string;
  shareAmount?: unknown;
  priceEth?: unknown;
}): Promise<
  | {
      ok: true;
      chainId: number;
      tokenAddress: Address;
      tokenSymbol: string;
      fractionCollection: Address;
      shareAmount: number;
      priceEth: string;
      transactions: AgentPreparedTx[];
      tokenPageUrl: string;
      replyHint: string;
      confirmHint: string;
      bankrWalletSubmitRequired: true;
    }
  | { ok: false; error: string; hint?: string; tokenPageUrl?: string }
> {
  const shareAmount =
    typeof params.shareAmount === 'number'
      ? params.shareAmount
      : typeof params.shareAmount === 'string'
        ? Number.parseInt(params.shareAmount.trim(), 10)
        : NaN;
  if (!Number.isFinite(shareAmount) || shareAmount <= 0) {
    return { ok: false, error: 'shareAmount is required (positive integer).' };
  }

  const priceRaw = typeof params.priceEth === 'string' ? params.priceEth.trim() : '';
  if (!priceRaw) {
    return { ok: false, error: 'priceEth is required (e.g. 0.05).' };
  }

  let priceWei: bigint;
  try {
    priceWei = parseEther(priceRaw);
  } catch {
    return { ok: false, error: 'priceEth must be a valid ETH amount.' };
  }
  if (priceWei <= 0n) {
    return { ok: false, error: 'priceEth must be positive.' };
  }

  const ctx = await loadFractionContext(params.tokenAddress);
  if (!ctx.ok) return ctx;

  const client = publicClient();
  const balance = await client.readContract({
    address: ctx.fractionCollection,
    abi: HOODMARKETS_V3_FRACTION_ABI,
    functionName: 'balanceOf',
    args: [params.wallet, FRACTION_TOKEN_ID],
  });
  if (Number(balance) < shareAmount) {
    return {
      ok: false,
      error: `Insufficient Holder shares. Wallet holds ${balance}; requested ${shareAmount}.`,
      tokenPageUrl: tokenPageUrl(ctx.token),
    };
  }

  const data = encodeFunctionData({
    abi: HOODMARKETS_V3_FRACTION_ABI,
    functionName: 'listShares',
    args: [BigInt(shareAmount), zeroAddress, priceWei],
  });

  return {
    ok: true,
    chainId: ROBINHOOD_CHAIN_ID,
    tokenAddress: ctx.token,
    tokenSymbol: ctx.symbol,
    fractionCollection: ctx.fractionCollection,
    shareAmount,
    priceEth: formatEther(priceWei),
    transactions: [
      {
        step: 'listShares',
        to: ctx.fractionCollection,
        data,
        value: '0x0',
        chainId: ROBINHOOD_CHAIN_ID,
        description: `List ${shareAmount} Holder share(s) for ${formatEther(priceWei)} ETH (${ctx.symbol}).`,
      },
    ],
    tokenPageUrl: tokenPageUrl(ctx.token),
    replyHint: `Prepared listShares: ${shareAmount} share(s) for ${formatEther(priceWei)} ETH on $${ctx.symbol}. Submit via Bankr /wallet/submit.`,
    confirmHint:
      'Submit via Bankr /wallet/submit with waitForConfirmation: true. Listing is native ETH only.',
    bankrWalletSubmitRequired: true,
  };
}

export async function prepareAgentCancelListing(params: {
  wallet: Address;
  tokenAddress: string;
  listingId: unknown;
}): Promise<
  | {
      ok: true;
      chainId: number;
      tokenAddress: Address;
      tokenSymbol: string;
      fractionCollection: Address;
      listingId: number;
      transactions: AgentPreparedTx[];
      tokenPageUrl: string;
      replyHint: string;
      confirmHint: string;
      bankrWalletSubmitRequired: true;
    }
  | { ok: false; error: string; tokenPageUrl?: string }
> {
  const listingId =
    typeof params.listingId === 'number'
      ? params.listingId
      : typeof params.listingId === 'string'
        ? Number.parseInt(params.listingId.trim(), 10)
        : NaN;
  if (!Number.isFinite(listingId) || listingId <= 0) {
    return { ok: false, error: 'listingId is required (positive integer).' };
  }

  const ctx = await loadFractionContext(params.tokenAddress);
  if (!ctx.ok) return ctx;

  const client = publicClient();
  const [seller, , , , active] = await client.readContract({
    address: ctx.fractionCollection,
    abi: HOODMARKETS_V3_FRACTION_ABI,
    functionName: 'listings',
    args: [BigInt(listingId)],
  });

  if (!active) {
    return {
      ok: false,
      error: `Listing #${listingId} is not active.`,
      tokenPageUrl: tokenPageUrl(ctx.token),
    };
  }
  if (getAddress(seller as Address).toLowerCase() !== params.wallet.toLowerCase()) {
    return {
      ok: false,
      error: 'Only the listing seller can cancel this listing.',
      tokenPageUrl: tokenPageUrl(ctx.token),
    };
  }

  const data = encodeFunctionData({
    abi: HOODMARKETS_V3_FRACTION_ABI,
    functionName: 'cancelListing',
    args: [BigInt(listingId)],
  });

  return {
    ok: true,
    chainId: ROBINHOOD_CHAIN_ID,
    tokenAddress: ctx.token,
    tokenSymbol: ctx.symbol,
    fractionCollection: ctx.fractionCollection,
    listingId,
    transactions: [
      {
        step: 'cancelListing',
        to: ctx.fractionCollection,
        data,
        value: '0x0',
        chainId: ROBINHOOD_CHAIN_ID,
        description: `Cancel Holder share listing #${listingId} for ${ctx.symbol}.`,
      },
    ],
    tokenPageUrl: tokenPageUrl(ctx.token),
    replyHint: `Prepared cancelListing #${listingId} for $${ctx.symbol}. Submit via Bankr /wallet/submit.`,
    confirmHint: 'Submit via Bankr /wallet/submit with waitForConfirmation: true.',
    bankrWalletSubmitRequired: true,
  };
}

export async function prepareAgentAirdropShares(params: {
  wallet: Address;
  tokenAddress: string;
  recipient?: unknown;
  recipients?: unknown;
  amount?: unknown;
  amounts?: unknown;
  shareAmount?: unknown;
  shares?: unknown;
}): Promise<
  | {
      ok: true;
      chainId: number;
      tokenAddress: Address;
      tokenSymbol: string;
      fractionCollection: Address;
      recipients: Address[];
      amounts: number[];
      totalShares: number;
      batched: boolean;
      transactions: AgentPreparedTx[];
      tokenPageUrl: string;
      replyHint: string;
      confirmHint: string;
      bankrWalletSubmitRequired: true;
      platformFeeNote: string;
    }
  | { ok: false; error: string; hint?: string; tokenPageUrl?: string }
> {
  const parsed = parseAirdropEntries(params);
  if (!parsed.ok) return parsed;

  const ctx = await loadFractionContext(params.tokenAddress);
  if (!ctx.ok) return ctx;

  const totalShares = parsed.amounts.reduce((sum, n) => sum + n, 0n);
  const client = publicClient();
  const balance = await client.readContract({
    address: ctx.fractionCollection,
    abi: HOODMARKETS_V3_FRACTION_ABI,
    functionName: 'balanceOf',
    args: [params.wallet, FRACTION_TOKEN_ID],
  });
  if (balance < totalShares) {
    return {
      ok: false,
      error: `Insufficient Holder shares. Wallet holds ${balance}; airdrop needs ${totalShares}.`,
      tokenPageUrl: tokenPageUrl(ctx.token),
      hint: 'The signing wallet must hold the shares being airdropped.',
    };
  }

  const batched = await fractionSupportsBatchAirdrop(ctx.fractionCollection);
  const amountsHuman = parsed.amounts.map((n) => Number(n));
  const recipientSummary =
    parsed.recipients.length === 1
      ? parsed.recipients[0]
      : `${parsed.recipients.length} wallets`;

  let transactions: AgentPreparedTx[];

  if (batched) {
    const data = encodeFunctionData({
      abi: HOODMARKETS_V3_FRACTION_ABI,
      functionName: 'airdropShares',
      args: [parsed.recipients, parsed.amounts],
    });
    transactions = [
      {
        step: 'airdropShares',
        to: ctx.fractionCollection,
        data,
        value: '0x0',
        chainId: ROBINHOOD_CHAIN_ID,
        description: `Airdrop ${totalShares} Holder share(s) for $${ctx.symbol} to ${recipientSummary}.`,
      },
    ];
  } else {
    transactions = parsed.recipients.map((recipient, i) => {
      const amount = parsed.amounts[i];
      const data = encodeFunctionData({
        abi: HOODMARKETS_V3_FRACTION_ABI,
        functionName: 'safeTransferFrom',
        args: [params.wallet, recipient, FRACTION_TOKEN_ID, amount, '0x'],
      });
      return {
        step: `transferShare-${i + 1}`,
        to: ctx.fractionCollection,
        data,
        value: '0x0' as const,
        chainId: ROBINHOOD_CHAIN_ID,
        description: `Send ${amount} Holder share(s) for $${ctx.symbol} to ${recipient}.`,
      };
    });
  }

  const shareWord = Number(totalShares) === 1 ? 'share' : 'shares';
  const replyHint =
    parsed.recipients.length === 1
      ? `Prepared airdrop: ${amountsHuman[0]} Holder ${shareWord} for $${ctx.symbol} → ${parsed.recipients[0]}. Submit via Bankr /wallet/submit on Robinhood (4663).`
      : `Prepared airdrop: ${totalShares} Holder shares for $${ctx.symbol} to ${parsed.recipients.length} wallets. Submit ${transactions.length} tx(s) via Bankr /wallet/submit.`;

  return {
    ok: true,
    chainId: ROBINHOOD_CHAIN_ID,
    tokenAddress: ctx.token,
    tokenSymbol: ctx.symbol,
    fractionCollection: ctx.fractionCollection,
    recipients: parsed.recipients,
    amounts: amountsHuman,
    totalShares: Number(totalShares),
    batched,
    transactions,
    tokenPageUrl: tokenPageUrl(ctx.token),
    replyHint,
    confirmHint:
      transactions.length === 1
        ? 'Submit via Bankr /wallet/submit with waitForConfirmation: true. No platform fee on airdrops (v0.11+).'
        : 'Submit each transaction in order via Bankr /wallet/submit. No platform fee on transfers (v0.11+).',
    bankrWalletSubmitRequired: true,
    platformFeeNote: 'No platform fee on Holder share airdrops or wallet sends (v0.11+ factory).',
  };
}
