// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShiftGame from './ShiftGame';
import { gameStorageKey, parseGame } from './game';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('интерфейс смены', () => {
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
