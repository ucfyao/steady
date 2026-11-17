import { useEffect, useState } from 'react';
import styles from '../Layout.module.css';
import { applyTheme, readTheme, saveTheme, type Theme } from './theme.js';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** localStorage, or nothing where reading it throws (blocked site data). */
const browserStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

const systemQuery = () =>
  typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;

/**
 * The light/dark button in the header (Spec 012). It matches the system until the first click,
 * then keeps the choice for this browser. It shows what a click does: a moon on a light page,
 * a sun on a dark one.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => readTheme(browserStorage()));
  const [systemDark, setSystemDark] = useState(() => systemQuery()?.matches ?? false);

  // While nothing is chosen, follow the system, including a change while the app is open.
  useEffect(() => {
    const query = systemQuery();
    if (!query) return;
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const dark = theme === 'system' ? systemDark : theme === 'dark';
  const next: Theme = dark ? 'light' : 'dark';
  const label = dark ? 'Switch to light' : 'Switch to dark';

  return (
    <button
      type="button"
      className={styles.themeButton}
      aria-label={label}
      title={label}
      onClick={() => {
        setTheme(next);
        saveTheme(browserStorage(), next);
        applyTheme(document.documentElement, next);
      }}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

const iconProps = {
  viewBox: '0 0 24 24',
  width: 18,
  height: 18,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function MoonIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}
