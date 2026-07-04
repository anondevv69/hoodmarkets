import { useEffect, useRef } from 'react';

const WIDGETS_SRC = 'https://platform.twitter.com/widgets.js';

function loadTwitterWidgets(): void {
  if (document.querySelector(`script[src="${WIDGETS_SRC}"]`)) {
    const twttr = (window as { twttr?: { widgets?: { load?: (el?: Element) => void } } }).twttr;
    twttr?.widgets?.load?.();
    return;
  }
  const script = document.createElement('script');
  script.src = WIDGETS_SRC;
  script.async = true;
  script.charset = 'utf-8';
  document.body.appendChild(script);
}

export function LaunchTweetEmbed({
  tweetUrl,
  compact = false,
}: {
  tweetUrl: string;
  compact?: boolean;
}) {
  const ref = useRef<HTMLQuoteElement>(null);

  useEffect(() => {
    loadTwitterWidgets();
  }, [tweetUrl]);

  return (
    <div className={`launch-tweet-embed${compact ? ' launch-tweet-embed--compact' : ''}`}>
      {!compact ? <p className="section-label">Launch request</p> : null}
      <blockquote ref={ref} className="twitter-tweet" data-dnt="true" data-theme="dark">
        <a href={tweetUrl} target="_blank" rel="noreferrer">
          View launch request on X
        </a>
      </blockquote>
    </div>
  );
}
