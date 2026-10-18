// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSession, makeBackup, readBackup, recoveryKey, resetSavedSession } from './backup';
import { parseSession, storageKey, type Session } from './storage';
import { demoGhosts, places } from './data';

function session(): Session {
  const ghosts = demoGhosts('2026-10-18');
  ghosts[0] = { ...ghosts[0], deadline: '2026-10-20', settledAt: '2026-10-18' };
  return {
    ghosts,
    places: structuredClone(places),
    assignments: { [ghosts[0].id]: places[0].id },
    pinned: [ghosts[0].id],
  };
}
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('сохранение и резервные копии', () => {
  it('загружает существующие данные с завершённым переселением без миграционных потерь', () => {
    const data = session();
    localStorage.setItem(storageKey, JSON.stringify(data));
    expect(loadSession()).toMatchObject({ ...data, blocked: false, error: '' });
    expect(readBackup(makeBackup(data))).toEqual(data);
  });
  it.each(['{повреждено', ''])(
    'сохраняет исходную повреждённую запись %j и блокирует запись',
    (original) => {
      localStorage.setItem(storageKey, original);
      const loaded = loadSession();
      expect(loaded.blocked).toBe(true);
      expect(loaded.original).toBe(original);
      expect(loaded.error).toContain('не перезаписаны');
      expect(localStorage.getItem(storageKey)).toBe(original);
    },
  );
  it('запускает демосессию при отсутствии сохранения, а сбой чтения блокирует запись', () => {
    expect(loadSession()).toMatchObject({ blocked: false, original: null, error: '' });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadSession()).toMatchObject({ blocked: true, original: null });
  });
  it('не принимает JSON-отчёт, другую версию копии и повреждённую сессию', () => {
    expect(() =>
      readBackup(
        JSON.stringify({ format: 'quiet-address-report', version: 1, session: session() }),
      ),
    ).toThrow();
    expect(() =>
      readBackup(JSON.stringify({ format: 'quiet-address', version: 2, session: session() })),
    ).toThrow();
    expect(() =>
      readBackup(JSON.stringify({ format: 'quiet-address', version: 1, session: {} })),
    ).toThrow();
  });
  it.each(['2026-02-30', '2026-13-01', 'вчера', 123])(
    'отклоняет некорректную дату завершения %j',
    (invalid) => {
      const data = session();
      const raw = { ...data, ghosts: [{ ...data.ghosts[0], settledAt: invalid }] };
      expect(() => parseSession(JSON.stringify(raw))).toThrow('Повреждённая заявка');
    },
  );
  it('отклоняет завершённое переселение без назначенного места', () => {
    const data = session();
    expect(() => parseSession(JSON.stringify({ ...data, assignments: {}, pinned: [] }))).toThrow(
      'Повреждённая заявка',
    );
  });
});

describe('безопасный аварийный сброс', () => {
  it('сначала сохраняет исходник и только потом очищает рабочий ключ', () => {
    localStorage.setItem(storageKey, 'original');
    resetSavedSession();
    expect(localStorage.getItem(storageKey)).toBeNull();
    expect(localStorage.getItem(recoveryKey)).toBe('original');
  });
  it('при невозможности сделать копию не удаляет исходник', () => {
    localStorage.setItem(storageKey, 'original');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => resetSavedSession()).toThrow();
    expect(localStorage.getItem(storageKey)).toBe('original');
  });
});
