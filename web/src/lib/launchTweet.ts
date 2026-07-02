const X_STATUS_RE = /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i;
const X_WEB_STATUS_RE = /(?:twitter\.com|x\.com)\/i\/web\/status\/(\d+)/i;

function parseAgentMetadata(raw?: string): Record<string, string> | undefined {
  const s = raw?.trim();
  if (!s) return undefined;
  try {
    const v = JSON.parse(s) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === 'string' && val.trim()) out[k] = val.trim();
    }
    return Object.keys(out).length > 0 ? out : undefined;
  } catch {
    return undefined;
  }
}

export function isXTweetUrl(url: string): boolean {
  return X_STATUS_RE.test(url) || X_WEB_STATUS_RE.test(url);
}

/** Launch request tweet URL from catalog `sourceUrl` or agent metadata fallback. */
export function resolveTokenLaunchTweetUrl(input: {
  sourceUrl?: string;
  agentMetadata?: string;
}): string | undefined {
  const src = input.sourceUrl?.trim();
  if (src && isXTweetUrl(src)) return src;

  const meta = parseAgentMetadata(input.agentMetadata);
  const fromMeta = meta?.launchTweetUrl?.trim();
  if (fromMeta && isXTweetUrl(fromMeta)) return fromMeta;

  return undefined;
}
