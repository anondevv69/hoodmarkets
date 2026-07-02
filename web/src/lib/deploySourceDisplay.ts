/** Human-readable launch channel for token detail pages. */

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

export interface DeploySourceDisplay {
  title: string;
  detail?: string;
}

export function formatDeploySource(input: {
  platform?: string;
  deployerLabel?: string;
  clientKind?: string;
  agentMetadata?: string;
  deployerId?: string;
}): DeploySourceDisplay {
  const platform = (input.platform || 'web').toLowerCase();
  const label = input.deployerLabel?.trim() || '';
  const clientKind = (input.clientKind || 'web').toLowerCase();
  const meta = parseAgentMetadata(input.agentMetadata);
  const provider = meta?.agentProvider?.trim();
  const isAgent =
    clientKind === 'agent' ||
    /^agent:/i.test(input.deployerId ?? '') ||
    /agent wallet/i.test(label);

  if (isAgent) {
    if (provider?.toLowerCase() === 'bankr') {
      return {
        title: 'Bankr agent',
        detail: 'Deployed via hood.markets API · fees to agent wallet',
      };
    }
    return {
      title: provider ? `Agent · ${provider}` : 'Agent',
      detail: 'Deployed via hood.markets API · wallet + captcha',
    };
  }

  switch (platform) {
    case 'x':
      return { title: 'X', detail: label || 'Launched from X' };
    case 'telegram':
      return { title: 'Telegram', detail: label || 'Launched from Telegram' };
    case 'discord':
      return { title: 'Discord', detail: label || 'Launched from Discord' };
    case 'farcaster':
      return { title: 'Farcaster', detail: label || 'Launched from Farcaster' };
    case 'github':
      return { title: 'GitHub', detail: label || 'Launched from GitHub' };
    default:
      break;
  }

  if (/signed in/i.test(label)) {
    return { title: 'hood.markets web', detail: 'Signed in' };
  }
  if (/anonymous|no dev/i.test(label)) {
    return { title: 'hood.markets web', detail: 'No Dev · anonymous' };
  }
  if (label) {
    return { title: 'hood.markets web', detail: label };
  }
  return { title: 'hood.markets web' };
}
