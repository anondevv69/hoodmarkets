/** URL helpers for public deployer profile pages (`?profile=x&user=handle`). */

export function readDeployerProfileFromUrl(): { platform: 'x'; username: string } | null {
  const params = new URLSearchParams(window.location.search);
  const platform = params.get('profile')?.trim().toLowerCase();
  const user = params.get('user')?.trim().replace(/^@/, '').toLowerCase();
  if (platform !== 'x' || !user || !/^[a-z0-9_]{1,15}$/i.test(user)) return null;
  return { platform: 'x', username: user };
}

export function deployerProfilePath(xUsername: string): string {
  const handle = xUsername.trim().replace(/^@/, '').toLowerCase();
  if (!handle) return '/?tab=profile';
  const url = new URL(window.location.href);
  url.searchParams.delete('token');
  url.searchParams.delete('tab');
  url.searchParams.set('profile', 'x');
  url.searchParams.set('user', handle);
  return `${url.pathname}${url.search}`;
}

export function openDeployerProfile(xUsername: string): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('token');
  url.searchParams.delete('tab');
  url.searchParams.set('profile', 'x');
  url.searchParams.set('user', xUsername.trim().replace(/^@/, '').toLowerCase());
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function closeDeployerProfile(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('profile');
  url.searchParams.delete('user');
  if (!url.searchParams.get('tab')) url.searchParams.set('tab', 'tokens');
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
