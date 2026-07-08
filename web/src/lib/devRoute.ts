export type DevSection =
  | 'overview'
  | 'fees'
  | 'holder-nfts'
  | 'contracts'
  | 'sdk'
  | 'agents'
  | 'community-launch'
  | 'github'
  | 'faq';

const LEGACY_SECTION: Record<string, DevSection> = {
  capabilities: 'overview',
  agent: 'agents',
};

export function isDevPage(): boolean {
  const path = window.location.pathname.replace(/\/$/, '').toLowerCase();
  return path === '/dev' || path === '/docs';
}

export function normalizeDevSection(hash: string): DevSection | undefined {
  const id = hash.replace(/^#/, '').toLowerCase();
  if (!id) return undefined;
  if (id in LEGACY_SECTION) return LEGACY_SECTION[id];
  const sections: DevSection[] = ['overview', 'fees', 'holder-nfts', 'contracts', 'sdk', 'agents', 'community-launch', 'github', 'faq'];
  return sections.includes(id as DevSection) ? (id as DevSection) : undefined;
}

export function openDevPage(section?: DevSection): void {
  const url = new URL(window.location.origin + '/docs');
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

export function devPageUrl(section?: DevSection): string {
  return section ? `/docs#${section}` : '/docs';
}
