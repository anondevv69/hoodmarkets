import { useEffect, useMemo, useState } from 'react';
import { buildTokenImageCandidates } from '../lib/tokenImageUrl';

function initials(symbol: string): string {
  const s = symbol.replace(/^\$/, '').trim();
  return (s.slice(0, 2) || '?').toUpperCase();
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
  /** Eager-load for above-the-fold hero avatars. */
  priority?: boolean;
}) {
  const candidates = useMemo(() => buildTokenImageCandidates(imageUrl), [imageUrl]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
    setLoaded(false);
  }, [imageUrl]);

  const src = candidates[candidateIndex];
  const showImage = !!src && candidateIndex < candidates.length;
  const showInitials = !showImage || !loaded;

  return (
    <div
      className="token-avatar-wrap"
      style={{ width: size, height: size }}
      aria-label={symbol}
    >
      {showInitials ? (
        <div
          className="token-avatar token-avatar-fallback"
          style={{ fontSize: size * 0.36 }}
          aria-hidden={showImage}
        >
          {initials(symbol)}
        </div>
      ) : null}
      {showImage ? (
        <img
          src={src}
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
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            if (naturalWidth >= 8 && naturalHeight >= 8) {
              setLoaded(true);
              return;
            }
            setLoaded(false);
            setCandidateIndex((i) => i + 1);
          }}
          onError={() => {
            setLoaded(false);
            setCandidateIndex((i) => i + 1);
          }}
        />
      ) : null}
    </div>
  );
}
