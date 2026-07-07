import { devPageUrl } from '../lib/devRoute';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer-brand">hood.markets · Robinhood Chain</p>
      <nav className="site-footer-tabs" aria-label="Documentation">
        <a className="site-footer-tab" href="/community-launch">
          Community Launch
        </a>
        <a className="site-footer-tab" href={devPageUrl()}>
          Docs
        </a>
        <a className="site-footer-tab" href={devPageUrl('agents')}>
          Agents
        </a>
        <a className="site-footer-tab" href={devPageUrl('contracts')}>
          Contracts
        </a>
        <a className="site-footer-tab" href={devPageUrl('sdk')}>
          SDK
        </a>
        <a className="site-footer-tab" href={devPageUrl('github')}>
          GitHub
        </a>
      </nav>
    </footer>
  );
}
