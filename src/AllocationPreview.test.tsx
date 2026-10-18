// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AllocationPreview from './AllocationPreview';
import { createAllocationPlan } from './allocation-plan';
import { places } from './data';

const plan = createAllocationPlan(
  {
    ghosts: [
      {
        id: 'g',
        name: 'Дух',
        anxiety: 1,
        temperature: 10,
        deadline: '2026-10-20',
        conditions: [],
        settledAt: '2026-10-18',
      },
    ],
    places,
    assignments: { g: places[0].id },
    pinned: ['g'],
  },
  '2026-10-18',
);

beforeEach(() => {
  // jsdom lacks the native dialog API. Focus containment/inert need browser QA.
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
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  vi.restoreAllMocks();
});

it('shows both addresses and lock reasons, focuses cancel, and restores focus on close', async () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  const onApply = vi.fn();
  const onCancel = vi.fn();
  const { unmount } = render(
    <AllocationPreview plan={plan} onApply={onApply} onCancel={onCancel} />,
  );
  expect(screen.getByRole('dialog', { name: 'Предпросмотр подбора' })).toBeTruthy();
  expect(screen.getByText('Старый адрес')).toBeTruthy();
  expect(screen.getByText('Новый адрес')).toBeTruthy();
  expect(screen.getByText('🔒 Закреплено вручную')).toBeTruthy();
  expect(screen.getByText(/🔒 Переезд завершён/)).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Отмена' }));
  const user = userEvent.setup();
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Применить план' }));
  await user.keyboard('{Enter}');
  expect(onApply).toHaveBeenCalledOnce();
  expect(onCancel).not.toHaveBeenCalled();
  unmount();
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});

it('disables stale apply and supports cancel button and native Escape cancellation', async () => {
  const onApply = vi.fn();
  const onCancel = vi.fn();
  render(<AllocationPreview plan={plan} stale onApply={onApply} onCancel={onCancel} />);
  expect(screen.getByRole('alert').textContent).toContain('Данные или дата изменились');
  await userEvent.click(screen.getByRole('button', { name: 'Применить план' }));
  expect(onApply).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(onCancel).toHaveBeenCalledOnce();
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }));
  expect(onCancel).toHaveBeenCalledTimes(2);
});
