// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShiftGame from './ShiftGame';
import { gameStorageKey, newGame, parseGame, play, serializeGame } from './game';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('интерфейс смены', () => {
  it('объясняет шкалы и показывает эффект всех улучшений до расхода жетона', () => {
    render(<ShiftGame />);
    const castle = within(screen.getByRole('article', { name: 'Замок на холме' }));
    expect(castle.getByText('10 °C')).toBeTruthy();
    expect(castle.getByText('50/100 · шумно')).toBeTruthy();
    expect(castle.getByText('60/100 · светло')).toBeTruthy();
    expect(castle.getByText('40/100 · сухо')).toBeTruthy();
    expect(screen.getByText(/тишина — шум ≤ 30\/100; темнота — свет ≤ 30\/100/)).toBeTruthy();
    expect(
      castle.getByRole('button', {
        name: /Шумоизоляция Шум: 50\/100 → 10\/100 · условие тишины будет выполнено Установить · 1 жетон/,
      }),
    ).toBeTruthy();
    expect(
      castle.getByRole('button', {
        name: /Шторы Свет: 60\/100 → 10\/100 · условие темноты будет выполнено/,
      }),
    ).toBeTruthy();
    expect(
      castle.getByRole('button', {
        name: /Увлажнение Влажность: 40\/100 → 85\/100 · условие сырости будет выполнено/,
      }),
    ).toBeTruthy();
    const saved = parseGame(localStorage.getItem(gameStorageKey)!);
    expect(saved.tokens).toBe(3);
    expect(saved.actions).toHaveLength(0);
  });

  it('устанавливает улучшение с клавиатуры и сразу обновляет характеристику и статус', async () => {
    const user = userEvent.setup();
    render(<ShiftGame />);
    const castle = within(screen.getByRole('article', { name: 'Замок на холме' }));
    const button = castle.getByRole('button', { name: /Шумоизоляция/ });
    button.focus();
    await user.keyboard('{Enter}');
    expect(castle.getByText('10/100 · тихо')).toBeTruthy();
    expect(
      castle
        .getByRole('button', {
          name: /Шумоизоляция Шум: 10\/100 · условие тишины выполнено Установлено/,
        })
        .hasAttribute('disabled'),
    ).toBe(true);
    const saved = parseGame(localStorage.getItem(gameStorageKey)!);
    expect(saved.tokens).toBe(2);
    expect(saved.actions).toEqual([{ type: 'upgrade', placeId: 'castle', upgrade: 'quiet' }]);
    expect(castle.getByText('60/100 · светло')).toBeTruthy();
    expect(castle.getByText('40/100 · сухо')).toBeTruthy();
  });

  it('различает установленное улучшение и нехватку жетонов, сохраняя предпросмотр', async () => {
    const user = userEvent.setup();
    let state = newGame();
    for (const place of state.places) {
      state = play(state, { type: 'upgrade', placeId: place.id, upgrade: 'quiet' });
    }
    localStorage.setItem(gameStorageKey, serializeGame(state));
    render(<ShiftGame />);
    const castle = within(screen.getByRole('article', { name: 'Замок на холме' }));
    expect(
      castle.getByRole('button', { name: /Шумоизоляция.*Установлено/ }).hasAttribute('disabled'),
    ).toBe(true);
    const curtains = castle.getByRole('button', {
      name: /Шторы Свет: 60\/100 → 10\/100.*Недостаточно жетонов · нужно 1/,
    });
    expect(curtains.hasAttribute('disabled')).toBe(true);
    await user.click(curtains);
    expect(parseGame(localStorage.getItem(gameStorageKey)!).actions).toHaveLength(3);
  });

  it('считает пустую строку повреждённым сохранением и не перезаписывает её', () => {
    localStorage.setItem(gameStorageKey, '');
    render(<ShiftGame />);
    expect(screen.getByRole('alert').textContent).toContain('сохранено без изменений');
    expect(localStorage.getItem(gameStorageKey)).toBe('');
    expect(screen.queryByRole('button', { name: 'Советник: подобрать адреса' })).toBeNull();
  });

  it('показывает прогноз перед завершением и восстанавливает ход после перезагрузки', async () => {
    const user = userEvent.setup();
    const view = render(<ShiftGame />);
    await user.click(screen.getAllByRole('button', { name: /Шумоизоляция/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Советник: подобрать адреса' }));
    await user.click(screen.getByRole('button', { name: 'Прогноз завершения смены' }));
    expect(screen.getByRole('region', { name: 'Последствия завершения смены' })).toBeTruthy();
    expect(parseGame(localStorage.getItem(gameStorageKey)!).turn).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Подтвердить и завершить смену' }));
    expect(parseGame(localStorage.getItem(gameStorageKey)!).outcomes).toHaveLength(2);
    view.unmount();
    render(<ShiftGame />);
    expect(screen.getByLabelText('Адрес для Вера Сумеречная')).toBeTruthy();
    expect(screen.queryByLabelText('Адрес для Нора Шёпот')).toBeNull();
  });

  it('не перезаписывает повреждённый прогресс и требует явного подтверждения новой игры', async () => {
    const user = userEvent.setup();
    localStorage.setItem(gameStorageKey, 'broken-game');
    localStorage.setItem('quiet-address-v1', 'sandbox-data');
    render(<ShiftGame />);
    expect(screen.getByRole('alert').textContent).toContain('сохранено без изменений');
    expect(localStorage.getItem(gameStorageKey)).toBe('broken-game');
    expect(screen.queryByRole('button', { name: 'Советник: подобрать адреса' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Начать новую игру вместо повреждённой' }));
    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(localStorage.getItem(gameStorageKey)).toBe('broken-game');
    await user.click(screen.getByRole('button', { name: 'Начать новую игру вместо повреждённой' }));
    await user.click(screen.getByRole('button', { name: 'Да, начать новую игру' }));
    expect(parseGame(localStorage.getItem(gameStorageKey)!).turn).toBe(1);
    expect(localStorage.getItem('quiet-address-v1')).toBe('sandbox-data');
  });
});
