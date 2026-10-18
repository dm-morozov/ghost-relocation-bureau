// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import ShiftGame from './ShiftGame';
import { storageKey, parseSession } from './storage';
import { gameStorageKey, newGame, play, serializeGame } from './game';

const saved = () => parseSession(localStorage.getItem(storageKey)!);
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('cancels preview without changing assignments or erasing the preceding undo', async () => {
  const user = userEvent.setup();
  render(<App />);
  const initial = saved();
  await user.click(screen.getByRole('button', { name: '+7 дней к сроку' }));
  const extended = saved();
  await user.click(screen.getByRole('button', { name: 'Подобрать места' }));
  const dialog = await screen.findByRole('dialog', { name: 'Предпросмотр подбора' });
  expect(saved()).toEqual(extended);
  await user.click(within(dialog).getByRole('button', { name: 'Отмена' }));
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Подобрать места' }));
  await user.click(screen.getByRole('button', { name: 'Отменить последнее действие' }));
  expect(saved()).toEqual(initial);
});

it('rejects a plan across midnight even before the calendar refresh interval', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T12:00:00'));
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Подобрать места' }));
  await screen.findByRole('dialog', { name: 'Предпросмотр подбора' });
  vi.setSystemTime(new Date('2026-10-19T12:00:00'));
  await user.click(screen.getByRole('button', { name: 'Применить план' }));
  expect(saved().assignments).toEqual({});
  expect(screen.getByText('Данные или дата изменились. Запустите подбор повторно.')).toBeTruthy();
});

it('detects a foreign write without a storage event and loads it only explicitly', async () => {
  const user = userEvent.setup();
  render(<App />);
  const foreign = saved();
  foreign.ghosts[0].name = 'Из другой вкладки';
  const raw = JSON.stringify(foreign);
  localStorage.setItem(storageKey, raw);
  await user.click(screen.getByRole('button', { name: '+7 дней к сроку' }));
  expect(localStorage.getItem(storageKey)).toBe(raw);
  expect(
    screen.getByText('Сохранение изменилось в другой вкладке. Текущая работа остаётся здесь.'),
  ).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Загрузить свежую версию' }));
  expect(screen.getByRole('heading', { name: 'Из другой вкладки' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Отменить последнее действие' })).toBeNull();
  expect(saved()).toEqual(foreign);
});

it('keeps invalid foreign data intact and rejects applying an older preview', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Подобрать места' }));
  await screen.findByRole('dialog', { name: 'Предпросмотр подбора' });
  localStorage.setItem(storageKey, '{foreign damaged');
  await user.click(screen.getByRole('button', { name: 'Применить план' }));
  expect(localStorage.getItem(storageKey)).toBe('{foreign damaged');
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Отмена' }));
  await user.click(screen.getByRole('button', { name: 'Загрузить свежую версию' }));
  expect(
    screen.getByText(
      'Сохранённая версия повреждена или имеет неизвестный формат. Она оставлена без изменений.',
    ),
  ).toBeTruthy();
  expect(localStorage.getItem(storageKey)).toBe('{foreign damaged');
});

it('assigns exactly the created ideal home with a pin and undoes assignment while retaining the home', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: /Эдгар Безадресный/ }));
  await user.click(
    screen.getByRole('button', { name: '🪄 Создать идеальное место для Эдгар Безадресный' }),
  );
  await user.click(screen.getByRole('button', { name: 'Добавить место' }));
  const home = saved().places.find((p) => p.name === 'Оранжерея туманов')!;
  await user.click(screen.getByRole('button', { name: 'Назначить и вернуться' }));
  expect(saved().assignments.g5).toBe(home.id);
  expect(saved().pinned).toContain('g5');
  expect(screen.getByRole('heading', { name: 'Эдгар Безадресный' })).toBeTruthy();
  expect((screen.getByLabelText('Изменить место вручную') as HTMLSelectElement).value).toBe(
    home.id,
  );
  await user.click(screen.getByRole('button', { name: 'Отменить последнее действие' }));
  expect(saved().assignments.g5).toBeUndefined();
  expect(saved().pinned).not.toContain('g5');
  expect(saved().places.some((p) => p.id === home.id)).toBe(true);
});

it('protects game storage independently and discards a stale turn preview on fresh load', async () => {
  const user = userEvent.setup();
  render(<ShiftGame />);
  await user.click(screen.getByRole('button', { name: 'Прогноз завершения смены' }));
  const foreign = play(newGame(), { type: 'upgrade', placeId: 'castle', upgrade: 'quiet' });
  const raw = serializeGame(foreign);
  localStorage.setItem(gameStorageKey, raw);
  act(() =>
    window.dispatchEvent(new StorageEvent('storage', { key: gameStorageKey, newValue: raw })),
  );
  await user.click(screen.getByRole('button', { name: 'Подтвердить и завершить смену' }));
  expect(localStorage.getItem(gameStorageKey)).toBe(raw);
  await user.click(screen.getByRole('button', { name: 'Загрузить свежую версию' }));
  expect(screen.queryByRole('region', { name: 'Последствия завершения смены' })).toBeNull();
  expect(localStorage.getItem(gameStorageKey)).toBe(raw);
});

it('does not let confirmed damaged-session replacement bypass a newer foreign version', async () => {
  localStorage.setItem(storageKey, '{initial damaged');
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Начать новую сессию' }));
  const foreign = JSON.stringify({ ghosts: [], places: [], assignments: {}, pinned: [] });
  localStorage.setItem(storageKey, foreign);
  await user.click(screen.getByRole('button', { name: 'Да, разрешить замену' }));
  expect(localStorage.getItem(storageKey)).toBe(foreign);
  expect(screen.getByText('Автосохранение временно приостановлено')).toBeTruthy();
});

it('restores forecast focus and celebrates an attainable campaign maximum', async () => {
  const user = userEvent.setup();
  const first = render(<ShiftGame />);
  const trigger = screen.getByRole('button', { name: 'Прогноз завершения смены' });
  await user.click(trigger);
  expect(document.activeElement).toBe(
    screen.getByRole('heading', { name: 'Проверьте последствия' }),
  );
  await user.click(screen.getByRole('button', { name: 'Вернуться к решениям' }));
  expect(document.activeElement).toBe(trigger);
  first.unmount();
  let campaign = newGame();
  for (const [placeId, upgrade] of [
    ['castle', 'quiet'],
    ['library', 'dark'],
    ['manor', 'damp'],
  ] as const) {
    campaign = play(campaign, { type: 'upgrade', placeId, upgrade });
    campaign = play(campaign, { type: 'advise' });
    campaign = play(campaign, { type: 'advance' });
  }
  localStorage.setItem(gameStorageKey, serializeGame(campaign));
  render(<ShiftGame />);
  expect(
    screen.getByText('Достигнут лучший результат этой кампании. Все шесть жильцов нашли дом.'),
  ).toBeTruthy();
  expect(screen.queryByText(/Попробуйте другую комбинацию/)).toBeNull();
  expect(screen.queryByText(/из 600/)).toBeNull();
});
