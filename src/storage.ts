import { conditionLabels, type Assignments, type Ghost, type Place } from './domain';
import { places as demoPlaces } from './data';
import { placeImages } from './assets';
export const storageKey = 'quiet-address-v1';
export interface Session {
  ghosts: Ghost[];
  assignments: Assignments;
  places: Place[];
}
export function parseSession(raw: string): Session {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Неверный формат сессии');
  const s = value as Session;
  // Migrate the first version without losing saved requests or assignments.
  const places = s.places === undefined ? structuredClone(demoPlaces) : s.places;
  if (!Array.isArray(places) || places.length > 50) throw new Error('Повреждённый справочник мест');
  const placeIds = new Set<string>();
  for (const p of places) {
    if (
      !p ||
      typeof p.id !== 'string' ||
      !p.id ||
      placeIds.has(p.id) ||
      typeof p.name !== 'string' ||
      !p.name.trim() ||
      p.name.length > 60 ||
      typeof p.description !== 'string' ||
      p.description.length > 180 ||
      !Number.isInteger(p.capacity) ||
      p.capacity < 1 ||
      p.capacity > 50 ||
      !Number.isFinite(p.temperature) ||
      p.temperature < -20 ||
      p.temperature > 40 ||
      [p.light, p.noise, p.humidity].some((n) => !Number.isInteger(n) || n < 0 || n > 100) ||
      !Number.isInteger(p.maxAnxiety) ||
      p.maxAnxiety < 1 ||
      p.maxAnxiety > 10 ||
      [p.people, p.mirrors, p.attic].some((b) => typeof b !== 'boolean') ||
      (p.image !== undefined && !placeImages.includes(p.image as (typeof placeImages)[number]))
    )
      throw new Error('Повреждённое место');
    placeIds.add(p.id);
  }
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
      !g.id ||
      (g.portrait !== undefined &&
        (!Number.isInteger(g.portrait) || g.portrait < 0 || g.portrait > 9)) ||
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
      new Date(`${g.deadline}T00:00:00Z`).toISOString().slice(0, 10) !== g.deadline ||
      !Array.isArray(g.conditions) ||
      g.conditions.some((c) => !Object.hasOwn(conditionLabels, c))
    )
      throw new Error('Повреждённая заявка');
    ids.add(g.id);
  }
  for (const [id, p] of Object.entries(s.assignments))
    if (!ids.has(id) || !places.some((place) => place.id === p))
      throw new Error('Неизвестное назначение');
  return { ...s, places };
}
