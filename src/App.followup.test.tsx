// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { parseSession, storageKey } from './storage';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('keeps a new request draft when navigation or closing is declined, including unload', async () => {
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<App />);
  await user.click(screen.getByRole('button', { name: '+ Новая заявка' }));
  const form = screen.getByRole('form', { name: 'Новая заявка' });
  await user.type(within(form).getByLabelText('Имя'), 'Черновик');
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  await user.click(screen.getByRole('button', { name: /02.*Места/ }));
  await user.click(screen.getByRole('button', { name: 'Закрыть форму' }));
  expect(confirm).toHaveBeenCalledTimes(2);
  expect((within(form).getByLabelText('Имя') as HTMLInputElement).value).toBe('Черновик');
  confirm.mockReturnValue(true);
  await user.click(screen.getByRole('button', { name: 'Закрыть форму' }));
  expect(screen.queryByRole('form', { name: 'Новая заявка' })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '+ Новая заявка' }));
  const cleanUnload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(cleanUnload);
  expect(cleanUnload.defaultPrevented).toBe(false);
});

it('filters assigned requests and leaves query and detail intact when a metric transition is declined', async () => {
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Назначено' }));
  expect((screen.getByLabelText('Фильтр заявок') as HTMLSelectElement).value).toBe('assigned');
  await user.click(screen.getByRole('button', { name: 'Всего заявок' }));
  await user.type(screen.getByLabelText('Поиск по имени'), 'Оскар');
  await user.click(screen.getByRole('button', { name: 'Редактировать заявку' }));
  const form = screen.getByRole('form', { name: 'Редактирование заявки' });
  await user.type(within(form).getByLabelText('Имя'), ' тест');
  const workspace = form.closest('.workspace');
  const beforeClass = workspace?.className;
  await user.click(screen.getByRole('button', { name: 'Без места' }));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect((screen.getByLabelText('Поиск по имени') as HTMLInputElement).value).toBe('Оскар');
  expect((screen.getByLabelText('Фильтр заявок') as HTMLSelectElement).value).toBe('all');
  expect(workspace?.className).toBe(beforeClass);
  expect(screen.getByRole('form', { name: 'Редактирование заявки' })).toBe(form);
});

it('guards a place draft against another edit, cancellation and tab changes', async () => {
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<App />);
  await user.click(screen.getByRole('button', { name: /02.*Места/ }));
  await user.click(screen.getAllByRole('button', { name: 'Изменить место' })[0]);
  const form = screen.getByRole('form', { name: 'Редактирование места' });
  await user.type(within(form).getByLabelText('Описание'), ' черновик');
  const draft = (within(form).getByLabelText('Описание') as HTMLInputElement).value;
  await user.click(screen.getAllByRole('button', { name: 'Изменить место' })[1]);
  await user.click(within(form).getByRole('button', { name: 'Отмена' }));
  await user.click(screen.getByRole('button', { name: /01.*Заявки/ }));
  expect(confirm).toHaveBeenCalledTimes(3);
  expect((within(form).getByLabelText('Описание') as HTMLInputElement).value).toBe(draft);
  await user.click(within(form).getByRole('button', { name: 'Сохранить место' }));
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '+ Новое место' }));
  expect(parseSession(localStorage.getItem(storageKey)!).places[0].description).toBe(draft);
});

it('protects a new place draft on close and unload', async () => {
  const user = userEvent.setup();
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<App />);
  await user.click(screen.getByRole('button', { name: /02.*Места/ }));
  await user.click(screen.getByRole('button', { name: '+ Новое место' }));
  const form = screen.getByRole('form', { name: 'Новое место' });
  fireEvent.change(within(form).getByLabelText('Описание'), { target: { value: 'Мой дом' } });
  await user.click(screen.getByRole('button', { name: 'Закрыть форму' }));
  expect(screen.getByRole('form', { name: 'Новое место' })).toBe(form);
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
});

it('returns keyboard focus to the selected request after going back to the list', async () => {
  const user = userEvent.setup();
  render(<App />);
  const request = document.querySelector<HTMLButtonElement>('.request')!;
  await user.click(request);
  await user.click(screen.getByRole('button', { name: '← Все заявки' }));
  expect(document.activeElement).toBe(request);
});
