import { useId, useLayoutEffect, useState } from 'react';
import {
  applyTheme,
  readTheme,
  systemThemeQuery,
  themeStorageKey,
  type ThemePreference,
} from './theme';

const choices = [
  { value: 'system', label: 'Системная', symbol: '◐' },
  { value: 'light', label: 'Дневная', symbol: '☀' },
  { value: 'dark', label: 'Ночная', symbol: '☾' },
] as const;

export default function ThemeToggle() {
  const id = useId();
  const [preference, setPreference] = useState<ThemePreference>(readTheme);
  const [resolved, setResolved] = useState<'light' | 'dark'>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );

  useLayoutEffect(() => {
    const query = systemThemeQuery();
    const update = () => setResolved(applyTheme(preference, query?.matches ?? false));
    update();
    try {
      localStorage.setItem(themeStorageKey, preference);
    } catch {
      // A blocked preference store must not prevent switching the current theme.
    }
    if (preference !== 'system' || !query) return;
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [preference]);

  return (
    <fieldset className="theme-picker" aria-describedby={`${id}-hint`}>
      <legend>Оформление</legend>
      <div className="theme-options">
        {choices.map(({ value, label, symbol }) => (
          <label className="theme-option" key={value}>
            <input
              type="radio"
              name={`${id}-theme`}
              value={value}
              checked={preference === value}
              onChange={() => setPreference(value)}
            />
            <span className="theme-option-face">
              <span className="theme-symbol" aria-hidden="true">
                {symbol}
              </span>
              {label}
            </span>
          </label>
        ))}
      </div>
      <p id={`${id}-hint`} className="theme-hint">
        {preference === 'system'
          ? `Как на устройстве · ${resolved === 'dark' ? 'ночная' : 'дневная'}`
          : 'Выбранное оформление'}
      </p>
    </fieldset>
  );
}
