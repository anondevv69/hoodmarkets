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
}: {
  symbol: string;
  imageUrl?: string | null;
  size?: number;
}) {
  const candidates = useMemo(() => buildTokenImageCandidates(imageUrl), [imageUrl]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [imageUrl]);
  const src = candidates[candidateIndex];

  if (src && candidateIndex < candidates.length) {
    return (
      <img
        src={src}
        alt=""
        className="token-avatar token-avatar-img"
        width={size}
        height={size}
        loading="lazy"
        onError={() => setCandidateIndex((i) => i + 1)}
      />
    );
  }

  return (
    <div className="token-avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(symbol)}
    </div>
  );
}
