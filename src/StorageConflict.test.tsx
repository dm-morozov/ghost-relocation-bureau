// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import StorageConflict from './StorageConflict';
import { useStorageSync } from './useStorageSync';
import { readStorageBaseline } from './storage-sync';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

it('hides when ready and exposes two explicit keyboard-accessible actions while blocked', async () => {
  const onLoadFresh = vi.fn();
  const onDownloadLocal = vi.fn();
  const props = { subject: 'Смена', onLoadFresh, onDownloadLocal };
  const view = render(<StorageConflict {...props} state={{ status: 'ready' }} />);
  expect(screen.queryByRole('alert')).toBeNull();
  view.rerender(<StorageConflict {...props} state={{ status: 'conflict', remoteRaw: null }} />);
  expect(screen.getByRole('alert').textContent).toContain('удалено');
  const user = userEvent.setup();
  await user.tab();
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Скачать локальную копию' }),
  );
  await user.keyboard('{Enter}');
  expect(onDownloadLocal).toHaveBeenCalledOnce();
  expect(onLoadFresh).not.toHaveBeenCalled();
  await user.tab();
  await user.keyboard('{Enter}');
  expect(onLoadFresh).toHaveBeenCalledOnce();
});

it.each(['invalid', 'unavailable'] as const)(
  'explains %s without disabling local export',
  (status) => {
    render(
      <StorageConflict
        subject="Сессия"
        state={status === 'invalid' ? { status, remoteRaw: 'bad' } : { status }}
        onLoadFresh={vi.fn()}
        onDownloadLocal={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain(
      status === 'invalid' ? 'повреждена' : 'недоступно',
    );
    expect(
      screen.getByRole('button', { name: 'Скачать локальную копию' }).hasAttribute('disabled'),
    ).toBe(false);
  },
);

it('retains boot baseline through StrictMode effects/rerenders and removes storage listener on unmount', () => {
  const key = 'hook-sync-test';
  const baseline = readStorageBaseline(key);
  localStorage.setItem(key, 'remote');
  const remove = vi.spyOn(window, 'removeEventListener');
  const { result, rerender, unmount } = renderHook(
    () => useStorageSync({ key, baseline, parse: (raw) => raw }),
    { wrapper: StrictMode },
  );
  expect(result.current.blocked).toBe(true);
  const sync = result.current.sync;
  rerender();
  expect(result.current.sync).toBe(sync);
  expect(sync.save('local')).toBe(false);
  act(() => {
    sync.loadFresh(vi.fn());
  });
  expect(result.current.blocked).toBe(false);
  localStorage.setItem(key, 'remote-2');
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key }));
  });
  expect(result.current.blocked).toBe(true);
  unmount();
  expect(remove).toHaveBeenCalledWith('storage', expect.any(Function));
});
