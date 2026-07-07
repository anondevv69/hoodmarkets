import { useEffect, useState } from 'react';
import { applyTheme, readStoredTheme, type SiteTheme } from '../lib/theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<SiteTheme>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggle() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {theme === 'dark' ? '☀' : '◐'}
    </button>
  );
}
