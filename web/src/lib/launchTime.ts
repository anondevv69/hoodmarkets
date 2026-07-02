/** Catalog `created_at` is UTC `YYYY-MM-DD HH:MM:SS` (no timezone suffix). */
export function parseCatalogCreatedAt(createdAt: string): number {
  const raw = createdAt.trim();
  if (!raw) return 0;
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

const EASTERN_TZ = 'America/New_York';

/** Launch timestamp for UI — always US Eastern (EST/EDT). */
export function formatLaunchTimeEastern(createdAt: string): string {
  const ms = parseCatalogCreatedAt(createdAt);
  if (!ms) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(ms);
}
