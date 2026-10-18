export const themeStorageKey = 'quiet-address-theme';
export type ThemePreference = 'system' | 'light' | 'dark';

export function readTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(themeStorageKey);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function systemThemeQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
}

export function applyTheme(preference: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  const resolved = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}
