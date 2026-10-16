// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { parseSession, storageKey } from './storage';
beforeEach(() => localStorage.clear());
afterEach(cleanup);
describe('оператор создаёт новые записи', () => {
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
