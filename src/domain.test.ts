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
    expect(parseSession(JSON.stringify(value))).toEqual(value);
  });
  it('отклоняет повреждение, неизвестные условия и назначения', () => {
    for (const raw of [
      '{',
      'null',
      JSON.stringify({ ghosts: [{ ...ghost, conditions: ['unknown'] }], assignments: {} }),
      JSON.stringify({ ghosts: [ghost], assignments: { a: 'unknown' } }),
      JSON.stringify({ ghosts: [ghost, ghost], assignments: {} }),
    ])
      expect(() => parseSession(raw)).toThrow();
  });
});
