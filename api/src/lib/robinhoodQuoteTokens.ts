import { getAddress, type Address } from 'viem';
import { logger } from '../logger.js';
import { ROBINHOOD_CHAIN_ID, ROBINHOOD_WETH } from './robinhoodChain.js';
import { DEFAULT_LAUNCH_TICK } from './launchDefaults.js';
import { defaultEthUsdForQuoteLaunch, launchTickForQuoteUsd } from './quoteLaunchTick.js';
import { findWethQuotePool, hasWethQuoteLiquidity } from './wethQuotePool.js';

export type QuoteTokenKind = 'weth' | 'stable' | 'stock';

export type QuoteToken = {
  symbol: string;
  name: string;
  address: Address;
  kind: QuoteTokenKind;
  logoUrl?: string;
  /** Approximate USD price when known (stable = 1). */
  usdPrice?: number;
  wethPoolFee?: number;
  hasWethLiquidity?: boolean;
};

export type ResolvedQuoteToken = QuoteToken & {
  launchTick: number;
  wethHopPoolFee: number;
  isWeth: boolean;
};

const RHJ_ASSETS_URL = 'https://api.robinhood.com/rhj/assets';
const USDG_ADDRESS = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168' as Address;
const CACHE_TTL_MS = 15 * 60 * 1000;
const POOL_FEE = 10_000;

type RhjAsset = {
  tokenSymbol?: string;
  tokenName?: string;
  logoUrl?: string;
  status?: string;
  deployments?: { contractAddress?: string; chainId?: number }[];
};

let cached: { at: number; tokens: QuoteToken[]; byKey: Map<string, QuoteToken> } | null = null;

function kindForSymbol(symbol: string): QuoteTokenKind {
  const s = symbol.toUpperCase();
  if (s === 'WETH') return 'weth';
  if (s === 'USDG' || s === 'USDC' || s === 'USDT') return 'stable';
  return 'stock';
}

function indexKey(raw: string): string {
  return raw.trim().toLowerCase();
}

function buildIndex(tokens: QuoteToken[]): Map<string, QuoteToken> {
  const map = new Map<string, QuoteToken>();
  for (const t of tokens) {
    map.set(indexKey(t.symbol), t);
    map.set(indexKey(t.address), t);
  }
  return map;
}

function staticQuoteTokens(): QuoteToken[] {
  return [
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: getAddress(ROBINHOOD_WETH),
      kind: 'weth',
      usdPrice: defaultEthUsdForQuoteLaunch(),
      wethPoolFee: POOL_FEE,
      hasWethLiquidity: true,
    },
    {
      symbol: 'USDG',
      name: 'Robinhood USD',
      address: getAddress(USDG_ADDRESS),
      kind: 'stable',
      usdPrice: 1,
    },
  ];
}

async function fetchRhjStockTokens(): Promise<QuoteToken[]> {
  const res = await fetch(RHJ_ASSETS_URL, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`RHJ assets HTTP ${res.status}`);
  }
  const json = (await res.json()) as { assets?: RhjAsset[] };
  const out: QuoteToken[] = [];
  for (const asset of json.assets ?? []) {
    const symbol = asset.tokenSymbol?.trim();
    const name = asset.tokenName?.trim();
    if (!symbol || !name) continue;
    if (asset.status && asset.status !== 'ASSET_STATUS_ACTIVE') continue;
    const dep = (asset.deployments ?? []).find((d) => d.chainId === ROBINHOOD_CHAIN_ID);
    const addr = dep?.contractAddress?.trim();
    if (!addr) continue;
    try {
      out.push({
        symbol: symbol.toUpperCase(),
        name,
        address: getAddress(addr),
        kind: 'stock',
        logoUrl: asset.logoUrl?.trim() || undefined,
      });
    } catch {
      // skip invalid address
    }
  }
  out.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return out;
}

export async function listRobinhoodQuoteTokens(opts?: {
  refresh?: boolean;
  checkLiquidity?: boolean;
}): Promise<QuoteToken[]> {
  const now = Date.now();
  if (!opts?.refresh && cached && now - cached.at < CACHE_TTL_MS) {
    return cached.tokens;
  }

  const base = staticQuoteTokens();
  let stocks: QuoteToken[] = [];
  try {
    stocks = await fetchRhjStockTokens();
  } catch (err) {
    logger.warn('robinhoodQuoteTokens: RHJ fetch failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    if (cached) return cached.tokens;
  }

  const tokens = [...base, ...stocks];
  if (opts?.checkLiquidity) {
    await enrichQuoteTokenLiquidity(tokens);
  }

  cached = { at: now, tokens, byKey: buildIndex(tokens) };
  return tokens;
}

export async function enrichQuoteTokenLiquidity(tokens: QuoteToken[]): Promise<void> {
  await Promise.all(
    tokens.map(async (t) => {
      if (t.kind === 'weth') {
        t.hasWethLiquidity = true;
        t.wethPoolFee = POOL_FEE;
        return;
      }
      const match = await findWethQuotePool(t.address);
      t.hasWethLiquidity = match != null;
      t.wethPoolFee = match?.fee;
    }),
  );
}

export async function getQuoteTokenByKey(key: string): Promise<QuoteToken | null> {
  await listRobinhoodQuoteTokens();
  return cached?.byKey.get(indexKey(key)) ?? null;
}

export async function resolveQuoteTokenInput(
  raw: string | undefined | null,
  opts?: { requireLiquidity?: boolean },
): Promise<ResolvedQuoteToken> {
  const trimmed = (raw ?? 'WETH').trim();
  const token = await getQuoteTokenByKey(trimmed);
  if (!token) {
    throw new Error(
      `Unknown quote token "${trimmed}". Use WETH, USDG, or a Robinhood stock symbol from GET /api/quote-tokens.`,
    );
  }

  const isWeth = token.kind === 'weth';
  let wethHopPoolFee = POOL_FEE;
  let hasLiquidity = token.hasWethLiquidity ?? isWeth;

  if (!isWeth) {
    const match = await findWethQuotePool(token.address);
    hasLiquidity = match != null;
    wethHopPoolFee = match?.fee ?? POOL_FEE;
  }

  if (opts?.requireLiquidity && !hasLiquidity) {
    throw new Error(
      `No WETH/${token.symbol} Uniswap V3 pool on Robinhood yet — pick WETH or another quote with liquidity.`,
    );
  }

  const usd = token.usdPrice;
  const launchTick = isWeth
    ? DEFAULT_LAUNCH_TICK
    : usd != null
      ? launchTickForQuoteUsd(usd)
      : DEFAULT_LAUNCH_TICK;

  return {
    ...token,
    hasWethLiquidity: hasLiquidity,
    wethHopPoolFee,
    launchTick,
    isWeth,
  };
}

export async function quoteTokenSymbolForAddress(address: string): Promise<string | undefined> {
  try {
    const tok = await getQuoteTokenByKey(getAddress(address));
    return tok?.symbol;
  } catch {
    return undefined;
  }
}
