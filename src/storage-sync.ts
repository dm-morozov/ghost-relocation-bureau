export type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type StorageBaseline = { ok: true; raw: string | null } | { ok: false };
export type StorageSyncState =
  | { status: 'ready' }
  | { status: 'conflict'; remoteRaw: string | null }
  | { status: 'unavailable' }
  | { status: 'invalid'; remoteRaw: string | null };

export const browserStorage: StorageAccess = () => window.localStorage;

/** Capture this in the boot loader, using the SAME raw that is parsed for initial state. */
export function readStorageBaseline(
  key: string,
  storage: StorageAccess = browserStorage,
): StorageBaseline {
  try {
    return { ok: true, raw: storage().getItem(key) };
  } catch {
    return { ok: false };
  }
}

export interface StorageSyncOptions<T> {
  key: string;
  baseline: StorageBaseline;
  /** Must validate the domain schema. null means deletion; caller chooses the empty state. */
  parse: (raw: string | null) => T;
  storage?: StorageAccess;
  /** A successfully read but malformed boot value must stay protected, too. */
  initialInvalid?: boolean;
}

/** Optimistic protection, not an atomic cross-tab transaction (localStorage has no CAS). */
export function createStorageSync<T>(options: StorageSyncOptions<T>) {
  const storage = options.storage ?? browserStorage;
  let baseline = options.baseline;
  let state: StorageSyncState = !baseline.ok
    ? { status: 'unavailable' }
    : options.initialInvalid
      ? { status: 'invalid', remoteRaw: baseline.raw }
      : { status: 'ready' };
  const listeners = new Set<() => void>();
  function publish(next: StorageSyncState) {
    if (
      state.status === next.status &&
      (!('remoteRaw' in state) || ('remoteRaw' in next && state.remoteRaw === next.remoteRaw))
    )
      return;
    state = next;
    listeners.forEach((listener) => listener());
  }
  function read() {
    const result = readStorageBaseline(options.key, storage);
    if (!result.ok) publish({ status: 'unavailable' });
    return result;
  }
  function check() {
    const current = read();
    if (current.ok && (!baseline.ok || current.raw !== baseline.raw))
      publish({ status: 'conflict', remoteRaw: current.raw });
    // A conflict stays latched even if the old value is restored by another tab.
    return current.ok && state.status === 'ready';
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    check,
    /** null removes the key. Every write (including reset/delete) checks current raw first. */
    save(raw: string | null): boolean {
      if (!check()) return false;
      try {
        if (raw !== baselineRaw()) {
          if (raw === null) storage().removeItem(options.key);
          else storage().setItem(options.key, raw);
        }
        baseline = { ok: true, raw };
        return true;
      } catch {
        publish({ status: 'unavailable' });
        return false;
      }
    },
    /** Explicit user action only. Re-read now, never trust a delayed event's newValue. */
    loadFresh(apply: (value: T) => void): boolean {
      const current = read();
      if (!current.ok) return false;
      let value: T;
      try {
        value = options.parse(current.raw);
      } catch {
        publish({ status: 'invalid', remoteRaw: current.raw });
        return false;
      }
      // Apply before unblocking. If the callback throws, writes remain blocked.
      apply(value);
      baseline = current;
      publish({ status: 'ready' });
      return true;
    },
    listen(target: Window) {
      const listener = (event: StorageEvent) => {
        if (event.key !== null && event.key !== options.key) return;
        // Ignore sessionStorage and unrelated storage areas. Synthetic tests may omit it.
        try {
          if (event.storageArea && event.storageArea !== storage()) return;
        } catch {
          publish({ status: 'unavailable' });
          return;
        }
        check();
      };
      target.addEventListener('storage', listener);
      // Catch changes between boot and effect registration; never adopt them as baseline.
      check();
      return () => target.removeEventListener('storage', listener);
    },
  };
  function baselineRaw() {
    return baseline.ok ? baseline.raw : undefined;
  }
}
