import { config } from '../config.js';

const IPFS_PATH = /\/ipfs\/([^/?#]+)/i;
const IPFS_PROTO = /^ipfs:\/\/([^/?#]+)/i;

/** Extract a CID from common IPFS URL shapes. */
export function extractIpfsCid(url: string): string | undefined {
  const t = url.trim();
  const proto = IPFS_PROTO.exec(t);
  if (proto?.[1]) return proto[1];
  const path = IPFS_PATH.exec(t);
  if (path?.[1]) return path[1];
  return undefined;
}

/**
 * Rewrite IPFS image URLs to a working public gateway.
 * Fixes legacy `gateway.lighthouse.storage` links that return 402 without a paid plan.
 */
export function resolveTokenImageUrl(
  imageUrl: string | undefined | null,
  gatewayBase?: string,
): string | undefined {
  const raw = imageUrl?.trim();
  if (!raw) return undefined;

  const gateway = (gatewayBase ?? config.lighthouse.ipfsGatewayBase).replace(/\/$/, '');
  const cid = extractIpfsCid(raw);
  if (cid) return `${gateway}/${cid}`;

  return raw;
}
