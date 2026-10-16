// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { parseSession, storageKey } from './storage';
beforeEach(() => localStorage.clear());
afterEach(cleanup);
describe('оператор создаёт новые записи', () => {
  it('предзаполняет идеальное место для Эдгара и открывает его заявку из жильцов', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Эдгар Безадресный/ }));
    await user.click(
      screen.getByRole('button', { name: '🪄 Создать идеальное место для Эдгар Безадресный' }),
    );
    expect((screen.getByLabelText('Название') as HTMLInputElement).value).toBe(
      'Убежище для Эдгар Безадресный',
    );
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
    expect(
      screen.queryByRole('button', { name: '🪄 Создать идеальное место для Эдгар Безадресный' }),
    ).toBeNull();
    await user.click(screen.getByRole('button', { name: /02.*Места/ }));
    const residents = screen.getByRole('region', {
      name: 'Текущие жильцы: Убежище для Эдгар Безадресный',
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
    expect((screen.getByLabelText('Название') as HTMLInputElement).value).toBe('');
  });
  it('добавляет место и расселяет в нём ранее невозможную заявку', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /02.*Места/ }));
    await user.click(screen.getByRole('button', { name: '+ Новое место' }));
    await user.type(screen.getByLabelText('Название'), 'Сырой чердак');
    await user.type(screen.getByLabelText('Описание'), 'Тихое место без людей и зеркал');
    await user.clear(screen.getByLabelText('Влажность (0–100)'));
    await user.type(screen.getByLabelText('Влажность (0–100)'), '80');
    await user.click(screen.getByLabelText('Есть чердак'));
    await user.click(screen.getByRole('button', { name: 'Добавить место' }));
    expect(screen.getByRole('heading', { name: 'Сырой чердак' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /01.*Заявки/ }));
    await user.click(screen.getByRole('button', { name: 'Подобрать места' }));
    await user.click(screen.getByRole('button', { name: /Эдгар Безадресный/ }));
    expect(screen.getByRole('heading', { name: 'Сырой чердак' })).toBeTruthy();
    const saved = parseSession(localStorage.getItem(storageKey)!);
    const place = saved.places.find((p) => p.name === 'Сырой чердак')!;
    expect(saved.assignments.g5).toBe(place.id);
    cleanup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /02.*Места/ }));
    expect(screen.getByRole('heading', { name: 'Сырой чердак' })).toBeTruthy();
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
