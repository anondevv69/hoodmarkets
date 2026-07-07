const LEGACY_COMMUNITY_LAUNCH_PATH = '/community-launch';

export type LaunchSubMode = 'standard' | 'community';

export function isCommunityLaunchPage(): boolean {
  const path = window.location.pathname.replace(/\/$/, '').toLowerCase();
  if (path === LEGACY_COMMUNITY_LAUNCH_PATH) return true;
  const params = new URLSearchParams(window.location.search);
  return params.get('tab') === 'launch' && params.get('launch') === 'community';
}

/** Redirect legacy /petition bookmarks to hood.markets community launch. */
export function redirectLegacyPetitionPath(): void {
  const path = window.location.pathname.replace(/\/$/, '').toLowerCase();
  if (path !== '/petition') return;
  const url = new URL(window.location.href);
  url.pathname = LEGACY_COMMUNITY_LAUNCH_PATH;
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
}

export function readCommunityLaunchIdFromUrl(): string | null {
  const id = new URLSearchParams(window.location.search).get('id');
  return id?.trim() || null;
}

export function readLaunchSubMode(): LaunchSubMode {
  const path = window.location.pathname.replace(/\/$/, '').toLowerCase();
  if (path === LEGACY_COMMUNITY_LAUNCH_PATH) return 'community';
  const params = new URLSearchParams(window.location.search);
  return params.get('launch') === 'community' ? 'community' : 'standard';
}

export function readCommunityLaunchCreateFromUrl(): boolean {
  return new URLSearchParams(window.location.search).get('create') === '1';
}

/** Move legacy `/community-launch` URLs onto `/?tab=launch&launch=community`. */
export function migrateCommunityLaunchPath(): void {
  const path = window.location.pathname.replace(/\/$/, '').toLowerCase();
  if (path !== LEGACY_COMMUNITY_LAUNCH_PATH) return;
  const id = readCommunityLaunchIdFromUrl();
  const create = readCommunityLaunchCreateFromUrl();
  setLaunchSubMode('community', {
    communityId: id ?? undefined,
    create: !id && create,
    replace: true,
  });
}

export function setLaunchSubMode(
  mode: LaunchSubMode,
  opts?: { communityId?: string; create?: boolean; replace?: boolean },
): void {
  const url = new URL(window.location.href);
  url.pathname = '/';
  url.searchParams.set('tab', 'launch');
  url.searchParams.delete('token');
  url.searchParams.delete('buy');
  url.searchParams.delete('profile');
  url.searchParams.delete('user');
  url.searchParams.delete('address');
  url.searchParams.delete('launch');
  url.searchParams.delete('id');
  url.searchParams.delete('create');

  if (mode === 'community') {
    url.searchParams.set('launch', 'community');
    if (opts?.communityId) url.searchParams.set('id', opts.communityId);
    else if (opts?.create) url.searchParams.set('create', '1');
  }

  const next = `${url.pathname}${url.search}`;
  if (opts?.replace) {
    window.history.replaceState({}, '', next);
  } else {
    window.history.pushState({}, '', next);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function openCommunityLaunchPage(id?: string | number, opts?: { create?: boolean }): void {
  migrateCommunityLaunchPath();
  setLaunchSubMode('community', {
    communityId: id != null && String(id).trim() ? String(id) : undefined,
    create: opts?.create,
  });
}

export function closeCommunityLaunchPage(): void {
  setLaunchSubMode('standard');
}

export function communityLaunchPageUrl(id?: string | number): string {
  if (id != null) return `/?tab=launch&launch=community&id=${id}`;
  return '/?tab=launch&launch=community';
}
