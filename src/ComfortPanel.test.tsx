// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ComfortPanel from './ComfortPanel';
import { places } from './data';
import type { Ghost } from './domain';
afterEach(cleanup);
const ghost: Ghost = {
  id: 'test',
  name: 'Дух',
  anxiety: 5,
  temperature: 0,
  deadline: '2026-10-16',
  conditions: ['noMirrors'],
};
it.each([
  [5, 25, 75, 'good'],
  [5, 30, 74, 'warning'],
  [10, 75, 45, 'warning'],
  [10, 80, 44, 'bad'],
] as const)('показывает порог комфорта %s °C / шум %s: %s', (temperature, noise, score, tone) => {
  render(
    <ComfortPanel
      ghost={ghost}
      place={{ ...places[0], temperature, noise, mirrors: true }}
      today="2026-10-16"
    />,
  );
  const bar = screen.getByRole('progressbar');
  expect(bar.getAttribute('aria-valuenow')).toBe(String(score));
  expect(bar.closest('section')?.classList.contains(`comfort-${tone}`)).toBe(true);
  expect(screen.getByText('✕ Нарушено')).toBeTruthy();
  expect(screen.getByText(/есть обязательные ограничения/)).toBeTruthy();
  expect(screen.getByText(`🌡 Отклонение: +${temperature} °C`)).toBeTruthy();
});
