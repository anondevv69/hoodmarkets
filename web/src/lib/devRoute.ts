export function isDevPage(): boolean {
  const path = window.location.pathname.replace(/\/$/, '').toLowerCase();
  return path === '/dev';
}

export function openDevPage(section?: 'contracts' | 'sdk' | 'agent'): void {
  const url = new URL(window.location.origin + '/Dev');
  url.searchParams.delete('token');
  url.searchParams.delete('buy');
  url.searchParams.delete('profile');
  url.searchParams.delete('user');
  url.searchParams.delete('address');
  url.searchParams.delete('tab');
  if (section) url.hash = section;
  window.history.pushState({}, '', `${url.pathname}${url.hash}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function devPageUrl(section?: 'contracts' | 'sdk' | 'agent'): string {
  return section ? `/Dev#${section}` : '/Dev';
}
