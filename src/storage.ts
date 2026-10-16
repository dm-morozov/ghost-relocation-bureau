import { conditionLabels, type Assignments, type Ghost } from './domain';
import { places } from './data';
export const storageKey = 'quiet-address-v1';
export interface Session {
  ghosts: Ghost[];
  assignments: Assignments;
}
export function parseSession(raw: string): Session {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Неверный формат сессии');
  const s = value as Session;
  if (
    !Array.isArray(s.ghosts) ||
    s.ghosts.length > 50 ||
    !s.assignments ||
    typeof s.assignments !== 'object' ||
    Array.isArray(s.assignments)
  )
    throw new Error('Неверный формат сессии');
  const ids = new Set<string>();
  for (const g of s.ghosts) {
    if (
      !g ||
      typeof g.id !== 'string' ||
      ids.has(g.id) ||
      typeof g.name !== 'string' ||
      !g.name.trim() ||
      g.name.length > 60 ||
      !Number.isInteger(g.anxiety) ||
      g.anxiety < 1 ||
      g.anxiety > 10 ||
      !Number.isFinite(g.temperature) ||
      g.temperature < -20 ||
      g.temperature > 40 ||
      typeof g.deadline !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(g.deadline) ||
      !Number.isFinite(Date.parse(g.deadline)) ||
      !Array.isArray(g.conditions) ||
      g.conditions.some((c) => !Object.hasOwn(conditionLabels, c))
    )
      throw new Error('Повреждённая заявка');
    ids.add(g.id);
  }
  for (const [id, p] of Object.entries(s.assignments))
    if (!ids.has(id) || !places.some((place) => place.id === p))
      throw new Error('Неизвестное назначение');
  return s;
}
