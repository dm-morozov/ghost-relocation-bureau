// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeToggle from './ThemeToggle';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.removeItem('quiet-address-theme');
  delete document.documentElement.dataset.theme;
});

it('switches both directions and restores the saved preference after remount', async () => {
  const user = userEvent.setup();
  const first = render(<ThemeToggle />);
  expect(document.documentElement.dataset.theme).toBe('light');
  await user.click(screen.getByRole('button', { name: 'Ночная смена' }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('quiet-address-theme')).toBe('dark');
  first.unmount();
  render(<ThemeToggle />);
  await user.click(screen.getByRole('button', { name: 'Дневной архив' }));
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(localStorage.getItem('quiet-address-theme')).toBe('light');
});

it('keeps the toggle usable when browser storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage blocked');
  });
  render(<ThemeToggle />);
  await userEvent.click(screen.getByRole('button', { name: 'Ночная смена' }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(screen.getByRole('button', { name: 'Дневной архив' })).toBeTruthy();
});

it('ignores an unknown stored theme without changing the session data', () => {
  localStorage.setItem('quiet-address-theme', 'unknown');
  localStorage.setItem('quiet-address-v1', 'session-fixture');
  render(<ThemeToggle />);
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(localStorage.getItem('quiet-address-v1')).toBe('session-fixture');
  localStorage.removeItem('quiet-address-v1');
});
