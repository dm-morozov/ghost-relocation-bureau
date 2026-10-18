import { parseSession, storageKey, type Session } from './storage';
import { demoGhosts, places } from './data';
import { todayISO } from './domain';

export function loadSession(): Session & {
  error: string;
  blocked: boolean;
  original: string | null;
} {
  let original: string | null = null;
  try {
    original = localStorage.getItem(storageKey);
    return {
      ...(original !== null
        ? parseSession(original)
        : {
            ghosts: demoGhosts(todayISO()),
            places: structuredClone(places),
            assignments: {},
            pinned: [],
          }),
      error: '',
      blocked: false,
      original,
    };
  } catch {
    return {
      ghosts: demoGhosts(todayISO()),
      places: structuredClone(places),
      assignments: {},
      pinned: [],
      error:
        'Сохранённая сессия недоступна или повреждена. Открыта временная демосессия. Исходные данные не перезаписаны.',
      blocked: true,
      original,
    };
  }
}
export function makeBackup(session: Session): string {
  return JSON.stringify({ format: 'quiet-address', version: 1, session }, null, 2);
}
export function readBackup(raw: string): Session {
  const value: unknown = JSON.parse(raw);
  if (
    !value ||
    typeof value !== 'object' ||
    !('format' in value) ||
    value.format !== 'quiet-address' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('session' in value)
  )
    throw new Error('Неизвестный формат резервной копии');
  return parseSession(JSON.stringify(value.session));
}
export function saveFile(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const recoveryKey = 'quiet-address-recovery-v1';
export function resetSavedSession() {
  const original = localStorage.getItem(storageKey);
  // Save first: if storage is unavailable or full, leave the source untouched.
  if (original !== null) localStorage.setItem(recoveryKey, original);
  localStorage.removeItem(storageKey);
}
