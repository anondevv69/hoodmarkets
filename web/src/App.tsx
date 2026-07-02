import { useEffect, useState } from 'react';
import { LaunchTab } from './components/LaunchTab';
import { ProfileTab } from './components/ProfileTab';
import { TokenPage } from './components/TokenPage';
import { TickerTape } from './components/TickerTape';
import { TokensTab } from './components/TokensTab';
import { useExploreTokens } from './hooks/useExploreTokens';
import { useEnsureRobinhoodChain } from './hooks/useEnsureRobinhoodChain';
import { openExplorePage, readTokenFromUrl } from './lib/tokenRoute';

type Tab = 'tokens' | 'launch' | 'profile';

const TAB_COPY: Record<Tab, { title: string; sub: string }> = {
  tokens: {
    title: 'Explore tokens',
    sub: '',
  },
  launch: {
    title: 'Launch a token',
    sub: 'Fill in the details and deploy in seconds.',
  },
  profile: {
    title: 'Your profile',
    sub: "Tokens you've launched and fee wallets.",
  },
};

function readTabFromUrl(): Tab {
  if (readTokenFromUrl()) return 'tokens';
  const t = new URLSearchParams(window.location.search).get('tab');
  if (t === 'launch' || t === 'profile' || t === 'tokens') return t;
  return 'launch';
}

export default function App() {
  useEnsureRobinhoodChain();
  const [tab, setTab] = useState<Tab>(readTabFromUrl);
  const [tokenAddress, setTokenAddress] = useState<string | null>(readTokenFromUrl);

  useEffect(() => {
    const sync = () => {
      setTokenAddress(readTokenFromUrl());
      setTab(readTabFromUrl());
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const copy = tokenAddress ? null : TAB_COPY[tab];
  const showExploreChrome = !tokenAddress;
  const { tokens: exploreTokens, metricsByAddress, loading, error, catalogTruncated } =
    useExploreTokens(showExploreChrome);

  return (
    <div className="app lp-root">
      <header className="site-header">
        <div className="header-inner">
          <button
            type="button"
            className="logo lp-display"
            aria-label="hood.markets — back to explore"
            onClick={openExplorePage}
          >
            <span className="logo-hood">hood</span><span className="logo-markets">.markets</span>
          </button>
          <nav className="site-nav" aria-label="Main">
            <button
              type="button"
              className={`nav-tab ${tab === 'tokens' && !tokenAddress ? 'active' : ''}`}
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('token');
                url.searchParams.set('tab', 'tokens');
                window.history.pushState({}, '', url);
                setTokenAddress(null);
                setTab('tokens');
              }}
            >
              Explore
            </button>
            <button
              type="button"
              className={`nav-tab ${tab === 'launch' && !tokenAddress ? 'active' : ''}`}
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('token');
                url.searchParams.set('tab', 'launch');
                window.history.pushState({}, '', url);
                setTokenAddress(null);
                setTab('launch');
              }}
            >
              Launch
            </button>
            <button
              type="button"
              className={`nav-tab ${tab === 'profile' && !tokenAddress ? 'active' : ''}`}
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('token');
                url.searchParams.set('tab', 'profile');
                window.history.pushState({}, '', url);
                setTokenAddress(null);
                setTab('profile');
              }}
            >
              Profile
            </button>
          </nav>
        </div>
      </header>

      {showExploreChrome ? <TickerTape tokens={exploreTokens} /> : null}

      <main className="main-wrap">
        {copy ? (
          <div className="page-intro">
            <h1 className="lp-display page-title">{copy.title}</h1>
            {copy.sub ? <p className="page-sub">{copy.sub}</p> : null}
          </div>
        ) : null}

        <div className="panel">
          {tokenAddress ? (
            <TokenPage tokenAddress={tokenAddress} />
          ) : tab === 'tokens' ? (
            <TokensTab
              exploreTokens={exploreTokens}
              metricsByAddress={metricsByAddress}
              loading={loading}
              error={error}
              catalogTruncated={catalogTruncated}
            />
          ) : tab === 'launch' ? (
            <LaunchTab />
          ) : (
            <ProfileTab />
          )}
        </div>

        <p className="footer-note">
          hood.markets · Robinhood Chain ·{' '}
          <a href="/agent.md" target="_blank" rel="noreferrer">
            agent.md
          </a>
        </p>
      </main>
    </div>
  );
}
