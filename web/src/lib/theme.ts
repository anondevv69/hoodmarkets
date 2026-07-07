export type SiteTheme = 'dark' | 'light';

const STORAGE_KEY = 'hoodmarkets_theme_v1';

/** Neon brand surface — default (“dark” in product copy). */
export const THEME_DARK: SiteTheme = 'dark';
/** White surface with neon accents. */
export const THEME_LIGHT: SiteTheme = 'light';

export function readStoredTheme(): SiteTheme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    /* ignore */
  }
  return THEME_DARK;
}

export function applyTheme(theme: SiteTheme): void {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === THEME_LIGHT ? '#FFFFFF' : '#CCFF00');
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function initTheme(): SiteTheme {
  const theme = readStoredTheme();
  applyTheme(theme);
  return theme;
}
