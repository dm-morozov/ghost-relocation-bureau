import { useEffect, useState } from 'react';

const storageKey = 'quiet-address-theme';
type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  try {
    return localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      // A blocked preference store must not prevent switching the current theme.
    }
  }, [theme]);

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-pressed={theme === 'dark'}
      onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
      title={theme === 'light' ? 'Переключить на тёмную тему' : 'Переключить на светлую тему'}
    >
      <span aria-hidden="true">{theme === 'light' ? '☾' : '☀'}</span>
      {theme === 'light' ? 'Ночная смена' : 'Дневной архив'}
    </button>
  );
}
