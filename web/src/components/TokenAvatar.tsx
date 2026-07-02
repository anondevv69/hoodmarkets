import { useState } from 'react';
import { resolveTokenImageUrl } from '../lib/tokenImageUrl';

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
  const [failed, setFailed] = useState(false);
  const src = resolveTokenImageUrl(imageUrl);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        className="token-avatar token-avatar-img"
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="token-avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(symbol)}
    </div>
  );
}
