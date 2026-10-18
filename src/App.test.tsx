// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { parseSession, storageKey } from './storage';
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
});
describe('оператор создаёт новые записи', () => {
  it('предзаполняет идеальное место для Эдгара и открывает его заявку из жильцов', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Эдгар Безадресный/ }));
    await user.click(
      screen.getByRole('button', { name: '🪄 Создать идеальное место для Эдгар Безадресный' }),
    );
    expect((screen.getByLabelText('Название') as HTMLInputElement).value).toBe('Оранжерея туманов');
    expect((screen.getByLabelText('Температура, °C') as HTMLInputElement).value).toBe('5');
    expect((screen.getByLabelText('Влажность (0–100)') as HTMLInputElement).value).toBe('85');
    expect((screen.getByLabelText('Шум (0–100)') as HTMLInputElement).value).toBe('15');
    expect((screen.getByLabelText('Освещение (0–100)') as HTMLInputElement).value).toBe('40');
    expect((screen.getByLabelText('Есть чердак') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Есть люди') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Есть зеркала') as HTMLInputElement).checked).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Добавить место' }));
    expect(screen.getAllByText('Пока никто не заселен')).toHaveLength(6);
    await user.click(screen.getByRole('button', { name: /01.*Заявки/ }));
    await user.click(screen.getByRole('button', { name: 'Подобрать места' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Подобрать места' }).getAttribute('aria-busy'),
      ).toBe('false'),
    );
    await user.click(await screen.findByRole('button', { name: 'Применить план' }));
    expect(
      screen.queryByRole('button', { name: '🪄 Создать идеальное место для Эдгар Безадресный' }),
    ).toBeNull();
    await user.click(screen.getByRole('button', { name: /02.*Места/ }));
    const residents = screen.getByRole('region', {
      name: 'Текущие жильцы: Оранжерея туманов',
    });
    await user.click(within(residents).getByRole('button', { name: 'Эдгар Безадресный' }));
    expect(screen.getByRole('heading', { name: 'Эдгар Безадресный' })).toBe(document.activeElement);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('95');
  });
  it('не обещает исправить просрочку новым местом и очищает шаблон обычной формы', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Белла Опоздавшая/ }));
    expect(screen.getByText(/Новый адрес не изменит срок/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /🪄 Создать идеальное место для Белла/ }));
    expect((screen.getByLabelText('Температура, °C') as HTMLInputElement).value).toBe('12');
    expect((screen.getByLabelText('Влажность (0–100)') as HTMLInputElement).value).toBe('45');
    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    await user.click(screen.getByRole('button', { name: '+ Новое место' }));
    expect((screen.getByLabelText('Название') as HTMLInputElement).value).toBe('Оранжерея туманов');
  });
  it('добавляет место и расселяет в нём ранее невозможную заявку', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /02.*Места/ }));
    await user.click(screen.getByRole('button', { name: '+ Новое место' }));
    expect((screen.getByLabelText('Название') as HTMLInputElement).readOnly).toBe(true);
    await user.type(screen.getByLabelText('Описание'), 'Тихое место без людей и зеркал');
    await user.clear(screen.getByLabelText('Влажность (0–100)'));
    await user.type(screen.getByLabelText('Влажность (0–100)'), '80');
    await user.click(screen.getByLabelText('Есть чердак'));
    await user.click(screen.getByRole('button', { name: 'Добавить место' }));
    expect(screen.getByRole('heading', { name: 'Оранжерея туманов' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /01.*Заявки/ }));
    await user.click(screen.getByRole('button', { name: 'Подобрать места' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Подобрать места' }).getAttribute('aria-busy'),
      ).toBe('false'),
    );
    await user.click(await screen.findByRole('button', { name: 'Применить план' }));
    await user.click(screen.getByRole('button', { name: /Эдгар Безадресный/ }));
    expect(screen.getByRole('heading', { name: 'Оранжерея туманов' })).toBeTruthy();
    const saved = parseSession(localStorage.getItem(storageKey)!);
    const place = saved.places.find((p) => p.name === 'Оранжерея туманов')!;
    expect(saved.assignments.g5).toBe(place.id);
    cleanup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /02.*Места/ }));
    expect(screen.getByRole('heading', { name: 'Оранжерея туманов' })).toBeTruthy();
  });
  it('показывает десять портретов и сохраняет выбор новой заявки', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '+ Новая заявка' }));
    await user.type(screen.getByLabelText('Имя', { exact: true }), 'Новый дух');
    const portraits = screen.getByRole('group', { name: 'Портрет привидения' });
    expect(within(portraits).getAllByRole('radio')).toHaveLength(10);
    await user.click(within(portraits).getAllByRole('radio')[9]);
    await user.click(screen.getByRole('button', { name: 'Добавить заявку' }));
    const saved = parseSession(localStorage.getItem(storageKey)!);
    expect(saved.ghosts.find((g) => g.name === 'Новый дух')?.portrait).toBe(9);
    expect(screen.getByAltText('Портрет: Новый дух').getAttribute('src')).toContain('ghost-10.png');
    expect(screen.queryByText(/Учебный проект для MOX/)).toBeNull();
  });
});

describe('оператор управляет своей заявкой', () => {
  it('закрепляет ручной выбор, сохраняет его после подбора и перезагрузки, снимает замочек', async () => {
    const user = userEvent.setup();
    const view = render(<App />);
    await user.selectOptions(screen.getByLabelText('Изменить место вручную'), 'castle');
    await user.click(screen.getByRole('button', { name: 'Применить выбор' }));
    expect(
      screen.getByRole('button', { name: '🔒 Закреплено вручную' }).getAttribute('aria-pressed'),
    ).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Подобрать места' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Подобрать места' }).getAttribute('aria-busy'),
      ).toBe('false'),
    );
    await user.click(await screen.findByRole('button', { name: 'Применить план' }));
    let saved = parseSession(localStorage.getItem(storageKey)!);
    expect(saved.assignments.g1).toBe('castle');
    expect(saved.pinned).toEqual(['g1']);
    view.unmount();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '🔒 Закреплено вручную' }));
    expect(
      screen.getByRole('button', { name: '🔓 Закрепить назначение' }).getAttribute('aria-pressed'),
    ).toBe('false');
    saved = parseSession(localStorage.getItem(storageKey)!);
    expect(saved.pinned).toEqual([]);
    expect(saved.assignments.g1).toBe('castle');
  });
  it('редактирует параметры, сохраняет закрепление и показывает новый конфликт', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText('Изменить место вручную'), 'castle');
    await user.click(screen.getByRole('button', { name: 'Применить выбор' }));
    await user.click(screen.getByRole('button', { name: 'Редактировать заявку' }));
    const form = screen.getByRole('form', { name: 'Редактирование заявки' });
    await user.clear(within(form).getByLabelText('Имя'));
    await user.type(within(form).getByLabelText('Имя'), 'Анна Обновлённая');
    await user.clear(within(form).getByLabelText('Тревожность (1–10)'));
    await user.type(within(form).getByLabelText('Тревожность (1–10)'), '10');
    await user.click(within(form).getByLabelText('Любит сырость'));
    await user.click(within(form).getByRole('button', { name: 'Сохранить изменения' }));
    expect(screen.getByRole('heading', { name: 'Анна Обновлённая' })).toBeTruthy();
    expect(within(screen.getByLabelText('Карточка заявки')).getByText('Конфликт')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Подобрать места' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Подобрать места' }).getAttribute('aria-busy'),
      ).toBe('false'),
    );
    await user.click(await screen.findByRole('button', { name: 'Применить план' }));
    const saved = parseSession(localStorage.getItem(storageKey)!);
    expect(saved.ghosts[0].anxiety).toBe(10);
    expect(saved.assignments.g1).toBe('castle');
    expect(saved.pinned).toEqual(['g1']);
  });
  it('отменяет правки и удаление, затем удаляет последнюю заявку с назначением и замочком', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    const session = parseSession(localStorage.getItem(storageKey)!);
    cleanup();
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...session,
        ghosts: [session.ghosts[0]],
        assignments: { g1: 'castle' },
        pinned: ['g1'],
      }),
    );
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Редактировать заявку' }));
    await user.clear(screen.getByLabelText('Имя'));
    await user.type(screen.getByLabelText('Имя'), 'Не сохранять');
    await user.click(
      within(screen.getByRole('form', { name: 'Редактирование заявки' })).getByRole('button', {
        name: 'Отмена',
      }),
    );
    expect(screen.queryByRole('heading', { name: 'Не сохранять' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Удалить заявку' }));
    await user.click(
      within(screen.getByRole('region', { name: 'Подтверждение удаления' })).getByRole('button', {
        name: 'Отмена',
      }),
    );
    expect(parseSession(localStorage.getItem(storageKey)!).ghosts).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Удалить заявку' }));
    await user.click(screen.getByRole('button', { name: 'Да, удалить заявку' }));
    const saved = parseSession(localStorage.getItem(storageKey)!);
    expect(saved.ghosts).toEqual([]);
    expect(saved.assignments).toEqual({});
    expect(saved.pinned).toEqual([]);
    expect(screen.getByRole('heading', { name: 'Выберите заявку' })).toBeTruthy();
  });
});
