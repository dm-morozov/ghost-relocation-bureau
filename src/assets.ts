import type { Ghost, Place } from './domain';
export const ghostPortraits = Array.from(
  { length: 10 },
  (_, i) => `ghost-${String(i + 1).padStart(2, '0')}`,
);
export const placeImages = ['castle', 'lighthouse', 'library', 'theatre', 'cellar'] as const;
export const assetUrl = (name: string) => `${import.meta.env.BASE_URL}images/${name}.png`;
export function portraitUrl(ghost: Ghost) {
  const demo = /^g([1-6])$/.exec(ghost.id);
  const index =
    ghost.portrait ??
    (demo ? Number(demo[1]) - 1 : [...ghost.id].reduce((n, c) => n + c.charCodeAt(0), 0) % 10);
  return assetUrl(ghostPortraits[index]);
}
export function placeImageUrl(place: Place) {
  return assetUrl(
    place.image ??
      (placeImages.includes(place.id as (typeof placeImages)[number]) ? place.id : 'castle'),
  );
}
