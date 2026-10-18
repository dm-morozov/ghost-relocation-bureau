// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import html from '../index.html?raw';
import ThemeToggle from './ThemeToggle';

let query: MediaQueryList;
let listeners: Set<() => void>;

beforeEach(() => {
  listeners = new Set();
  query = {
    matches: false,
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn((_event: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_event: string, listener: () => void) =>
      listeners.delete(listener),
    ),
  } as unknown as MediaQueryList;
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => query),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = '';
});

function changeSystem(dark: boolean) {
  Object.defineProperty(query, 'matches', { value: dark, configurable: true });
  act(() => listeners.forEach((listener) => listener()));
}

it('defaults to system and follows device changes while mounted', () => {
  render(<ThemeToggle />);
  expect((screen.getByRole('radio', { name: 'Системная' }) as HTMLInputElement).checked).toBe(true);
  expect(document.documentElement.dataset.theme).toBe('light');
  changeSystem(true);
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.documentElement.style.colorScheme).toBe('dark');
  expect(screen.getByText('Как на устройстве · ночная')).toBeTruthy();
  changeSystem(false);
  expect(document.documentElement.dataset.theme).toBe('light');
});

it('persists explicit choices, ignores device changes, and resumes following system', async () => {
  const user = userEvent.setup();
  const first = render(<ThemeToggle />);
  await user.click(screen.getByRole('radio', { name: 'Ночная' }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('quiet-address-theme')).toBe('dark');
  expect(listeners.size).toBe(0);
  changeSystem(false);
  expect(document.documentElement.dataset.theme).toBe('dark');
  first.unmount();
  render(<ThemeToggle />);
  expect((screen.getByRole('radio', { name: 'Ночная' }) as HTMLInputElement).checked).toBe(true);
  await user.click(screen.getByRole('radio', { name: 'Дневная' }));
  changeSystem(true);
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(localStorage.getItem('quiet-address-theme')).toBe('light');
  await user.click(screen.getByRole('radio', { name: 'Системная' }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('quiet-address-theme')).toBe('system');
});

it.each(['light', 'dark'])('restores the existing %s preference', (preference) => {
  localStorage.setItem('quiet-address-theme', preference);
  render(<ThemeToggle />);
  expect(document.documentElement.dataset.theme).toBe(preference);
  expect(listeners.size).toBe(0);
});

it('keeps all choices usable when browser storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage blocked');
  });
  render(<ThemeToggle />);
  changeSystem(true);
  expect(document.documentElement.dataset.theme).toBe('dark');
  await userEvent.click(screen.getByRole('radio', { name: 'Дневная' }));
  expect(document.documentElement.dataset.theme).toBe('light');
});

it('uses system for unknown values and leaves application data untouched', () => {
  localStorage.setItem('quiet-address-theme', 'unknown');
  localStorage.setItem('quiet-address-v1', 'session-fixture');
  changeSystem(true);
  render(<ThemeToggle />);
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('quiet-address-v1')).toBe('session-fixture');
});

it('falls back to daylight when matchMedia is unavailable', () => {
  vi.stubGlobal('matchMedia', undefined);
  render(<ThemeToggle />);
  expect(document.documentElement.dataset.theme).toBe('light');
});

it('removes device listeners on unmount', () => {
  const mounted = render(<ThemeToggle />);
  expect(listeners.size).toBe(1);
  mounted.unmount();
  expect(listeners.size).toBe(0);
});

it('supports native keyboard navigation between theme options', async () => {
  const user = userEvent.setup();
  render(<ThemeToggle />);
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Системная' }));
  await user.keyboard('{ArrowRight}');
  expect((screen.getByRole('radio', { name: 'Дневная' }) as HTMLInputElement).checked).toBe(true);
  await user.keyboard('{ArrowRight}');
  expect(document.documentElement.dataset.theme).toBe('dark');
});

it.each([
  [null, true, 'dark'],
  [null, false, 'light'],
  ['system', true, 'dark'],
  ['unknown', true, 'dark'],
  ['light', true, 'light'],
  ['dark', false, 'dark'],
])('bootstraps %s with device dark=%s before React loads', (stored, dark, expected) => {
  if (stored !== null) localStorage.setItem('quiet-address-theme', stored as string);
  changeSystem(dark as boolean);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  expect(script).toBeTruthy();
  new Function(script!)();
  expect(document.documentElement.dataset.theme).toBe(expected);
  expect(document.documentElement.style.colorScheme).toBe(expected);
});

it('bootstraps with blocked storage', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage blocked');
  });
  changeSystem(true);
  new Function(html.match(/<script>([\s\S]*?)<\/script>/)![1])();
  expect(document.documentElement.dataset.theme).toBe('dark');
});
