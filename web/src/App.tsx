import { useEffect, useState } from 'react';
import { LaunchTab } from './components/LaunchTab';
import { ProfileTab } from './components/ProfileTab';
import { DeployerProfilePage } from './components/DeployerProfilePage';
import { WalletProfilePage } from './components/WalletProfilePage';
import { DevPage } from './components/DevPage';
import { SiteFooter } from './components/SiteFooter';
import { TokenPage } from './components/TokenPage';
import { TickerTape } from './components/TickerTape';
import { TokensTab } from './components/TokensTab';
import { useExploreTokens } from './hooks/useExploreTokens';
import { useEnsureRobinhoodChain } from './hooks/useEnsureRobinhoodChain';
import { isDevPage } from './lib/devRoute';
import { closeDeployerProfile, readDeployerProfileFromUrl } from './lib/deployerProfileRoute';
import { closeTokenPage, navigateToAppTab, openExplorePage, readTokenFromUrl } from './lib/tokenRoute';

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
  if (isDevPage() || readTokenFromUrl() || readDeployerProfileFromUrl()) return 'tokens';
  const t = new URLSearchParams(window.location.search).get('tab');
  if (t === 'launch' || t === 'profile' || t === 'tokens') return t;
  return 'launch';
}

export default function App() {
  useEnsureRobinhoodChain();
  const [tab, setTab] = useState<Tab>(readTabFromUrl);
  const [tokenAddress, setTokenAddress] = useState<string | null>(readTokenFromUrl);
  const [deployerProfile, setDeployerProfile] = useState(readDeployerProfileFromUrl);
  const [devPage, setDevPage] = useState(isDevPage);

  useEffect(() => {
    const sync = () => {
      setTokenAddress(readTokenFromUrl());
      setDeployerProfile(readDeployerProfileFromUrl());
      setDevPage(isDevPage());
      setTab(readTabFromUrl());
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const copy =
    devPage
      ? null
      : tokenAddress || deployerProfile
        ? null
        : TAB_COPY[tab];
  const showExploreChrome = !tokenAddress && !deployerProfile && !devPage;
  const {
    tokens: exploreTokens,
    catalog,
    metricsByAddress,
    loading,
    loadingMetrics,
    error,
    ensureMetrics,
    ensureCatalogSize,
  } = useExploreTokens(showExploreChrome);

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
              className={`nav-tab ${tab === 'tokens' && !tokenAddress && !devPage ? 'active' : ''}`}
              onClick={() => navigateToAppTab('tokens')}
            >
              Explore
            </button>
            <button
              type="button"
              className={`nav-tab ${tab === 'launch' && !tokenAddress && !devPage ? 'active' : ''}`}
              onClick={() => navigateToAppTab('launch')}
            >
              Launch
            </button>
            <button
              type="button"
              className={`nav-tab ${tab === 'profile' && !tokenAddress && !devPage ? 'active' : ''}`}
              onClick={() => navigateToAppTab('profile')}
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

        {tokenAddress || deployerProfile ? (
          <div className="page-back-row">
            <button
              type="button"
              className="btn btn-ghost token-page-back"
              onClick={tokenAddress ? closeTokenPage : closeDeployerProfile}
              aria-label="Back"
            >
              ←
            </button>
          </div>
        ) : null}

        <div className="panel">
          {devPage ? (
            <DevPage />
          ) : tokenAddress ? (
            <TokenPage tokenAddress={tokenAddress} />
          ) : deployerProfile?.platform === 'x' ? (
            <DeployerProfilePage username={deployerProfile.username} />
          ) : deployerProfile?.platform === 'wallet' ? (
            <WalletProfilePage walletAddress={deployerProfile.address} />
          ) : tab === 'tokens' ? (
            <TokensTab
              catalog={catalog}
              metricsByAddress={metricsByAddress}
              loading={loading}
              loadingMetrics={loadingMetrics}
              error={error}
              onEnsureMetrics={ensureMetrics}
              onEnsureCatalogSize={ensureCatalogSize}
            />
          ) : tab === 'launch' ? (
            <LaunchTab />
          ) : (
            <ProfileTab />
          )}
        </div>

        <SiteFooter />
      </main>
    </div>
  );
}
