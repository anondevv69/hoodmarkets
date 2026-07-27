import {
  createPublicClient,
  getAddress,
  http,
  parseAbi,
  type Address,
} from 'viem';
import { config } from '../config.js';
import { ROBINHOOD_WETH, robinhood } from './robinhoodChain.js';

export const ROBINHOOD_UNISWAP_V3_FACTORY =
  (process.env.UNISWAP_V3_FACTORY?.trim() ||
    '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA') as Address;

/** Common Uniswap V3 fee tiers on Robinhood — try lowest first. */
export const WETH_QUOTE_FEE_TIERS = [500, 3000, 10_000] as const;

const FACTORY_ABI = parseAbi(['function getPool(address, address, uint24) view returns (address)']);
const POOL_ABI = parseAbi(['function liquidity() view returns (uint128)']);

export type WethQuotePoolMatch = {
  poolAddress: Address;
  fee: number;
  liquidity: bigint;
};

export async function findWethQuotePool(quoteToken: Address): Promise<WethQuotePoolMatch | null> {
  const weth = getAddress(ROBINHOOD_WETH);
  const quote = getAddress(quoteToken);
  if (quote.toLowerCase() === weth.toLowerCase()) {
    return { poolAddress: weth, fee: 10_000, liquidity: 1n };
  }

  const client = createPublicClient({
    chain: robinhood,
    transport: http(config.chainRpcUrl),
  });

  for (const fee of WETH_QUOTE_FEE_TIERS) {
    try {
      const pool = await client.readContract({
        address: ROBINHOOD_UNISWAP_V3_FACTORY,
        abi: FACTORY_ABI,
        functionName: 'getPool',
        args: [weth, quote, fee],
      });
      if (!pool || pool === '0x0000000000000000000000000000000000000000') continue;

      const liquidity = await client.readContract({
        address: pool,
        abi: POOL_ABI,
        functionName: 'liquidity',
      });
      if (liquidity > 0n) {
        return { poolAddress: getAddress(pool), fee, liquidity };
      }
    } catch {
      // try next tier
    }
  }

  return null;
}

export async function hasWethQuoteLiquidity(quoteToken: Address): Promise<boolean> {
  const match = await findWethQuotePool(quoteToken);
  return match != null && match.liquidity > 0n;
}
