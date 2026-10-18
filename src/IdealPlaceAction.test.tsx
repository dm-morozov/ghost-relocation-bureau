// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import IdealPlaceAction, { type IdealPlaceActionProps } from './IdealPlaceAction';
import { relocation, type Ghost, type Place } from './domain';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function props(): IdealPlaceActionProps {
  const ghost: Ghost = {
    id: 'request',
    name: 'Тихон',
    anxiety: 5,
    temperature: 10,
    deadline: '2026-10-18',
    conditions: ['quiet'],
  };
  const place: Place = {
    id: 'new-home',
    name: 'Тихий чердак',
    description: '',
    capacity: 1,
    temperature: 10,
    light: 0,
    noise: 0,
    humidity: 70,
    people: false,
    mirrors: false,
    attic: true,
    maxAnxiety: 10,
  };
  return {
    ghost,
    place,
    assignments: {},
    today: '2026-10-18',
    onAssign: vi.fn(),
    onOpenRequest: vi.fn(),
  };
}

it('проверяет при рендере и повторно перед назначением сохранённого дома', () => {
  const input = props();
  const check = vi.spyOn(relocation, 'conflicts');
  render(<IdealPlaceAction {...input} />);
  expect(check).toHaveBeenCalledWith(input.ghost, input.place, input.assignments, input.today);
  const checksBeforeClick = check.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Назначить и вернуться' }));
  expect(check.mock.calls.length).toBeGreaterThan(checksBeforeClick);
  expect(input.onAssign).toHaveBeenCalledExactlyOnceWith('request', 'new-home');
  expect(input.onOpenRequest).not.toHaveBeenCalled();
});

it.each(['capacity', 'conditions', 'deadline', 'settled'] as const)(
  'блокирует %s и сохраняет возврат к исходной заявке',
  (reason) => {
    const input = props();
    if (reason === 'capacity') input.assignments.other = input.place.id;
    if (reason === 'conditions') input.place.noise = 31;
    if (reason === 'deadline') input.today = '2026-10-19';
    if (reason === 'settled') input.ghost.settledAt = input.today;
    render(<IdealPlaceAction {...input} />);
    const assign = screen.getByRole('button', {
      name: 'Назначить и вернуться',
    }) as HTMLButtonElement;
    expect(assign.disabled).toBe(true);
    expect(screen.getByText('Назначение недоступно:')).toBeTruthy();
    fireEvent.click(assign);
    expect(input.onAssign).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Вернуться к заявке' }));
    expect(input.onOpenRequest).toHaveBeenCalledExactlyOnceWith('request');
  },
);

it.each(['capacity', 'conditions', 'settled'] as const)(
  'перепроверяет %s между рендером и нажатием и показывает причину',
  (reason) => {
    const input = props();
    render(<IdealPlaceAction {...input} />);
    if (reason === 'capacity') input.assignments.other = input.place.id;
    if (reason === 'conditions') input.place.noise = 31;
    if (reason === 'settled') input.ghost.settledAt = input.today;
    fireEvent.click(screen.getByRole('button', { name: 'Назначить и вернуться' }));
    expect(input.onAssign).not.toHaveBeenCalled();
    expect(screen.getByText('Назначение недоступно:')).toBeTruthy();
    expect(screen.getByRole('listitem').textContent).toMatch(
      reason === 'capacity'
        ? /Нет свободных мест/
        : reason === 'conditions'
          ? /Нужна тишина/
          : /уже завершено/,
    );
  },
);

it('получает актуальные props и разрешает назначение после освобождения вместимости', () => {
  const input = props();
  const { rerender } = render(
    <IdealPlaceAction {...input} assignments={{ other: input.place.id }} />,
  );
  rerender(<IdealPlaceAction {...input} />);
  expect(screen.queryByText('Назначение недоступно:')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Назначить и вернуться' }));
  expect(input.onAssign).toHaveBeenCalledExactlyOnceWith(input.ghost.id, input.place.id);
});

it('не считает собственное назначение занятым местом', () => {
  const input = props();
  input.assignments[input.ghost.id] = input.place.id;
  render(<IdealPlaceAction {...input} />);
  expect(screen.queryByText('Назначение недоступно:')).toBeNull();
});
