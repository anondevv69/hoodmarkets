import type { CustomSocialLink } from '../api';

interface TokenSocialLinksProps {
  websiteUrl?: string;
  xUrl?: string;
  telegramUrl?: string;
  discordUrl?: string;
  githubUrl?: string;
  customLinks?: CustomSocialLink[];
  variant?: 'default' | 'inline' | 'card';
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

function linkLabel(url: string, fallback: string): string {
  const t = url.trim();
  if (!t) return fallback;
  if (fallback === 'X') return xHandleFromUrl(t);
  if (fallback === 'Website') return websiteHostname(t);
  return fallback;
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

type LinkItem = { href: string; label: string; icon?: 'x' | 'globe' };

function collectLinks(props: TokenSocialLinksProps): LinkItem[] {
  const out: LinkItem[] = [];
  const website = props.websiteUrl?.trim();
  const x = props.xUrl?.trim();
  const telegram = props.telegramUrl?.trim();
  const discord = props.discordUrl?.trim();
  const github = props.githubUrl?.trim();

  if (website) out.push({ href: website, label: linkLabel(website, 'Website'), icon: 'globe' });
  if (x) out.push({ href: x, label: linkLabel(x, 'X'), icon: 'x' });
  if (telegram) out.push({ href: telegram, label: 'Telegram' });
  if (discord) out.push({ href: discord, label: 'Discord' });
  if (github) out.push({ href: github, label: 'GitHub' });
  for (const custom of props.customLinks ?? []) {
    const title = custom.title?.trim();
    const url = custom.url?.trim();
    if (title && url) out.push({ href: url, label: title });
  }
  return out;
}

export function TokenSocialLinks({
  websiteUrl,
  xUrl,
  telegramUrl,
  discordUrl,
  githubUrl,
  customLinks,
  variant = 'default',
}: TokenSocialLinksProps) {
  const links = collectLinks({ websiteUrl, xUrl, telegramUrl, discordUrl, githubUrl, customLinks });
  if (!links.length) return null;

  if (variant === 'card') {
    return (
      <div className="tp-token-card-socials">
        {links.map((link) => (
          <a key={`${link.label}-${link.href}`} className="tp-token-card-social" href={link.href} target="_blank" rel="noreferrer">
            {link.icon === 'x' ? <XIcon /> : link.icon === 'globe' ? <GlobeIcon /> : null}
            {link.label}
          </a>
        ))}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <span className="token-social-links token-social-links--inline">
        {links.map((link) => (
          <a key={`${link.label}-${link.href}`} className="tp-social-link" href={link.href} target="_blank" rel="noreferrer">
            {link.icon === 'x' ? <XIcon /> : link.icon === 'globe' ? <GlobeIcon /> : null}
            <span>{link.label}</span>
          </a>
        ))}
      </span>
    );
  }

  return (
    <p className="token-social-links">
      {links.map((link, i) => (
        <span key={`${link.label}-${link.href}`}>
          {i > 0 ? <span className="muted"> · </span> : null}
          <a href={link.href} target="_blank" rel="noreferrer">
            {link.label}
          </a>
        </span>
      ))}
    </p>
  );
}
