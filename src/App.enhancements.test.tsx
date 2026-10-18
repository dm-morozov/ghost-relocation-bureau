// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { addDays, relocation, todayISO } from './domain';
import { demoGhosts, places } from './data';
import { parseSession, storageKey } from './storage';

const saved = () => parseSession(localStorage.getItem(storageKey)!);
beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete document.documentElement.dataset.theme;
});

describe('завершённые сценарии оператора', () => {
  it('переключает ночную тему и восстанавливает её после перезагрузки', async () => {
    const user = userEvent.setup();
    const view = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Ночная смена' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('quiet-address-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Дневной архив' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    view.unmount();
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe('dark');
    await user.click(screen.getByRole('button', { name: 'Дневной архив' }));
    expect(localStorage.getItem('quiet-address-theme')).toBe('light');
  });
  it('продлевает срочный дедлайн на семь дней, сохраняет изменение и позволяет отменить', async () => {
    const user = userEvent.setup();
    render(<App />);
    const before = saved();
    expect(before.ghosts[0].deadline).toBe(addDays(todayISO(), 1));
    await user.click(screen.getByRole('button', { name: '+7 дней к сроку' }));
    expect(saved().ghosts[0].deadline).toBe(addDays(before.ghosts[0].deadline, 7));
    expect(within(screen.getByLabelText('Карточка заявки')).queryByText(/🔥 Срочно/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Отменить последнее действие' }));
    expect(saved().ghosts[0].deadline).toBe(before.ghosts[0].deadline);
  });
  it('обозначает сверку занятостью и применяет точный результат алгоритма после ожидания', async () => {
    const user = userEvent.setup();
    render(<App />);
    const before = saved();
    const expected = relocation.allocate(before.ghosts, before.places, todayISO());
    await user.click(screen.getByRole('button', { name: 'Подобрать места' }));
    const busy = screen.getByRole('button', { name: /Сверка условий и аур/ });
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect(saved().assignments).toEqual({});
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Подобрать места' }).getAttribute('aria-busy'),
      ).toBe('false'),
    );
    expect(saved().assignments).toEqual(expected);
    expect(screen.getByText(/Подбор завершён/)).toBeTruthy();
  });
  it('отменяет загрузку демосценария, затем очищает только с подтверждением и восстанавливает', async () => {
    const user = userEvent.setup();
    render(<App />);
    const before = saved();
    await user.click(screen.getByRole('button', { name: 'Пустой список' }));
    await user.click(
      within(screen.getByRole('region', { name: 'Подтверждение демосценария' })).getByRole(
        'button',
        { name: 'Отмена' },
      ),
    );
    expect(saved()).toEqual(before);
    await user.click(screen.getByRole('button', { name: 'Пустой список' }));
    await user.click(screen.getByRole('button', { name: 'Загрузить сценарий' }));
    expect(saved().ghosts).toEqual([]);
    expect(saved().places).toEqual(before.places);
    await user.click(screen.getByRole('button', { name: 'Отменить последнее действие' }));
    expect(saved()).toEqual(before);
  });
  it('редактирует срок в единственной форме и отменяет черновик без изменения записи', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    const before = saved();
    await user.click(screen.getByRole('button', { name: 'Редактировать заявку' }));
    const form = screen.getByRole('form', { name: 'Редактирование заявки' });
    expect(form.querySelectorAll('input[type="date"]')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '+7 дней к сроку' })).toBeNull();
    await user.clear(within(form).getByLabelText('Имя'));
    await user.type(within(form).getByLabelText('Имя'), 'Черновик');
    await user.click(within(form).getByRole('button', { name: 'Отмена' }));
    expect(saved()).toEqual(before);
    expect(screen.queryByRole('form', { name: 'Редактирование заявки' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /02.*Места/ }));
    expect(confirm).not.toHaveBeenCalled();
  });
  it('сохраняет повреждённую запись до явно подтверждённого начала новой сессии', async () => {
    const user = userEvent.setup();
    const original = '{непрочитанная сессия';
    localStorage.setItem(storageKey, original);
    render(<App />);
    expect(screen.getByText('Автосохранение временно приостановлено')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '+7 дней к сроку' }));
    expect(localStorage.getItem(storageKey)).toBe(original);
    await user.click(screen.getByRole('button', { name: 'Начать новую сессию' }));
    expect(localStorage.getItem(storageKey)).toBe(original);
    await user.click(screen.getByRole('button', { name: 'Да, разрешить замену' }));
    expect(saved().ghosts).toHaveLength(6);
    expect(screen.queryByText('Автосохранение временно приостановлено')).toBeNull();
  });
  it('редактирует место и безопасно удаляет его вместе с назначениями, а отмена возвращает жильца', async () => {
    const user = userEvent.setup();
    const ghosts = demoGhosts(todayISO());
    ghosts[0] = { ...ghosts[0], settledAt: todayISO() };
    localStorage.setItem(
      storageKey,
      JSON.stringify({ ghosts, places, assignments: { g1: 'castle' }, pinned: ['g1'] }),
    );
    render(<App />);
    await user.click(screen.getByRole('button', { name: /02.*Места/ }));
    const castle = screen.getByRole('heading', { name: 'Замок на холме' }).closest('article')!;
    await user.click(within(castle).getByRole('button', { name: 'Изменить место' }));
    await user.clear(screen.getByLabelText('Вместимость'));
    await user.type(screen.getByLabelText('Вместимость'), '3');
    await user.clear(screen.getByLabelText('Влажность (0–100)'));
    await user.type(screen.getByLabelText('Влажность (0–100)'), '85');
    await user.click(screen.getByRole('button', { name: 'Сохранить место' }));
    expect(saved().places.find((p) => p.id === 'castle')).toMatchObject({
      capacity: 3,
      humidity: 85,
    });
    const beforeDeletion = saved();
    await user.click(within(castle).getByRole('button', { name: 'Удалить место' }));
    expect(
      screen.getByRole('region', { name: 'Подтверждение удаления места' }).textContent,
    ).toContain('Назначений будет снято: 1');
    await user.click(screen.getByRole('button', { name: 'Да, удалить место' }));
    expect(saved().assignments).toEqual({});
    expect(saved().pinned).toEqual([]);
    expect(saved().ghosts[0].settledAt).toBeUndefined();
    expect(saved().places.some((p) => p.id === 'castle')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Отменить последнее действие' }));
    expect(saved()).toEqual(beforeDeletion);
  });
});
