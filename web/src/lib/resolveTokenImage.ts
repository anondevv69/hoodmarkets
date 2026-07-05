import { API_BASE } from '../api';
import { buildTokenImageCandidates, looksLikeDirectImageUrl } from './tokenImageUrl';

const cache = new Map<string, string | undefined>();
const inflight = new Map<string, Promise<string | undefined>>();

async function fetchResolvedImageUrl(raw: string): Promise<string | undefined> {
  const q = new URLSearchParams({ url: raw });
  const res = await fetch(`${API_BASE}/api/token-image?${q.toString()}`);
  if (!res.ok) return undefined;
  const body = (await res.json()) as { imageUrl?: string };
  const resolved = body.imageUrl?.trim();
  return resolved || undefined;
}

/** Prefer direct/IPFS URLs; resolve imgbb / kommodo page links via API when needed. */
export async function resolveExploreTokenImageUrl(
  raw: string | undefined | null,
): Promise<string | undefined> {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return undefined;

  if (looksLikeDirectImageUrl(trimmed) && buildTokenImageCandidates(trimmed).length > 0) {
    return trimmed;
  }

  const cached = cache.get(trimmed);
  if (cached !== undefined) return cached || undefined;

  let pending = inflight.get(trimmed);
  if (!pending) {
    pending = fetchResolvedImageUrl(trimmed)
      .then((resolved) => {
        cache.set(trimmed, resolved ?? '');
        return resolved;
      })
      .finally(() => {
        inflight.delete(trimmed);
      });
    inflight.set(trimmed, pending);
  }

  return pending;
}
