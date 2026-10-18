import { describe, expect, it } from 'vitest';
import { RelocationService, SuitabilityRule, relocation, type Ghost, type Place } from './domain';
import { demoGhosts, places } from './data';
import { parseSession } from './storage';
const today = '2026-10-16';
const ghost: Ghost = {
  id: 'a',
  name: 'Тест',
  anxiety: 5,
  temperature: 10,
  deadline: today,
  conditions: [],
};
const place: Place = { ...places[0], id: 'p', capacity: 1, noise: 0 };
describe('обязательные условия и комфорт', () => {
  it('принимает дедлайн сегодня, отклоняет вчера', () => {
    expect(relocation.evaluate(ghost, place, today).conflicts).toEqual([]);
    expect(
      relocation.evaluate({ ...ghost, deadline: '2026-10-15' }, place, today).conflicts,
    ).toContain('Дедлайн просрочен: продлите срок перед переселением');
  });
  it('объясняет несовместимость зеркал, людей, света, шума и сырости', () => {
    const e = relocation.evaluate(
      { ...ghost, conditions: ['attic', 'noMirrors', 'noPeople', 'dark', 'quiet', 'damp'] },
      { ...place, attic: false, mirrors: true, people: true, light: 31, noise: 31, humidity: 64 },
      today,
    );
    expect(e.conflicts).toHaveLength(6);
  });
  it('считает формулу и границы обязательных условий', () => {
    expect(relocation.evaluate(ghost, { ...place, temperature: 15, noise: 20 }, today).score).toBe(
      76,
    );
    expect(
      relocation.evaluate(
        { ...ghost, conditions: ['dark', 'quiet', 'damp'] },
        { ...place, light: 30, noise: 30, humidity: 65 },
        today,
      ).conflicts,
    ).toEqual([]);
  });
  it('позволяет подставить собственное правило через общий контракт', () => {
    class RejectRule extends SuitabilityRule {
      check() {
        return ['Закрыто на ремонт'];
      }
    }
    expect(new RelocationService([new RejectRule()]).allocate([ghost], [place], today)).toEqual({});
  });
});
describe('распределение', () => {
  it('обрабатывает пустые заявки и пустые места', () => {
    expect(relocation.allocate([], places, today)).toEqual({});
    expect(relocation.allocate([ghost], [], today)).toEqual({});
  });
  it('не переполняет единственное место', () => {
    expect(
      Object.keys(relocation.allocate([ghost, { ...ghost, id: 'b' }], [place], today)),
    ).toHaveLength(1);
  });
  it('переназначает гибкую заявку, чтобы вместить требовательную', () => {
    const a = { ...ghost, id: 'flexible' },
      b = { ...ghost, id: 'needs-attic', conditions: ['attic'] as const };
    const result = relocation.allocate(
      [a, { ...b, conditions: [...b.conditions] }],
      [place, { ...place, id: 'q', attic: false, temperature: 11 }],
      today,
    );
    expect(result).toEqual({ flexible: 'q', 'needs-attic': 'p' });
  });
  it('выбирает максимальный суммарный комфорт', () => {
    const result = relocation.allocate(
      [ghost, { ...ghost, id: 'b', temperature: 20 }],
      [place, { ...place, id: 'q', temperature: 20 }],
      today,
    );
    expect(result).toEqual({ a: 'p', b: 'q' });
  });
  it('демосценарий: четыре назначения, две невозможные заявки', () => {
    const result = relocation.allocate(demoGhosts(today), places, today);
    expect(Object.keys(result)).toHaveLength(4);
    expect(result.g5).toBeUndefined();
    expect(result.g6).toBeUndefined();
    for (const g of demoGhosts(today))
      if (result[g.id])
        expect(
          relocation.conflicts(
            g,
            places.find((p) => p.id === result[g.id])!,
            result,
            today,
          ),
        ).toEqual([]);
  });
  it('предупреждает о ручном переполнении, но не считает себя вторым жильцом', () => {
    expect(relocation.conflicts(ghost, place, { a: 'p' }, today)).toEqual([]);
    expect(relocation.conflicts(ghost, place, { b: 'p' }, today).join(' ')).toContain(
      'Нет свободных мест',
    );
  });
});
describe('хранение', () => {
  it('восстанавливает валидную сессию', () => {
    const value = { ghosts: [ghost], assignments: { a: 'castle' } };
    expect(parseSession(JSON.stringify(value))).toEqual({ ...value, places });
  });
  it('сохраняет новое место и использует его для невозможной ранее заявки', () => {
    const custom = {
      ...places[0],
      id: 'new-place',
      name: 'Сырой чердак',
      humidity: 80,
      image: 'castle',
    };
    const g = demoGhosts(today)[4];
    const assignments = relocation.allocate([g], [custom], today);
    expect(assignments[g.id]).toBe(custom.id);
    const session = { ghosts: [g], places: [...places, custom], assignments };
    expect(parseSession(JSON.stringify(session))).toEqual(session);
  });
  it('отклоняет некорректную вместимость и неизвестное изображение места', () => {
    for (const custom of [
      { ...places[0], capacity: 0 },
      { ...places[0], image: 'https://external.invalid/image.png' },
    ]) {
      expect(() =>
        parseSession(JSON.stringify({ ghosts: [], places: [custom], assignments: {} })),
      ).toThrow();
    }
  });
  it('отклоняет повреждение, неизвестные условия и назначения', () => {
    for (const raw of [
      '{',
      'null',
      JSON.stringify({ ghosts: [{ ...ghost, conditions: ['unknown'] }], assignments: {} }),
      JSON.stringify({ ghosts: [ghost], assignments: { a: 'unknown' } }),
      JSON.stringify({ ghosts: [ghost, ghost], assignments: {} }),
      JSON.stringify({ ghosts: [{ ...ghost, deadline: '2026-02-31' }], assignments: {} }),
    ])
      expect(() => parseSession(raw)).toThrow();
  });
});

describe('закреплённые назначения', () => {
  it('сохраняет ручной адрес, резервирует вместимость и не меняет входные данные', () => {
    const fixed = { a: 'p' };
    const preferred = { ...place, id: 'better', temperature: ghost.temperature };
    const result = relocation.allocate(
      [ghost, { ...ghost, id: 'b' }],
      [place, preferred],
      today,
      fixed,
    );
    expect(result).toEqual({ a: 'p', b: 'better' });
    expect(fixed).toEqual({ a: 'p' });
    expect(place.capacity).toBe(1);
  });
  it('сохраняет закреплённый конфликт и не подселяет в переполненное место', () => {
    const expired = { ...ghost, deadline: '2026-10-15' };
    expect(
      relocation.allocate([expired, { ...ghost, id: 'b' }, { ...ghost, id: 'c' }], [place], today, {
        a: 'p',
        b: 'p',
      }),
    ).toEqual({ a: 'p', b: 'p' });
  });
  it('после снятия закрепления снова выбирает лучший адрес', () => {
    const better = { ...place, id: 'better', temperature: ghost.temperature };
    expect(relocation.allocate([ghost], [{ ...place, temperature: 40 }, better], today)).toEqual({
      a: 'better',
    });
  });
  it('сохраняет валидные закрепления и отвергает неизвестные и дубли', () => {
    const session = { ghosts: [ghost], places: [place], assignments: { a: 'p' }, pinned: ['a'] };
    expect(parseSession(JSON.stringify(session))).toEqual(session);
    expect(() => parseSession(JSON.stringify({ ...session, pinned: ['b'] }))).toThrow();
    expect(() => parseSession(JSON.stringify({ ...session, pinned: ['a', 'a'] }))).toThrow();
    expect(() => parseSession(JSON.stringify({ ...session, assignments: {} }))).toThrow();
  });
});

describe('даты и завершённый переезд', () => {
  it('выполненный вовремя дедлайн не превращается в просрочку задним числом', () => {
    expect(
      relocation.evaluate({ ...ghost, settledAt: today }, place, '2027-01-01').conflicts,
    ).toEqual([]);
    expect(
      relocation.evaluate({ ...ghost, settledAt: '2026-10-17' }, place, '2027-01-01').conflicts,
    ).toContain('Дедлайн просрочен: продлите срок перед переселением');
    expect(
      relocation.evaluate(
        { ...ghost, settledAt: today, conditions: ['noMirrors'] },
        { ...place, mirrors: true },
        '2027-01-01',
      ).conflicts,
    ).toHaveLength(1);
  });
});
