import { useEffect, useRef } from 'react';

const WIDGETS_SRC = 'https://platform.twitter.com/widgets.js';

type TwitterWidgets = { widgets?: { load?: (el?: Element) => void } };

function loadTwitterWidgets(onReady?: () => void): void {
  const existing = document.querySelector(`script[src="${WIDGETS_SRC}"]`);
  if (existing) {
    const twttr = (window as { twttr?: TwitterWidgets }).twttr;
    if (twttr?.widgets?.load) {
      onReady?.();
      twttr.widgets.load();
    } else {
      existing.addEventListener('load', () => onReady?.(), { once: true });
    }
    return;
  }
  const script = document.createElement('script');
  script.src = WIDGETS_SRC;
  script.async = true;
  script.charset = 'utf-8';
  script.onload = () => onReady?.();
  document.body.appendChild(script);
}

export function LaunchTweetEmbed({
  tweetUrl,
  compact = false,
}: {
  tweetUrl: string;
  compact?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const quoteRef = useRef<HTMLQuoteElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const quote = quoteRef.current;
    if (!wrap || !quote) return;

    const renderTweet = () => {
      const width = Math.floor(wrap.getBoundingClientRect().width);
      if (width > 0) {
        quote.setAttribute('data-width', String(width));
      }
      const twttr = (window as { twttr?: TwitterWidgets }).twttr;
      twttr?.widgets?.load?.(wrap);
    };

    loadTwitterWidgets(renderTweet);

    const observer = new ResizeObserver(() => {
      renderTweet();
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [tweetUrl]);

  return (
    <div
      ref={wrapRef}
      className={`launch-tweet-embed${compact ? ' launch-tweet-embed--compact' : ''}`}
    >
      {!compact ? <p className="section-label">Launch request</p> : null}
      <blockquote ref={quoteRef} className="twitter-tweet" data-dnt="true" data-theme="dark">
        <a href={tweetUrl} target="_blank" rel="noreferrer">
          View launch request on X
        </a>
      </blockquote>
    </div>
  );
}
