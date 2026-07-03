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

  return (
    <div
      className="token-avatar-wrap"
      style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}
    >
      <div
        className="token-avatar"
        style={{ width: size, height: size, fontSize: size * 0.36 }}
        aria-hidden={showImage && loaded}
      >
        {initials(symbol)}
      </div>
      {showImage ? (
        <img
          src={src}
          alt=""
          className="token-avatar token-avatar-img"
          width={size}
          height={size}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          style={{
            position: 'absolute',
            inset: 0,
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.15s ease',
          }}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setCandidateIndex((i) => i + 1);
          }}
        />
      ) : null}
    </div>
  );
}
