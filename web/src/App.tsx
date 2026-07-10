import { useCallback, useEffect, useState } from 'react';
import { LaunchTab } from './components/LaunchTab';
import { ProfileTab } from './components/ProfileTab';
import { DeployerProfilePage } from './components/DeployerProfilePage';
import { WalletProfilePage } from './components/WalletProfilePage';
import { DevPage } from './components/DevPage';
import { SiteConnect } from './components/SiteConnect';
import { ThemeToggle } from './components/ThemeToggle';
import { TokenPage } from './components/TokenPage';
import { TokensTab } from './components/TokensTab';
import { useWebAuth } from './auth/WebAuthContext';
import { isDevPage, openDevPage } from './lib/devRoute';
import { migrateCommunityLaunchPath } from './lib/communityLaunchRoute';
import {
  closeDeployerProfile,
  navigateToMyProfile,
  readDeployerProfileFromUrl,
} from './lib/deployerProfileRoute';
import { closeTokenPage, navigateToAppTab, openExplorePage, readTokenFromUrl } from './lib/tokenRoute';

type Tab = 'tokens' | 'launch' | 'profile';

function readTabFromUrl(): Tab {
  if (isDevPage() || readTokenFromUrl() || readDeployerProfileFromUrl()) return 'tokens';
  const t = new URLSearchParams(window.location.search).get('tab');
  if (t === 'launch' || t === 'profile' || t === 'tokens') return t;
  return 'tokens';
}

function ExploreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function LaunchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function DocsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function App() {
  const { walletAddress } = useWebAuth();
  const [tab, setTab] = useState<Tab>(readTabFromUrl);
  const [tokenAddress, setTokenAddress] = useState<string | null>(readTokenFromUrl);
  const [deployerProfile, setDeployerProfile] = useState(readDeployerProfileFromUrl);
  const [devPage, setDevPage] = useState(isDevPage);

  useEffect(() => {
    migrateCommunityLaunchPath();
    const sync = () => {
      migrateCommunityLaunchPath();
      setTokenAddress(readTokenFromUrl());
      setDeployerProfile(readDeployerProfileFromUrl());
      setDevPage(isDevPage());
      setTab(readTabFromUrl());
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const isExploreActive = tab === 'tokens' && !tokenAddress && !deployerProfile && !devPage;
  const isLaunchActive = tab === 'launch' && !tokenAddress && !deployerProfile && !devPage;
  const isProfileActive =
    (tab === 'profile' || deployerProfile?.platform === 'wallet') &&
    !tokenAddress &&
    !devPage &&
    deployerProfile?.platform !== 'x';
  const isDocsActive = devPage;

  const navigateTab = useCallback((next: Tab) => {
    if (next === 'profile') {
      navigateToMyProfile(walletAddress);
      return;
    }
    setTab(next);
    navigateToAppTab(next);
  }, [walletAddress]);

  const pageKey = devPage
    ? 'dev'
    : tokenAddress
      ? `token-${tokenAddress.toLowerCase()}`
      : deployerProfile
        ? deployerProfile.platform === 'x'
          ? `x-${deployerProfile.username.toLowerCase()}`
          : `wallet-${deployerProfile.address.toLowerCase()}`
        : `tab-${tab}`;

  return (
    <div className="app-shell">
      {/* Left sidebar */}
      <aside className="site-sidebar">
        <button
          type="button"
          className="sidebar-logo lp-display"
          aria-label="hood.markets — back to explore"
          onClick={openExplorePage}
        >
          <img src="/favicon.svg" alt="" className="sidebar-logo-icon" aria-hidden />
          <span className="sidebar-logo-text">hood.markets</span>
        </button>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <button
            type="button"
            className={`sidebar-nav-item${isExploreActive ? ' active' : ''}`}
            onClick={() => navigateTab('tokens')}
          >
            <ExploreIcon />
            <span>Explore</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-item${isLaunchActive ? ' active' : ''}`}
            onClick={() => navigateTab('launch')}
          >
            <LaunchIcon />
            <span>Launch</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-item${isProfileActive ? ' active' : ''}`}
            onClick={() => navigateTab('profile')}
          >
            <ProfileIcon />
            <span>Profile</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-item${isDocsActive ? ' active' : ''}`}
            onClick={() => openDevPage()}
          >
            <DocsIcon />
            <span>Docs</span>
          </button>
        </nav>

        <div className="sidebar-nav-footer">
          <a
            href="https://x.com/Hooddotmarkets"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-nav-item sidebar-nav-item--external"
          >
            <XIcon />
            <span>@Hooddotmarkets</span>
          </a>
        </div>
      </aside>

      {/* Main area */}
      <div className="app-main">
        {/* Top bar */}
        <header className="site-topbar">
          <div className="site-topbar-left">
            {tokenAddress || deployerProfile ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm topbar-back"
                onClick={tokenAddress ? closeTokenPage : closeDeployerProfile}
                aria-label="Back"
              >
                ← Back
              </button>
            ) : (
              <button
                type="button"
                className="topbar-logo lp-display"
                aria-label="hood.markets — back to explore"
                onClick={openExplorePage}
              >
                <img src="/favicon.svg" alt="" className="topbar-logo-icon" aria-hidden />
                <span className="topbar-logo-text">hood.markets</span>
              </button>
            )}
          </div>
          <div className="site-topbar-right">
            <ThemeToggle />
            <SiteConnect />
          </div>
        </header>

        {/* Page content */}
        <main className="app-content">
          <div
            key={pageKey}
            className={`lp-page-enter ${tokenAddress || devPage ? 'token-page-panel' : 'content-panel'}`}
          >
            {devPage ? (
              <DevPage />
            ) : tokenAddress ? (
              <TokenPage tokenAddress={tokenAddress} />
            ) : deployerProfile?.platform === 'x' ? (
              <DeployerProfilePage username={deployerProfile.username} />
            ) : deployerProfile?.platform === 'wallet' ? (
              <WalletProfilePage walletAddress={deployerProfile.address} />
            ) : tab === 'tokens' ? (
              <TokensTab onNavigateToLaunch={() => navigateTab('launch')} />
            ) : tab === 'launch' ? (
              <LaunchTab />
            ) : (
              <ProfileTab />
            )}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        <button
          type="button"
          className={`mobile-nav-item${isExploreActive ? ' active' : ''}`}
          onClick={() => navigateTab('tokens')}
        >
          <ExploreIcon />
          <span>Explore</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-item${isLaunchActive ? ' active' : ''}`}
          onClick={() => navigateTab('launch')}
        >
          <LaunchIcon />
          <span>Launch</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-item${isProfileActive ? ' active' : ''}`}
          onClick={() => navigateTab('profile')}
        >
          <ProfileIcon />
          <span>Profile</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-item${isDocsActive ? ' active' : ''}`}
          onClick={() => openDevPage()}
        >
          <DocsIcon />
          <span>Docs</span>
        </button>
      </nav>
    </div>
  );
}
