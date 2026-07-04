/** URL helpers for public deployer profile pages. */

export type ProfileRoute =
  | { platform: 'x'; username: string }
  | { platform: 'wallet'; address: string };

export function readDeployerProfileFromUrl(): ProfileRoute | null {
  const params = new URLSearchParams(window.location.search);
  const platform = params.get('profile')?.trim().toLowerCase();

  if (platform === 'x') {
    const user = params.get('user')?.trim().replace(/^@/, '').toLowerCase();
    if (!user || !/^[a-z0-9_]{1,15}$/i.test(user)) return null;
    return { platform: 'x', username: user };
  }

  if (platform === 'wallet') {
    const address = params.get('address')?.trim();
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
    return { platform: 'wallet', address };
  }

  return null;
}

export function openDeployerProfile(xUsername: string): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('token');
  url.searchParams.delete('tab');
  url.searchParams.delete('address');
  url.searchParams.set('profile', 'x');
  url.searchParams.set('user', xUsername.trim().replace(/^@/, '').toLowerCase());
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function openWalletProfile(walletAddress: string): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('token');
  url.searchParams.delete('tab');
  url.searchParams.delete('user');
  url.searchParams.set('profile', 'wallet');
  url.searchParams.set('address', walletAddress.trim());
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function closeDeployerProfile(): void {
  const url = new URL(window.location.origin + '/');
  url.searchParams.delete('profile');
  url.searchParams.delete('user');
  url.searchParams.delete('address');
  if (!url.searchParams.get('tab')) url.searchParams.set('tab', 'tokens');
  window.history.pushState({}, '', `${url.pathname}${url.search}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
