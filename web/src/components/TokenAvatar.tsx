import { useEffect, useMemo, useState } from 'react';
import { buildTokenImageCandidates } from '../lib/tokenImageUrl';

function initials(symbol: string): string {
  const s = symbol.replace(/^\$/, '').trim();
  return (s.slice(0, 2) || '?').toUpperCase();
}

function probeImage(url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = window.setTimeout(() => {
      img.src = '';
      reject(new Error('timeout'));
    }, timeoutMs);

    img.onload = () => {
      window.clearTimeout(timer);
      if (img.naturalWidth >= 8 && img.naturalHeight >= 8) resolve(url);
      else reject(new Error('too small'));
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('load failed'));
    };
    img.decoding = 'async';
    img.src = url;
  });
}

export function TokenAvatar({
  symbol,
  imageUrl,
  size = 44,
  priority = false,
}: {
  symbol: string;
  imageUrl?: string | null;
  size?: number;
  /** Eager-load for above-the-fold avatars. */
  priority?: boolean;
}) {
  const candidates = useMemo(() => buildTokenImageCandidates(imageUrl), [imageUrl]);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setResolvedSrc(null);
    setLoaded(false);
    if (!candidates.length) return;

    let cancelled = false;
    const timeoutMs = priority ? 8000 : 5000;

    void (async () => {
      try {
        const winner = await Promise.any(
          candidates.map((url) => probeImage(url, timeoutMs)),
        );
        if (!cancelled) setResolvedSrc(winner);
      } catch {
        /* keep initials fallback */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [candidates, priority]);

  const showImage = !!resolvedSrc;

  return (
    <div
      className="token-avatar-wrap"
      style={{ width: size, height: size }}
      aria-label={symbol}
    >
      <div
        className="token-avatar token-avatar-fallback"
        style={{
          fontSize: size * 0.36,
          opacity: loaded && showImage ? 0 : 1,
        }}
        aria-hidden={loaded && showImage}
      >
        {initials(symbol)}
      </div>
      {showImage ? (
        <img
          src={resolvedSrc}
          alt=""
          className="token-avatar-img"
          width={size}
          height={size}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          style={{
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.15s ease',
          }}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setResolvedSrc(null);
          }}
        />
      ) : null}
    </div>
  );
}
