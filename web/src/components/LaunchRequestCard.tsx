export function LaunchRequestCard({
  tweetUrl,
  username,
  tokenName,
  symbol,
}: {
  tweetUrl: string;
  username?: string;
  tokenName: string;
  symbol: string;
}) {
  const handle = username ? `@${username}` : 'Launch request';
  const sym = symbol.replace(/^\$/, '');

  return (
    <a className="tp-launch-request" href={tweetUrl} target="_blank" rel="noreferrer">
      <span className="tp-launch-request-x" aria-hidden>
        𝕏
      </span>
      <span className="tp-launch-request-copy">
        {username ? (
          <>
            <strong>{handle}</strong>
            <span className="tp-launch-request-sub">
              {' '}
              requested {tokenName} (${sym})
            </span>
          </>
        ) : (
          <span className="tp-launch-request-sub">Launch request for {tokenName} (${sym})</span>
        )}
      </span>
      <span className="tp-launch-request-link">View on X ↗</span>
    </a>
  );
}
