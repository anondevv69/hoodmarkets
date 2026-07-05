interface TokenSocialLinksProps {
  websiteUrl?: string;
  xUrl?: string;
  variant?: 'default' | 'inline';
}

function xHandleFromUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith('@')) return trimmed;
  try {
    const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = u.hostname.replace(/^www\./, '');
    if (host !== 'x.com' && host !== 'twitter.com') return trimmed;
    const segment = u.pathname.split('/').filter(Boolean)[0];
    if (!segment) return trimmed;
    return `@${segment.replace(/^@/, '')}`;
  } catch {
    return trimmed;
  }
}

function websiteHostname(url: string): string {
  const trimmed = url.trim();
  try {
    const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return trimmed.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M3 12h18M12 3c2.5 2.7 3.8 6.2 3.8 9s-1.3 6.3-3.8 9M12 3c-2.5 2.7-3.8 6.2-3.8 9s1.3 6.3 3.8 9"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function TokenSocialLinks({ websiteUrl, xUrl, variant = 'default' }: TokenSocialLinksProps) {
  const website = websiteUrl?.trim();
  const x = xUrl?.trim();
  if (!website && !x) return null;

  if (variant === 'inline') {
    return (
      <span className="token-social-links token-social-links--inline">
        {x ? (
          <a className="tp-social-link" href={x} target="_blank" rel="noreferrer">
            <XIcon />
            <span>{xHandleFromUrl(x)}</span>
          </a>
        ) : null}
        {website ? (
          <a className="tp-social-link" href={website} target="_blank" rel="noreferrer">
            <GlobeIcon />
            <span>{websiteHostname(website)}</span>
          </a>
        ) : null}
      </span>
    );
  }

  return (
    <p className="token-social-links">
      {website ? (
        <a href={website} target="_blank" rel="noreferrer">
          Website
        </a>
      ) : null}
      {website && x ? <span className="muted"> · </span> : null}
      {x ? (
        <a href={x} target="_blank" rel="noreferrer">
          X
        </a>
      ) : null}
    </p>
  );
}
