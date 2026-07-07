const COMMUNITY_LAUNCH_PATH = '/community-launch';

export function isCommunityLaunchPage(): boolean {
  const path = window.location.pathname.replace(/\/$/, '').toLowerCase();
  return path === COMMUNITY_LAUNCH_PATH;
}

/** Redirect legacy /petition bookmarks to hood.markets community launch. */
export function redirectLegacyPetitionPath(): void {
  const path = window.location.pathname.replace(/\/$/, '').toLowerCase();
  if (path !== '/petition') return;
  const url = new URL(window.location.href);
  url.pathname = COMMUNITY_LAUNCH_PATH;
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
}

export function readCommunityLaunchIdFromUrl(): string | null {
  const id = new URLSearchParams(window.location.search).get('id');
  return id?.trim() || null;
}

export function openCommunityLaunchPage(id?: string | number): void {
  const url = new URL(window.location.origin + COMMUNITY_LAUNCH_PATH);
  if (id != null && String(id).trim()) url.searchParams.set('id', String(id));
  url.searchParams.delete('token');
  url.searchParams.delete('tab');
  url.searchParams.delete('profile');
  window.history.pushState({}, '', `${url.pathname}${url.search}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function closeCommunityLaunchPage(): void {
  const url = new URL(window.location.origin + '/');
  url.searchParams.set('tab', 'tokens');
  window.history.pushState({}, '', `${url.pathname}${url.search}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function communityLaunchPageUrl(id?: string | number): string {
  return id != null ? `${COMMUNITY_LAUNCH_PATH}?id=${id}` : COMMUNITY_LAUNCH_PATH;
}
