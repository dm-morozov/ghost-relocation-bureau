// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { createStorageSync, readStorageBaseline, type StorageAccess } from './storage-sync';

const key = 'session-sync-test';
const parse = (raw: string | null): { count: number } => {
  if (raw === null) return { count: 0 };
  const value = JSON.parse(raw);
  if (typeof value.count !== 'number') throw new Error('invalid domain');
  return value;
};
const one = '{"count":1}';
const two = '{"count":2}';
function boot() {
  return createStorageSync({ key, baseline: readStorageBaseline(key), parse });
}
beforeEach(() => localStorage.clear());

it('saves against the boot raw and updates its own baseline across repeated writes', () => {
  const sync = boot();
  expect(sync.save(one)).toBe(true);
  expect(sync.save(two)).toBe(true);
  expect(localStorage.getItem(key)).toBe(two);
});

it('detects a write by the other tab synchronously without a storage event', () => {
  localStorage.setItem(key, one);
  const a = boot();
  const b = boot();
  expect(b.save(two)).toBe(true);
  expect(a.save('{"count":3}')).toBe(false);
  expect(localStorage.getItem(key)).toBe(two);
  expect(a.getSnapshot()).toEqual({ status: 'conflict', remoteRaw: two });
});

it('latches a conflict even if the previous raw reappears; only explicit load resumes saving', () => {
  localStorage.setItem(key, one);
  const sync = boot();
  localStorage.setItem(key, two);
  sync.check();
  localStorage.setItem(key, one);
  expect(sync.save(two)).toBe(false);
  const apply = vi.fn();
  expect(sync.loadFresh(apply)).toBe(true);
  expect(apply).toHaveBeenCalledWith({ count: 1 });
  expect(sync.save(two)).toBe(true);
});

it('uses actual boot raw even when the key changes before listener registration', () => {
  const baseline = readStorageBaseline(key);
  localStorage.setItem(key, one);
  const sync = createStorageSync({ key, baseline, parse });
  const stop = sync.listen(window);
  expect(sync.getSnapshot()).toEqual({ status: 'conflict', remoteRaw: one });
  expect(sync.save(two)).toBe(false);
  stop();
});

it.each([false, true])(
  'detects removal/clear and lets the caller parse null (clear=%s)',
  (clear) => {
    localStorage.setItem(key, one);
    const sync = boot();
    const stop = sync.listen(window);
    if (clear) localStorage.clear();
    else localStorage.removeItem(key);
    window.dispatchEvent(new StorageEvent('storage', { key: clear ? null : key }));
    expect(sync.getSnapshot()).toEqual({ status: 'conflict', remoteRaw: null });
    expect(sync.save(two)).toBe(false);
    const apply = vi.fn();
    expect(sync.loadFresh(apply)).toBe(true);
    expect(apply).toHaveBeenCalledWith({ count: 0 });
    // Loading itself never writes a default over a deletion.
    expect(localStorage.getItem(key)).toBeNull();
    stop();
  },
);

it('ignores other keys/sessionStorage and re-reads instead of trusting stale event payloads', () => {
  const sync = boot();
  const stop = sync.listen(window);
  localStorage.setItem(key, one);
  window.dispatchEvent(new StorageEvent('storage', { key: 'other' }));
  window.dispatchEvent(new StorageEvent('storage', { key, storageArea: sessionStorage }));
  expect(sync.getSnapshot().status).toBe('ready');
  window.dispatchEvent(
    new StorageEvent('storage', { key, newValue: two, storageArea: localStorage }),
  );
  expect(sync.getSnapshot()).toEqual({ status: 'conflict', remoteRaw: one });
  stop();
});

it.each(['bad json', '{"count":"bad"}'])('keeps malformed remote intact: %s', (raw) => {
  const sync = boot();
  localStorage.setItem(key, raw);
  const apply = vi.fn();
  expect(sync.loadFresh(apply)).toBe(false);
  expect(apply).not.toHaveBeenCalled();
  expect(sync.getSnapshot()).toEqual({ status: 'invalid', remoteRaw: raw });
  expect(sync.save(one)).toBe(false);
  expect(localStorage.getItem(key)).toBe(raw);
});

it('blocks malformed initial data until a valid version is loaded', () => {
  localStorage.setItem(key, 'broken');
  const sync = createStorageSync({
    key,
    baseline: readStorageBaseline(key),
    parse,
    initialInvalid: true,
  });
  expect(sync.save(one)).toBe(false);
  localStorage.setItem(key, two);
  expect(sync.loadFresh(vi.fn())).toBe(true);
  expect(sync.save(one)).toBe(true);
});

it('handles inaccessible localStorage getters and requires explicit load after recovery', () => {
  let unavailable = true;
  const storage: StorageAccess = () => {
    if (unavailable) throw new Error('SecurityError');
    return localStorage;
  };
  const baseline = readStorageBaseline(key, storage);
  expect(baseline).toEqual({ ok: false });
  const sync = createStorageSync({ key, baseline, parse, storage });
  expect(sync.save(one)).toBe(false);
  expect(sync.loadFresh(vi.fn())).toBe(false);
  unavailable = false;
  expect(sync.save(one)).toBe(false);
  expect(sync.loadFresh(vi.fn())).toBe(true);
  expect(sync.save(one)).toBe(true);
});

it('blocks after quota failure without advancing baseline and supports a guarded deletion', () => {
  localStorage.setItem(key, one);
  const setItem = vi.fn(() => {
    throw new Error('QuotaExceededError');
  });
  const storage = () => ({
    getItem: (k: string) => localStorage.getItem(k),
    setItem,
    removeItem: (k: string) => localStorage.removeItem(k),
  });
  const sync = createStorageSync({
    key,
    baseline: readStorageBaseline(key, storage),
    parse,
    storage,
  });
  expect(sync.save(two)).toBe(false);
  expect(sync.getSnapshot().status).toBe('unavailable');
  expect(localStorage.getItem(key)).toBe(one);
  expect(sync.save(null)).toBe(false);
  expect(sync.loadFresh(vi.fn())).toBe(true);
  expect(sync.save(null)).toBe(true);
  expect(localStorage.getItem(key)).toBeNull();
});

it('rechecks a second remote change after explicit reload', () => {
  const sync = boot();
  localStorage.setItem(key, one);
  expect(sync.loadFresh(vi.fn())).toBe(true);
  localStorage.setItem(key, two);
  expect(sync.save(null)).toBe(false);
  expect(localStorage.getItem(key)).toBe(two);
});

it('does not adopt a new baseline if applying a fresh version fails', () => {
  const sync = boot();
  localStorage.setItem(key, one);
  sync.check();
  expect(() =>
    sync.loadFresh(() => {
      throw new Error('apply failed');
    }),
  ).toThrow('apply failed');
  expect(sync.save(two)).toBe(false);
});

it('keeps session and game guards independent', () => {
  const session = boot();
  const game = createStorageSync({
    key: 'game-sync-test',
    baseline: readStorageBaseline('game-sync-test'),
    parse,
  });
  localStorage.setItem(key, one);
  expect(session.save(two)).toBe(false);
  expect(game.save(two)).toBe(true);
});
