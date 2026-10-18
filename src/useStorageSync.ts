import { useEffect, useState, useSyncExternalStore } from 'react';
import { createStorageSync, type StorageSyncOptions } from './storage-sync';

/** Options describe one mounted document/key. Remount to change key or parser. */
export function useStorageSync<T>(options: StorageSyncOptions<T>) {
  const [sync] = useState(() => createStorageSync(options));
  const state = useSyncExternalStore(sync.subscribe, sync.getSnapshot, sync.getSnapshot);
  useEffect(() => sync.listen(window), [sync]);
  return { sync, state, blocked: state.status !== 'ready' };
}
