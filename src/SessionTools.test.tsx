// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionTools from './SessionTools';
import { makeBackup, recoveryKey } from './backup';
import { storageKey, type Session } from './storage';

const session: Session = { ghosts: [], places: [], assignments: {}, pinned: [] };
const original = '{повреждённые исходные данные';
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(storageKey, original);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('сохраняет исходник до разрешения автозаписи и оставляет его доступным для скачивания', async () => {
  const user = userEvent.setup();
  const onResume = vi.fn(() => {
    expect(localStorage.getItem(recoveryKey)).toBe(original);
    localStorage.setItem(storageKey, JSON.stringify(session));
  });
  const view = render(
    <SessionTools
      session={session}
      blocked
      original={original}
      onResume={onResume}
      onRestore={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Начать новую сессию' }));
  await user.click(screen.getByRole('button', { name: 'Да, разрешить замену' }));
  expect(onResume).toHaveBeenCalledOnce();
  view.rerender(
    <SessionTools
      session={session}
      blocked={false}
      original={original}
      onResume={onResume}
      onRestore={vi.fn()}
    />,
  );
  expect(screen.getByRole('button', { name: 'Скачать сохранённый исходник' })).toBeTruthy();
  expect(localStorage.getItem(recoveryKey)).toBe(original);
});

it('отменяет замену при переполненном хранилище, сохраняя исходник', async () => {
  const user = userEvent.setup();
  const onResume = vi.fn();
  render(
    <SessionTools
      session={session}
      blocked
      original={original}
      onResume={onResume}
      onRestore={vi.fn()}
    />,
  );
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  await user.click(screen.getByRole('button', { name: 'Начать новую сессию' }));
  await user.click(screen.getByRole('button', { name: 'Да, разрешить замену' }));
  expect(onResume).not.toHaveBeenCalled();
  expect(localStorage.getItem(storageKey)).toBe(original);
  expect(screen.getByRole('alert').textContent).toContain('Замена отменена');
});

it('сохраняет повреждённый исходник перед восстановлением из файла', async () => {
  const user = userEvent.setup();
  const onRestore = vi.fn(() => {
    expect(localStorage.getItem(recoveryKey)).toBe(original);
  });
  render(
    <SessionTools
      session={session}
      blocked
      original={original}
      onResume={vi.fn()}
      onRestore={onRestore}
    />,
  );
  const file = new File([makeBackup(session)], 'backup.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => makeBackup(session) });
  await user.upload(screen.getByLabelText('Восстановить из файла'), file);
  await user.click(screen.getByRole('button', { name: 'Восстановить сессию' }));
  expect(onRestore).toHaveBeenCalledWith(session);
});

it('не разрешает замену при недоступном чтении хранилища', async () => {
  const user = userEvent.setup();
  const onResume = vi.fn();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('denied');
  });
  render(
    <SessionTools
      session={session}
      blocked
      original={null}
      onResume={onResume}
      onRestore={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Начать новую сессию' }));
  await user.click(screen.getByRole('button', { name: 'Да, разрешить замену' }));
  expect(onResume).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('Замена отменена');
});
