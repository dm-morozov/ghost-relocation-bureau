import { expect, it } from 'vitest';
import {
  createAllocationPlan,
  applyAllocationPlan,
  isAllocationPlanCurrent,
} from './allocation-plan';
import type { Session } from './storage';
import type { Ghost, Place } from './domain';

const today = '2026-10-18';
const ghost = (id: string, extra: Partial<Ghost> = {}): Ghost => ({
  id,
  name: id,
  anxiety: 1,
  temperature: 10,
  deadline: '2026-10-20',
  conditions: [],
  ...extra,
});
const place = (id: string, extra: Partial<Place> = {}): Place => ({
  id,
  name: id,
  description: '',
  capacity: 1,
  temperature: 10,
  noise: 0,
  light: 0,
  humidity: 70,
  people: false,
  mirrors: false,
  attic: true,
  maxAnxiety: 10,
  ...extra,
});
const session = (): Session => ({
  ghosts: [ghost('pinned'), ghost('settled', { settledAt: today }), ghost('new')],
  places: [place('full', { capacity: 2 }), place('free')],
  assignments: { pinned: 'full', settled: 'full' },
  pinned: ['pinned'],
});

it('reserves pinned and settled residents and their capacity without mutating the session', () => {
  const original = session();
  const before = structuredClone(original);
  const plan = createAllocationPlan(original, today);
  expect(original).toEqual(before);
  expect(plan.assignments).toEqual({ pinned: 'full', settled: 'full', new: 'free' });
  expect(plan.counts).toMatchObject({ fixed: 2, preserved: 2, added: 1, conflicts: 0 });
  const applied = applyAllocationPlan(plan, original, today)!;
  expect(applied.ghosts[1].settledAt).toBe(today);
  expect(applied.places).toEqual(original.places);
  applied.assignments.new = 'full';
  expect(plan.assignments.new).toBe('free');
  expect(original.assignments.new).toBeUndefined();
});

it('keeps an explicitly pinned conflict and does not overfill its remaining capacity', () => {
  const original = session();
  original.places = [place('full', { capacity: 1, maxAnxiety: 1 })];
  original.ghosts[0].anxiety = 10;
  const plan = createAllocationPlan(original, today);
  expect(plan.assignments).toEqual(original.assignments);
  expect(plan.counts.unassigned).toBe(1);
  expect(plan.counts.conflicts).toBe(2);
  expect(plan.rows[0].pinned).toBe(true);
});

it('distinguishes moved, removed, preserved and still unassigned requests', () => {
  const original: Session = {
    ghosts: [
      ghost('move'),
      ghost('remove', { deadline: '2026-10-17' }),
      ghost('stay'),
      ghost('none', { deadline: '2026-10-17' }),
    ],
    places: [place('old', { temperature: 40 }), place('new'), place('fixed')],
    assignments: { move: 'old', remove: 'old', stay: 'fixed' },
    pinned: ['stay'],
  };
  const plan = createAllocationPlan(original, today);
  expect(plan.rows.map((row) => row.change)).toEqual([
    'moved',
    'removed',
    'preserved',
    'unassigned',
  ]);
  expect(plan.rows[0]).toMatchObject({ previousAddress: 'old', nextAddress: 'new' });
  expect(plan.rows[1].nextAddress).toBe('Без места');
});

it.each(['ghosts', 'places', 'assignments', 'pinned', 'today'] as const)(
  'rejects a stale %s snapshot at apply',
  (field) => {
    const original = session();
    const plan = createAllocationPlan(original, today);
    let currentDay = today;
    if (field === 'ghosts') original.ghosts[0].name = 'Changed';
    if (field === 'places') original.places[0].capacity++;
    if (field === 'assignments') original.assignments.new = 'free';
    if (field === 'pinned') original.pinned = [];
    if (field === 'today') currentDay = '2026-10-19';
    expect(isAllocationPlanCurrent(plan, original, currentDay)).toBe(false);
    expect(applyAllocationPlan(plan, original, currentDay)).toBeNull();
  },
);

it('supports empty sessions and legacy sessions without pinned', () => {
  const original: Session = { ghosts: [], places: [], assignments: {} };
  const plan = createAllocationPlan(original, today);
  expect(plan.rows).toEqual([]);
  expect(plan.assignments).toEqual({});
  expect(applyAllocationPlan(plan, original, today)).toEqual(original);
});
