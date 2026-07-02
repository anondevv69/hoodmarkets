import { extractImageUrlFromText, extractTwitterMediaImageUrl } from './imageSources.js';

export type AgentDeployImageSource =
  | 'imageUrl'
  | 'tweetImageUrl'
  | 'mediaUrl'
  | 'tweet_media'
  | 'tweetMedia'
  | 'tweet_text';

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
