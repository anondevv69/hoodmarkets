/**
 * Find a likely token image URL in free-form text (tweets, casts, bios).
 */
export function extractImageUrlFromText(text: string): string | undefined {
  if (!text || !text.trim()) return undefined;

  // Direct image file URLs
  const withExt = text.match(
    /https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|svg)(?:\?[^\s<>"']*)?/i
  );
  if (withExt) return withExt[0];

  // Common CDNs / hosts where path may omit extension
  const hostRe =
    /https?:\/\/[^\s<>"']*(?:imagedelivery\.net|pbs\.twimg\.com|abs\.twimg\.com|i\.imgur\.com|media\.discordapp\.(?:net|com)|cdn\.discordapp\.com\/attachments)[^\s<>"']*/i;
  const hostMatch = text.match(hostRe);
  if (hostMatch) return hostMatch[0];

  return undefined;
}

/** X/Twitter tweet object: first attached photo (upload or some card previews). */
export function extractTwitterMediaImageUrl(tweet: any): string | undefined {
  const list =
    tweet?.extended_entities?.media ??
    tweet?.entities?.media ??
    [];
  const media = list[0];
  if (media?.type === 'photo' && media.media_url_https) {
    return media.media_url_https;
  }
  return undefined;
}

/** X author profile picture (Account Activity / v1.1 style user object on tweets). */
export function extractXProfileImageUrl(tweet: any): string | undefined {
  const u = tweet?.user;
  if (!u || typeof u !== 'object') return undefined;
  const raw =
    (typeof u.profile_image_url_https === 'string' && u.profile_image_url_https) ||
    (typeof u.profile_image_url === 'string' && u.profile_image_url) ||
    undefined;
  if (!raw || !raw.startsWith('http')) return undefined;
  // _normal.jpg → larger asset when Twitter uses that suffix
  return raw.replace(/_normal(\.(?:jpg|jpeg|png|webp))$/i, '_400x400$1');
}
