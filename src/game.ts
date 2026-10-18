import { relocation, type Assignments, type Ghost, type Place } from './domain';

export const gameStorageKey = 'quiet-address-game-v1';
export type Upgrade = 'quiet' | 'dark' | 'damp';
export type GameAction =
  | { type: 'assign'; ghostId: string; placeId: string }
  | { type: 'advise' }
  | { type: 'upgrade'; placeId: string; upgrade: Upgrade }
  | { type: 'advance' };
export interface Outcome {
  ghostId: string;
  placeId: string | null;
  score: number;
  turn: number;
}
export interface GameState {
  turn: number;
  tokens: number;
  places: Place[];
  assignments: Assignments;
  outcomes: Outcome[];
  log: string[];
  actions: GameAction[];
}
export const upgradeLabels: Record<Upgrade, string> = {
  quiet: 'Шумоизоляция → шум 10',
  dark: 'Шторы → свет 10',
  damp: 'Увлажнение → влажность 85',
};
export const arrivals: Ghost[] = [
  ['Нора Шёпот', 0, 10, 'quiet'],
  ['Оскар Тихий', 1, 16, 'quiet'],
  ['Вера Сумеречная', 2, 16, 'dark'],
  ['Лев Полночный', 3, 10, 'dark'],
  ['Ирис Дождевая', 4, 8, 'damp'],
  ['Фома Туманный', 5, 16, 'damp'],
].map(([name, portrait, temperature, condition], i) => ({
  id: `campaign-${i}`,
  name: String(name),
  portrait: Number(portrait),
  anxiety: 5,
  temperature: Number(temperature),
  deadline: '2000-01-01',
  conditions: [condition as Upgrade],
}));
export const events = [
  'Сегодня приезжают Нора и Оскар: обоим нужна тишина.',
  'Следующая смена: Вера и Лев ищут тёмное жильё. Подготовьте освещение ≤ 30.',
  'Следующая смена: Ирис и Фома любят сырость. Нужна влажность ≥ 65.',
];
export function newGame(): GameState {
  return {
    turn: 1,
    tokens: 3,
    assignments: {},
    outcomes: [],
    actions: [],
    log: [],
    places: [
      { id: 'castle', name: 'Замок на холме', temperature: 10 },
      { id: 'library', name: 'Библиотека забвения', temperature: 16 },
      { id: 'manor', name: 'Лесная усадьба', temperature: 8 },
    ].map((p) => ({
      ...p,
      image: p.id,
      description: 'Два постоянных места',
      capacity: 2,
      light: 60,
      noise: 50,
      humidity: 40,
      people: false,
      mirrors: false,
      attic: true,
      maxAnxiety: 10,
    })),
  };
}
export function currentGhosts(state: GameState) {
  return arrivals.slice((state.turn - 1) * 2, state.turn * 2);
}
export function reserved(state: GameState): Assignments {
  return Object.fromEntries(
    state.outcomes.filter((o) => o.placeId).map((o) => [o.ghostId, o.placeId!]),
  ) as Assignments;
}
export function gameConflicts(state: GameState, ghost: Ghost, place: Place) {
  return relocation.conflicts(
    ghost,
    place,
    { ...reserved(state), ...state.assignments },
    '2000-01-01',
  );
}
export function upgradeAvailable(place: Place, upgrade: Upgrade) {
  return upgrade === 'quiet'
    ? place.noise > 10
    : upgrade === 'dark'
      ? place.light > 10
      : place.humidity < 85;
}
export function advancePreview(state: GameState): Outcome[] {
  return currentGhosts(state).map((g) => {
    const p = state.places.find((p) => p.id === state.assignments[g.id]);
    const valid = p && !gameConflicts(state, g, p).length;
    return {
      ghostId: g.id,
      placeId: valid ? p.id : null,
      score: valid ? relocation.evaluate(g, p, '2000-01-01').score : 0,
      turn: state.turn,
    };
  });
}
export function play(state: GameState, action: GameAction): GameState {
  if (state.turn > 3) throw new Error('Кампания завершена. Начните новую игру.');
  if (state.actions.length >= 997 && action.type !== 'advance')
    throw new Error('Достигнут лимит действий. Завершите эту кампанию или начните новую.');
  const next = structuredClone(state);
  if (action.type === 'assign') {
    if (typeof action.ghostId !== 'string' || typeof action.placeId !== 'string')
      throw new Error('Неверный формат назначения.');
    const ghost = currentGhosts(state).find((g) => g.id === action.ghostId);
    const place = state.places.find((p) => p.id === action.placeId);
    if (!ghost || (action.placeId && !place)) throw new Error('Неизвестная заявка или адрес.');
    if (place) {
      const conflicts = gameConflicts(state, ghost, place);
      if (conflicts.length) throw new Error(conflicts.join('; '));
      next.assignments[ghost.id] = place.id;
    } else delete next.assignments[ghost.id];
  } else if (action.type === 'upgrade') {
    if (typeof action.placeId !== 'string' || typeof action.upgrade !== 'string')
      throw new Error('Неверный формат улучшения.');
    const place = next.places.find((p) => p.id === action.placeId);
    if (!place || !Object.hasOwn(upgradeLabels, action.upgrade))
      throw new Error('Неизвестное улучшение.');
    if (state.tokens < 1) throw new Error('Жетоны закончились.');
    if (!upgradeAvailable(place, action.upgrade)) throw new Error('Это улучшение уже установлено.');
    if (action.upgrade === 'quiet') place.noise = 10;
    if (action.upgrade === 'dark') place.light = 10;
    if (action.upgrade === 'damp') place.humidity = 85;
    next.tokens--;
    next.log.push(
      `Смена ${state.turn}: ${place.name} — ${upgradeLabels[action.upgrade]}, −1 жетон.`,
    );
  } else if (action.type === 'advise') {
    const places = state.places.map((p) => ({
      ...p,
      capacity: p.capacity - state.outcomes.filter((o) => o.placeId === p.id).length,
    }));
    next.assignments = relocation.allocate(currentGhosts(state), places, '2000-01-01');
  } else if (action.type === 'advance') {
    const outcomes = advancePreview(state);
    next.outcomes.push(...outcomes);
    next.log.push(
      `Смена ${state.turn} завершена: переселено ${outcomes.filter((o) => o.placeId).length}/2, комфорт +${outcomes.reduce((n, o) => n + o.score, 0)}.`,
    );
    next.turn++;
    next.assignments = {};
  } else throw new Error('Неизвестное действие.');
  next.actions.push(action);
  return next;
}
// Replay validates every saved transition; calendar time never enters the simulation.
export function parseGame(raw: string): GameState {
  const data: unknown = JSON.parse(raw);
  if (
    !data ||
    typeof data !== 'object' ||
    !('version' in data) ||
    data.version !== 1 ||
    !('actions' in data) ||
    !Array.isArray(data.actions) ||
    data.actions.length > 1000
  )
    throw new Error('Неверный формат сохранения игры.');
  return data.actions.reduce((state: GameState, action: GameAction) => {
    if (!action || typeof action !== 'object') throw new Error('Повреждено действие игры.');
    return play(state, action);
  }, newGame());
}
export function serializeGame(state: GameState) {
  return JSON.stringify({ version: 1, actions: state.actions });
}
