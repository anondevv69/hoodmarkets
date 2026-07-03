/** Resolve X @handle for who requested a launch (API field or metadata / label fallback). */
export function resolveRequesterXUsername(input: {
  requesterXUsername?: string;
  deployerLabel?: string;
  agentMetadata?: string;
  sourceUrl?: string;
}): string | undefined {
  const direct = input.requesterXUsername?.trim().replace(/^@/, '').toLowerCase();
  if (direct) return direct;

  const label = input.deployerLabel?.trim() ?? '';
  if (label.startsWith('@')) {
    const fromLabel = label.slice(1).split(/\s/)[0]?.replace(/^@/, '').toLowerCase();
    if (fromLabel) return fromLabel;
  }

  try {
    const meta = input.agentMetadata?.trim();
    if (meta) {
      const parsed = JSON.parse(meta) as { xUsername?: string };
      const fromMeta = parsed.xUsername?.trim().replace(/^@/, '').toLowerCase();
      if (fromMeta) return fromMeta;
    }
  } catch {
    /* ignore */
  }

  const src = input.sourceUrl?.trim();
  if (src) {
    const m = src.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]{1,15})\/status\//i);
    if (m) return m[1].toLowerCase();
  }

  return undefined;
}

export function xProfileUrl(username: string): string {
  return `https://x.com/${username.replace(/^@/, '')}`;
}
