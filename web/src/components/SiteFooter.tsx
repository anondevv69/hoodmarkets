const SDK_REPO = 'https://github.com/anondevv69/hoodmarkets-sdk';
const MONOREPO = 'https://github.com/anondevv69/hoodmarkets';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer-brand">hood.markets · Robinhood Chain</p>
      <nav className="site-footer-tabs" aria-label="Developer links">
        <a className="site-footer-tab" href="/sdk.md" target="_blank" rel="noreferrer">
          Contract / SDK
        </a>
        <a className="site-footer-tab" href={SDK_REPO} target="_blank" rel="noreferrer">
          SDK (GitHub)
        </a>
        <a className="site-footer-tab" href={MONOREPO} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </nav>
    </footer>
  );
}
