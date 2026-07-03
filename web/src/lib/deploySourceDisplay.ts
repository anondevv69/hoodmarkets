/** Human-readable launch channel for token detail pages. */

import { resolveRequesterXUsername } from './requesterXDisplay';

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

export interface DeployChannelDisplay {
  headline: string;
  subline?: string;
  xUsername?: string;
  tweetUrl?: string;
}

export function formatDeployChannel(input: {
  platform?: string;
  deployerLabel?: string;
  clientKind?: string;
  agentMetadata?: string;
  deployerId?: string;
  requesterXUsername?: string;
  sourceUrl?: string;
}): DeployChannelDisplay {
  const platform = (input.platform || 'web').toLowerCase();
  const label = input.deployerLabel?.trim() || '';
  const clientKind = (input.clientKind || 'web').toLowerCase();
  const meta = parseAgentMetadata(input.agentMetadata);
  const xUser = resolveRequesterXUsername({
    requesterXUsername: input.requesterXUsername,
    deployerLabel: label,
    agentMetadata: input.agentMetadata,
    sourceUrl: input.sourceUrl,
  });
  const isAgent =
    clientKind === 'agent' ||
    /^agent:/i.test(input.deployerId ?? '') ||
    /agent wallet/i.test(label);
  const tweetUrl = resolveTokenLaunchTweetUrl(input);

  if (isAgent && isAgentXLaunch(isAgent, meta, label)) {
    return {
      headline: 'Deployed via Bankr on X',
      ...(xUser ? { xUsername: xUser } : {}),
      ...(tweetUrl ? { tweetUrl } : {}),
    };
  }

  if (isAgent) {
    return {
      headline: 'Deployed via Bankr',
      subline: meta?.agentProvider ? `Agent · ${meta.agentProvider}` : undefined,
    };
  }

  if (platform === 'x') {
    return {
      headline: 'Deployed on X',
      ...(xUser ? { xUsername: xUser } : { subline: label || undefined }),
      ...(tweetUrl ? { tweetUrl } : {}),
    };
  }

  if (/anonymous|no dev/i.test(label)) {
    return { headline: 'Deployed on Web', subline: 'No Dev · anonymous' };
  }

  return {
    headline: 'Deployed on Web',
    subline: /signed in/i.test(label) ? 'Signed in' : label || undefined,
  };
}

function resolveTokenLaunchTweetUrl(input: {
  sourceUrl?: string;
  agentMetadata?: string;
}): string | undefined {
  const src = input.sourceUrl?.trim();
  if (src && /(?:twitter\.com|x\.com)\/.+\/status\//i.test(src)) return src;
  const meta = parseAgentMetadata(input.agentMetadata);
  const fromMeta = meta?.launchTweetUrl?.trim();
  if (fromMeta && /(?:twitter\.com|x\.com)\/.+\/status\//i.test(fromMeta)) return fromMeta;
  return undefined;
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
  requesterXUsername?: string;
  sourceUrl?: string;
}): DeploySourceDisplay {
  const platform = (input.platform || 'web').toLowerCase();
  const label = input.deployerLabel?.trim() || '';
  const clientKind = (input.clientKind || 'web').toLowerCase();
  const meta = parseAgentMetadata(input.agentMetadata);
  const provider = meta?.agentProvider?.trim();
  const xUser = resolveRequesterXUsername({
    requesterXUsername: input.requesterXUsername,
    deployerLabel: label,
    agentMetadata: input.agentMetadata,
    sourceUrl: input.sourceUrl,
  });
  const isAgent =
    clientKind === 'agent' ||
    /^agent:/i.test(input.deployerId ?? '') ||
    /agent wallet/i.test(label);

  if (xUser && (platform === 'x' || isAgent)) {
    return {
      title: `@${xUser}`,
      detail: isAgent
        ? isAgentXLaunch(isAgent, meta, label)
          ? 'Launched via Bankr on X'
          : 'Launched via Bankr'
        : 'Launched on X',
    };
  }

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

function isAgentXLaunch(
  isAgent: boolean,
  meta: Record<string, string> | undefined,
  label: string,
): boolean {
  if (!isAgent) return false;
  if (meta?.auth === 'x_confirm') return true;
  if (label.startsWith('@') && !/agent wallet/i.test(label)) return true;
  return false;
}
