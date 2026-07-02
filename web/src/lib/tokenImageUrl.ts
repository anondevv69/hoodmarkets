const IPFS_PATH = /\/ipfs\/([^/?#]+)/i;
const IPFS_PROTO = /^ipfs:\/\/([^/?#]+)/i;

const DEFAULT_GATEWAY =
  (import.meta.env.VITE_IPFS_GATEWAY_URL as string | undefined)?.trim().replace(/\/$/, '') ||
  'https://ipfs.io/ipfs';

export function extractIpfsCid(url: string): string | undefined {
  const t = url.trim();
  const proto = IPFS_PROTO.exec(t);
  if (proto?.[1]) return proto[1];
  const path = IPFS_PATH.exec(t);
  if (path?.[1]) return path[1];
  return undefined;
}

/** Resolve token logos through a public IPFS gateway (fixes broken Lighthouse gateway URLs). */
export function resolveTokenImageUrl(imageUrl: string | undefined | null): string | undefined {
  const raw = imageUrl?.trim();
  if (!raw) return undefined;
  const cid = extractIpfsCid(raw);
  if (cid) return `${DEFAULT_GATEWAY}/${cid}`;
  return raw;
}
