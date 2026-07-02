import { createPublicClient, http } from 'viem';
import { robinhood } from '../chain';

const TOKEN_METADATA_ABI = [
  {
    type: 'function',
    name: 'metadata',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
] as const;

function firstParagraph(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return trimmed.split(/\n\n+/)[0]?.trim() ?? trimmed;
}

/** Read user description from on-chain token metadata JSON (V3/V4 hood tokens). */
export async function fetchTokenDescriptionFromChain(
  tokenAddress: string,
): Promise<string | undefined> {
  try {
    const client = createPublicClient({
      chain: robinhood,
      transport: http(),
    });
    const raw = await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: TOKEN_METADATA_ABI,
      functionName: 'metadata',
    });
    if (typeof raw !== 'string' || !raw.trim()) return undefined;

    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed) as { description?: unknown };
      if (typeof parsed.description === 'string' && parsed.description.trim()) {
        return firstParagraph(parsed.description);
      }
      return undefined;
    }

    return firstParagraph(trimmed);
  } catch {
    return undefined;
  }
}
