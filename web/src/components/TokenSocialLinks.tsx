interface TokenSocialLinksProps {
  websiteUrl?: string;
  xUrl?: string;
}

export function TokenSocialLinks({ websiteUrl, xUrl }: TokenSocialLinksProps) {
  const website = websiteUrl?.trim();
  const x = xUrl?.trim();
  if (!website && !x) return null;

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
