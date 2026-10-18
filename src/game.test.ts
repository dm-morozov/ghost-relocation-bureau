import { describe, expect, it } from 'vitest';
import {
  advancePreview,
  currentGhosts,
  newGame,
  parseGame,
  play,
  reserved,
  serializeGame,
} from './game';

describe('кампания из трёх смен', () => {
  it('показывает последствия без изменения состояния и фиксирует пропущенные заявки', () => {
    const state = newGame();
    expect(advancePreview(state).map((o) => o.placeId)).toEqual([null, null]);
    expect(state.turn).toBe(1);
    const next = play(state, { type: 'advance' });
    expect(next.turn).toBe(2);
    expect(next.outcomes).toHaveLength(2);
    expect(currentGhosts(next)[0].name).toBe('Вера Сумеречная');
    expect(state.outcomes).toHaveLength(0);
  });

  it('тратит жетоны один раз и запрещает заселение до выполнения условий', () => {
    const start = newGame();
    expect(() => play(start, { type: 'assign', ghostId: 'campaign-0', placeId: 'castle' })).toThrow(
      /тишина/,
    );
    const state = play(start, { type: 'upgrade', placeId: 'castle', upgrade: 'quiet' });
    expect(state.tokens).toBe(2);
    expect(state.places[0].noise).toBe(10);
    expect(() => play(state, { type: 'upgrade', placeId: 'castle', upgrade: 'quiet' })).toThrow(
      /уже установлено/,
    );
    expect(() => play(state, { type: 'assign', ghostId: 'campaign-3', placeId: 'castle' })).toThrow(
      /Неизвестная/,
    );
  });

  it('даёт завершить все три смены, сохраняя постоянных жильцов и вместимость', () => {
    let state = newGame();
    const upgrades = ['quiet', 'dark', 'damp'] as const;
    const placeIds = ['castle', 'library', 'manor'];
    for (let i = 0; i < 3; i++) {
      state = play(state, { type: 'upgrade', placeId: placeIds[i], upgrade: upgrades[i] });
      state = play(state, { type: 'advise' });
      expect(Object.keys(state.assignments)).toHaveLength(2);
      expect(advancePreview(state).every((o) => o.placeId === placeIds[i])).toBe(true);
      state = play(state, { type: 'advance' });
      expect(Object.values(reserved(state)).filter((id) => id === placeIds[i])).toHaveLength(2);
    }
    expect(state.tokens).toBe(0);
    expect(state.outcomes.filter((o) => o.placeId)).toHaveLength(6);
    expect(state.turn).toBe(4);
    expect(currentGhosts(state)).toEqual([]);
    expect(() => play(state, { type: 'advise' })).toThrow(/завершена/);
    expect(parseGame(serializeGame(state))).toEqual(state);
  });

  it('не позволяет потратить четвёртый жетон и не превращает советника в источник вместимости', () => {
    let state = newGame();
    state = play(state, { type: 'upgrade', placeId: 'castle', upgrade: 'quiet' });
    state = play(state, { type: 'upgrade', placeId: 'castle', upgrade: 'dark' });
    state = play(state, { type: 'upgrade', placeId: 'castle', upgrade: 'damp' });
    expect(() => play(state, { type: 'upgrade', placeId: 'library', upgrade: 'quiet' })).toThrow(
      /закончились/,
    );
    state = play(play(state, { type: 'advise' }), { type: 'advance' });
    state = play(state, { type: 'advise' });
    expect(state.assignments).toEqual({});
    expect(() => play(state, { type: 'assign', ghostId: 'campaign-2', placeId: 'castle' })).toThrow(
      /мест/,
    );
  });

  it('восстанавливает состояние из допустимых действий, отбрасывая поддельные ресурсы', () => {
    const state = play(newGame(), { type: 'upgrade', placeId: 'castle', upgrade: 'quiet' });
    expect(
      parseGame(JSON.stringify({ ...JSON.parse(serializeGame(state)), tokens: 999 })).tokens,
    ).toBe(2);
    expect(() => parseGame('{broken')).toThrow();
    expect(() => parseGame(JSON.stringify({ version: 2, actions: [] }))).toThrow();
    expect(() =>
      parseGame(
        JSON.stringify({
          version: 1,
          actions: [{ type: 'upgrade', placeId: 'castle', upgrade: 'magic' }],
        }),
      ),
    ).toThrow();
    expect(() => parseGame(JSON.stringify({ version: 1, actions: [null] }))).toThrow();
    expect(() =>
      parseGame(
        JSON.stringify({ version: 1, actions: [{ type: 'assign', ghostId: 'campaign-0' }] }),
      ),
    ).toThrow(/формат/);
    expect(() =>
      parseGame(JSON.stringify({ version: 1, actions: Array(4).fill({ type: 'advance' }) })),
    ).toThrow();
  });
});
