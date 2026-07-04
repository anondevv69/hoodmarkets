import { devPageUrl } from '../lib/devRoute';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer-brand">hood.markets · Robinhood Chain</p>
      <nav className="site-footer-tabs" aria-label="Developer links">
        <a className="site-footer-tab" href={devPageUrl()}>
          Dev
        </a>
      </nav>
    </footer>
  );
}
