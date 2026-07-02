import { extractImageUrlFromText, extractTwitterMediaImageUrl } from './imageSources.js';

export type AgentDeployImageSource =
  | 'imageUrl'
  | 'tweetImageUrl'
  | 'mediaUrl'
  | 'tweet_media'
  | 'tweetMedia'
  | 'tweet_text'
  | 'tweet_oembed';

export type AgentDeployImageInput = {
  imageUrl?: unknown;
  /** First photo from the original X tweet (pbs.twimg.com). */
  tweetImageUrl?: unknown;
  mediaUrl?: unknown;
  /** HTTPS URLs from tweet attachments. */
  tweetMedia?: unknown;
  /** Full tweet text — used to extract inline image URLs. */
  tweetText?: unknown;
  /** Twitter API tweet object (`extended_entities.media`, etc.). */
  tweet?: unknown;
  /** Full X status URL — API resolves attached photo via oEmbed when Bankr cannot see media. */
  tweetUrl?: unknown;
};

function normalizeHttpsImageUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim();
  if (!t.startsWith('https://') && !t.startsWith('http://')) return undefined;
  return t.slice(0, 2048);
}

function firstUrlFromArray(raw: unknown): string | undefined {
  if (!Array.isArray(raw)) return undefined;
  for (const item of raw) {
    const direct = normalizeHttpsImageUrl(item);
    if (direct) return direct;
    if (item && typeof item === 'object') {
      const url = (item as { url?: unknown }).url;
      const nested = normalizeHttpsImageUrl(url);
      if (nested) return nested;
    }
  }
  return undefined;
}

/**
 * Resolve token logo for agent deploy from explicit fields or original tweet context.
 * Priority: imageUrl → tweetImageUrl → mediaUrl → tweetMedia[] → tweet object media → tweet text URL.
 */
export function resolveAgentDeployImageUrl(
  input: AgentDeployImageInput,
): { imageUrl: string | undefined; imageSource: AgentDeployImageSource | null } {
  const explicit = normalizeHttpsImageUrl(input.imageUrl);
  if (explicit) return { imageUrl: explicit, imageSource: 'imageUrl' };

  const tweetImg = normalizeHttpsImageUrl(input.tweetImageUrl);
  if (tweetImg) return { imageUrl: tweetImg, imageSource: 'tweetImageUrl' };

  const media = normalizeHttpsImageUrl(input.mediaUrl);
  if (media) return { imageUrl: media, imageSource: 'mediaUrl' };

  const fromArray = firstUrlFromArray(input.tweetMedia);
  if (fromArray) return { imageUrl: fromArray, imageSource: 'tweetMedia' };

  if (input.tweet && typeof input.tweet === 'object') {
    const fromTweet = extractTwitterMediaImageUrl(input.tweet);
    const u = normalizeHttpsImageUrl(fromTweet);
    if (u) return { imageUrl: u, imageSource: 'tweet_media' };
  }

  if (typeof input.tweetText === 'string') {
    const fromText = extractImageUrlFromText(input.tweetText);
    const u = normalizeHttpsImageUrl(fromText);
    if (u) return { imageUrl: u, imageSource: 'tweet_text' };
  }

  return { imageUrl: undefined, imageSource: null };
}

const X_STATUS_URL_RE = /(?:twitter\.com|x\.com)\/\w+\/status\/\d+/i;

/** Normalize an X/Twitter status URL for oEmbed lookup. */
export function normalizeTweetStatusUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed || !X_STATUS_URL_RE.test(trimmed)) return undefined;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    if (host !== 'x.com' && host !== 'twitter.com') return undefined;
    return u.toString().slice(0, 512);
  } catch {
    return undefined;
  }
}

/** Resolve attached photo from an X status URL via publish.twitter.com oEmbed. */
export async function resolveTweetImageFromOembed(tweetUrl: string): Promise<string | undefined> {
  const oembed = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true&dnt=true`;
  const res = await fetch(oembed, {
    headers: { 'User-Agent': 'HoodMarkets/1.0' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return undefined;

  const j = (await res.json()) as { thumbnail_url?: string; html?: string };
  const thumb = normalizeHttpsImageUrl(j.thumbnail_url);
  if (thumb) return thumb;

  if (typeof j.html === 'string') {
    const img = j.html.match(/<img[^>]+src=["']([^"']+)["']/i);
    const fromHtml = normalizeHttpsImageUrl(img?.[1]);
    if (fromHtml) return fromHtml;
  }

  return undefined;
}

/**
 * Resolve token logo — sync fields first, then optional tweetUrl oEmbed (for Bankr on X).
 */
export async function resolveAgentDeployImageUrlAsync(
  input: AgentDeployImageInput,
): Promise<{ imageUrl: string | undefined; imageSource: AgentDeployImageSource | null }> {
  const sync = resolveAgentDeployImageUrl(input);
  if (sync.imageUrl && sync.imageSource) return sync;

  const tweetUrl = normalizeTweetStatusUrl(input.tweetUrl);
  if (tweetUrl) {
    const fromOembed = await resolveTweetImageFromOembed(tweetUrl);
    if (fromOembed) return { imageUrl: fromOembed, imageSource: 'tweet_oembed' };
  }

  return sync;
}

export type AgentDeployConfirmSummary = {
  name: string;
  symbol: string;
  launchMode: 'simple' | 'pro';
  feeRecipient: string;
  imageUrl: string;
  imageSource: AgentDeployImageSource;
  description?: string;
  websiteUrl?: string;
  xUrl?: string;
};

export function buildAgentDeployConfirmSummary(input: {
  name: string;
  symbol: string;
  launchMode: 'simple' | 'pro';
  feeRecipient: string;
  imageUrl: string;
  imageSource: AgentDeployImageSource;
  description?: string;
  websiteUrl?: string;
  xUrl?: string;
}): AgentDeployConfirmSummary {
  return {
    name: input.name,
    symbol: input.symbol,
    launchMode: input.launchMode,
    feeRecipient: input.feeRecipient,
    imageUrl: input.imageUrl,
    imageSource: input.imageSource,
    ...(input.description ? { description: input.description } : {}),
    ...(input.websiteUrl ? { websiteUrl: input.websiteUrl } : {}),
    ...(input.xUrl ? { xUrl: input.xUrl } : {}),
  };
}

export function agentDeployConfirmReplyHint(summary: AgentDeployConfirmSummary): string {
  const mode = summary.launchMode === 'pro' ? 'pro (hood.markets swap)' : 'simple (DexScreener)';
  return (
    `Launch **${summary.name}** ($${summary.symbol}) on hood.markets?\n` +
    `- Logo: ${summary.imageUrl}\n` +
    `- Mode: ${mode}\n` +
    `- Fees: ${summary.feeRecipient}\n\n` +
    `Reply **yes** to deploy.`
  );
}
