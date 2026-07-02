export function readTokenFromUrl(): string | null {
  const raw = new URLSearchParams(window.location.search).get('token')?.trim();
  if (!raw || !/^0x[a-fA-F0-9]{40}$/.test(raw)) return null;
  return raw;
}

export function openTokenPage(tokenAddress: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('token', tokenAddress);
  url.searchParams.delete('tab');
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function closeTokenPage(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('token');
  if (!url.searchParams.get('tab')) url.searchParams.set('tab', 'tokens');
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
