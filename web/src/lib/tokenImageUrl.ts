const IPFS_PATH = /\/ipfs\/([^/?#]+)/i;
const IPFS_PROTO = /^ipfs:\/\/([^/?#]+)/i;
const LIGHTHOUSE_VIEW_FILE = /\/viewFile\/([^/?#]+)/i;
const RAW_CID = /^(bafkrei[a-z0-9]{52,}|Qm[1-9A-HJ-NP-Za-km-z]{44,})$/i;

const GATEWAY_FALLBACKS = [
  (import.meta.env.VITE_IPFS_GATEWAY_URL as string | undefined)?.trim().replace(/\/$/, ''),
  'https://alternative-sparrow-qk8yx.lighthouseweb3.xyz/ipfs',
  'https://ipfs.io/ipfs',
].filter((g): g is string => !!g);

/** Extract a CID from common IPFS / Lighthouse URL shapes. */
export function extractIpfsCid(url: string): string | undefined {
  const t = url.trim();
  const proto = IPFS_PROTO.exec(t);
  if (proto?.[1]) return proto[1];
  const path = IPFS_PATH.exec(t);
  if (path?.[1]) return path[1];
  const view = LIGHTHOUSE_VIEW_FILE.exec(t);
  if (view?.[1]) return view[1];
  if (RAW_CID.test(t)) return t;
  return undefined;
}

function gatewayUrlsForCid(cid: string): string[] {
  return [...new Set(GATEWAY_FALLBACKS.map((base) => `${base}/${cid}`))];
}

/** Ordered URLs to try when rendering a token logo (gateways first, then raw URL). */
export function buildTokenImageCandidates(imageUrl: string | undefined | null): string[] {
  const raw = imageUrl?.trim();
  if (!raw) return [];
  const cid = extractIpfsCid(raw);
  if (cid) return gatewayUrlsForCid(cid);
  return [raw];
}

/** Primary resolved logo URL (first candidate). */
export function resolveTokenImageUrl(imageUrl: string | undefined | null): string | undefined {
  return buildTokenImageCandidates(imageUrl)[0];
}
