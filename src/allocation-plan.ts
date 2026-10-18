import { relocation, type Assignments } from './domain';
import type { Session } from './storage';

export type AllocationChange = 'added' | 'removed' | 'moved' | 'preserved' | 'unassigned';
export interface AllocationPlanRow {
  ghostId: string;
  name: string;
  previousPlaceId?: string;
  nextPlaceId?: string;
  previousAddress: string;
  nextAddress: string;
  change: AllocationChange;
  pinned: boolean;
  settledAt?: string;
  conflicts: string[];
}
export interface AllocationPlan {
  /** Includes the date: crossing midnight invalidates the preview too. */
  snapshot: string;
  today: string;
  assignments: Assignments;
  rows: AllocationPlanRow[];
  counts: Record<AllocationChange, number> & { fixed: number; conflicts: number };
}

export function allocationSnapshot(session: Session, today: string): string {
  return JSON.stringify({
    ghosts: session.ghosts,
    places: session.places,
    assignments: session.assignments,
    pinned: session.pinned ?? [],
    today,
  });
}

/** Pure preview. The existing allocator reserves fixed residents and their capacity. */
export function createAllocationPlan(session: Session, today: string): AllocationPlan {
  const pinned = new Set(session.pinned ?? []);
  const fixed = Object.fromEntries(
    session.ghosts
      .filter((g) => (pinned.has(g.id) || g.settledAt) && session.assignments[g.id])
      .map((g) => [g.id, session.assignments[g.id]]),
  );
  const assignments = relocation.allocate(session.ghosts, session.places, today, fixed);
  const rows = session.ghosts.map((g): AllocationPlanRow => {
    const previousPlaceId = session.assignments[g.id];
    const nextPlaceId = assignments[g.id];
    const nextPlace = session.places.find((p) => p.id === nextPlaceId);
    const change =
      previousPlaceId === nextPlaceId
        ? nextPlaceId
          ? 'preserved'
          : 'unassigned'
        : previousPlaceId
          ? nextPlaceId
            ? 'moved'
            : 'removed'
          : 'added';
    return {
      ghostId: g.id,
      name: g.name,
      previousPlaceId,
      nextPlaceId,
      previousAddress: session.places.find((p) => p.id === previousPlaceId)?.name ?? 'Без места',
      nextAddress: nextPlace?.name ?? 'Без места',
      change,
      pinned: pinned.has(g.id),
      settledAt: g.settledAt,
      conflicts: nextPlace ? relocation.conflicts(g, nextPlace, assignments, today) : [],
    };
  });
  const counts: AllocationPlan['counts'] = {
    added: 0,
    removed: 0,
    moved: 0,
    preserved: 0,
    unassigned: 0,
    fixed: Object.keys(fixed).length,
    conflicts: rows.filter((row) => row.conflicts.length).length,
  };
  rows.forEach((row) => counts[row.change]++);
  return { snapshot: allocationSnapshot(session, today), today, assignments, rows, counts };
}

export function isAllocationPlanCurrent(
  plan: AllocationPlan,
  session: Session,
  today: string,
): boolean {
  return plan.snapshot === allocationSnapshot(session, today);
}

/** Caller owns undo/persistence. Null means regenerate the preview before applying. */
export function applyAllocationPlan(
  plan: AllocationPlan,
  session: Session,
  today: string,
): Session | null {
  if (!isAllocationPlanCurrent(plan, session, today)) return null;
  return structuredClone({ ...session, assignments: plan.assignments });
}
