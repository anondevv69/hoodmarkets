export type AppTab = 'tokens' | 'launch' | 'profile';

/** Leave token/profile/dev routes and open a main app tab on `/`. */
export function navigateToAppTab(tab: AppTab): void {
  const url = new URL(window.location.href);
  if (url.pathname !== '/' && url.pathname !== '') {
    url.pathname = '/';
  }
  url.searchParams.set('tab', tab);
  url.searchParams.delete('token');
  url.searchParams.delete('buy');
  url.searchParams.delete('profile');
  url.searchParams.delete('user');
  url.searchParams.delete('address');
  const next = `${url.pathname}${url.search}`;
  window.history.pushState({}, '', next);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function readTokenFromUrl(): string | null {
  const raw = new URLSearchParams(window.location.search).get('token')?.trim();
  if (!raw || !/^0x[a-fA-F0-9]{40}$/.test(raw)) return null;
  return raw;
}

export function readBuyEthFromUrl(): string | null {
  const raw = new URLSearchParams(window.location.search).get('buy')?.trim();
  if (!raw || !/^\d+(\.\d+)?$/.test(raw)) return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return raw;
}

export function openTokenPage(tokenAddress: string, opts?: { buyEth?: string }): void {
  const url = new URL(window.location.href);
  url.searchParams.set('token', tokenAddress);
  url.searchParams.delete('tab');
  if (opts?.buyEth) url.searchParams.set('buy', opts.buyEth);
  else url.searchParams.delete('buy');
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function openExplorePage(): void {
  navigateToAppTab('tokens');
}

export function closeTokenPage(): void {
  const url = new URL(window.location.origin + '/');
  url.searchParams.delete('token');
  url.searchParams.delete('buy');
  if (!url.searchParams.get('tab')) url.searchParams.set('tab', 'tokens');
  window.history.pushState({}, '', `${url.pathname}${url.search}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
