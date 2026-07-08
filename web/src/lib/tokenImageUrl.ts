const IPFS_PATH = /\/ipfs\/([^/?#]+)/i;
const IPFS_PROTO = /^ipfs:\/\/([^/?#]+)/i;
const LIGHTHOUSE_VIEW_FILE = /\/viewFile\/([^/?#]+)/i;
const RAW_CID = /^(bafkrei[a-z0-9]{52,}|Qm[1-9A-HJ-NP-Za-km-z]{44,})$/i;

/** Public gateways work from the browser without Pinata gateway tokens. */
const PUBLIC_IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs',
  'https://dweb.link/ipfs',
  'https://ipfs.io/ipfs',
  'https://alternative-sparrow-qk8yx.lighthouseweb3.xyz/ipfs',
];

const DEDICATED_GATEWAY = (import.meta.env.VITE_IPFS_GATEWAY_URL as string | undefined)
  ?.trim()
  .replace(/\/$/, '');

const GATEWAY_FALLBACKS = [
  ...PUBLIC_IPFS_GATEWAYS,
  DEDICATED_GATEWAY,
].filter((g): g is string => !!g);

const DIRECT_IMAGE = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i;

function isDedicatedPinataGateway(url: string): boolean {
  return /mypinata\.cloud/i.test(url);
}

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

export function looksLikeDirectImageUrl(url: string | undefined | null): boolean {
  const raw = url?.trim();
  if (!raw) return false;
  if (extractIpfsCid(raw)) return true;
  if (DIRECT_IMAGE.test(raw)) return true;
  if (/^https?:\/\/i\.ibb\.co(?:\.com)?\//i.test(raw)) return true;
  return false;
}

/** Ordered URLs to try when rendering a token logo (public gateways before dedicated Pinata). */
export function buildTokenImageCandidates(imageUrl: string | undefined | null): string[] {
  const raw = imageUrl?.trim();
  if (!raw) return [];
  const cid = extractIpfsCid(raw);
  if (!cid) return [raw];

  const gateways = gatewayUrlsForCid(cid);
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    return gateways.slice(0, 5);
  }

  if (isDedicatedPinataGateway(raw)) {
    return [...new Set([...gateways.filter((g) => g !== raw), raw])].slice(0, 5);
  }

  return [...new Set([...gateways.filter((g) => g !== raw), raw])].slice(0, 5);
}

/** Primary resolved logo URL (first candidate). */
export function resolveTokenImageUrl(imageUrl: string | undefined | null): string | undefined {
  return buildTokenImageCandidates(imageUrl)[0];
}
