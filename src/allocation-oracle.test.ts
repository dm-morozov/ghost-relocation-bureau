import { describe, expect, it } from 'vitest';
import { relocation, type Assignments, type Condition, type Ghost, type Place } from './domain';

const today = '2026-10-18';
const conditionPool: Condition[] = ['attic', 'noMirrors', 'noPeople', 'damp', 'dark', 'quiet'];

// The oracle knows the product rules, not the flow graph, residual edges or service helpers.
function compatible(ghost: Ghost, place: Place) {
  if (ghost.deadline < today && !(ghost.settledAt && ghost.settledAt <= ghost.deadline))
    return false;
  if (ghost.anxiety > place.maxAnxiety) return false;
  return ghost.conditions.every((condition) => {
    switch (condition) {
      case 'attic':
        return place.attic;
      case 'noMirrors':
        return !place.mirrors;
      case 'noPeople':
        return !place.people;
      case 'damp':
        return place.humidity >= 65;
      case 'dark':
        return place.light <= 30;
      case 'quiet':
        return place.noise <= 30;
    }
  });
}

function comfort(ghost: Ghost, place: Place) {
  return Math.max(
    0,
    100 -
      Math.min(60, Math.abs(ghost.temperature - place.temperature) * 4) -
      Math.round((place.noise * ghost.anxiety) / 25),
  );
}

function objective(assignments: Assignments, ghosts: Ghost[], places: Place[]) {
  return {
    count: Object.keys(assignments).length,
    score: ghosts.reduce((sum, ghost) => {
      const place = places.find((item) => item.id === assignments[ghost.id]);
      return sum + (place ? comfort(ghost, place) : 0);
    }, 0),
  };
}

function bruteForce(ghosts: Ghost[], places: Place[], fixed: Assignments) {
  const kept = Object.fromEntries(
    Object.entries(fixed).filter(
      ([ghostId, placeId]) =>
        ghosts.some((ghost) => ghost.id === ghostId) &&
        places.some((place) => place.id === placeId),
    ),
  );
  const remaining = ghosts.filter((ghost) => !Object.hasOwn(kept, ghost.id));
  const assignments = { ...kept };
  let best = objective(assignments, ghosts, places);
  const visit = (index: number) => {
    if (index === remaining.length) {
      const candidate = objective(assignments, ghosts, places);
      if (
        candidate.count > best.count ||
        (candidate.count === best.count && candidate.score > best.score)
      )
        best = candidate;
      return;
    }
    const ghost = remaining[index];
    // Enumerate every combination, including leaving a request unassigned.
    visit(index + 1);
    for (const place of places) {
      const occupied = Object.values(assignments).filter((id) => id === place.id).length;
      if (occupied >= place.capacity || !compatible(ghost, place)) continue;
      assignments[ghost.id] = place.id;
      visit(index + 1);
      delete assignments[ghost.id];
    }
  };
  visit(0);
  return best;
}

function scenario(index: number) {
  // Fixed integer seed makes failures reproducible across machines and reruns.
  let seed = index + 17;
  const choose = (limit: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % limit;
  };
  const ghosts: Ghost[] = Array.from({ length: 2 + (index % 3) }, (_, i) => ({
    id: `g${i}`,
    name: `Призрак ${i}`,
    anxiety: i === 0 ? 1 : 1 + choose(10),
    temperature: choose(41) - 10,
    deadline: i > 0 && (index + i) % 7 === 0 ? '2026-10-17' : today,
    conditions:
      index % 3 === 0 || i === 0
        ? []
        : [
            conditionPool[(index + i) % conditionPool.length],
            ...(choose(2) ? [conditionPool[(index + i + 2) % conditionPool.length]] : []),
          ],
  }));
  const places: Place[] = Array.from({ length: 1 + (Math.floor(index / 3) % 3) }, (_, i) => ({
    id: `p${i}`,
    name: `Адрес ${i}`,
    description: '',
    capacity: 1 + choose(2),
    temperature: choose(41) - 10,
    maxAnxiety: 3 + choose(8),
    noise: [10, 30, 50][choose(3)],
    light: [10, 30, 50][choose(3)],
    humidity: [40, 65, 85][choose(3)],
    people: Boolean(choose(2)),
    mirrors: Boolean(choose(2)),
    attic: Boolean(choose(2)),
  }));
  return { ghosts, places };
}

describe('независимый полный перебор проверяет оптимальность распределения', () => {
  for (const pinned of [false, true]) {
    it(`совпадает с максимумом количества и затем комфорта в 30 сценариях${pinned ? ' с закреплёнными решениями' : ''}`, () => {
      for (let index = 0; index < 30; index++) {
        const { ghosts, places } = scenario(index);
        const fixed: Assignments = pinned
          ? { g0: 'p0', staleGhost: 'p0', [ghosts[1].id]: 'missing-place' }
          : {};
        if (pinned && index % 5 === 0) {
          places[0].capacity = 1;
          fixed.g1 = 'p0'; // Explicitly accepted overflow must remain, but must not grow.
        }
        const before = structuredClone({ ghosts, places, fixed });
        const result = relocation.allocate(ghosts, places, today, fixed);
        expect(objective(result, ghosts, places), `scenario ${index}, pinned=${pinned}`).toEqual(
          bruteForce(ghosts, places, fixed),
        );
        for (const [ghostId, placeId] of Object.entries(result)) {
          const ghost = ghosts.find((item) => item.id === ghostId)!;
          const place = places.find((item) => item.id === placeId)!;
          expect(ghost).toBeDefined();
          expect(place).toBeDefined();
          if (fixed[ghostId] === placeId) continue;
          expect(compatible(ghost, place), `compatibility: scenario ${index}, ${ghostId}`).toBe(
            true,
          );
          expect(Object.values(result).filter((id) => id === placeId).length).toBeLessThanOrEqual(
            place.capacity,
          );
        }
        for (const [ghostId, placeId] of Object.entries(fixed)) {
          if (
            ghosts.some((ghost) => ghost.id === ghostId) &&
            places.some((place) => place.id === placeId)
          )
            expect(result[ghostId]).toBe(placeId);
        }
        expect({ ghosts, places, fixed }).toEqual(before);
      }
    });
  }
});
