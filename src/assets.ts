import type { Ghost, Place } from './domain';
export const ghostPortraits = Array.from(
  { length: 10 },
  (_, i) => `ghost-${String(i + 1).padStart(2, '0')}`,
);
export const locationCatalog = [
  { image: 'castle', name: 'Замок на холме' },
  { image: 'lighthouse', name: 'Старый маяк' },
  { image: 'library', name: 'Библиотека забвения' },
  { image: 'theatre', name: 'Заброшенный театр' },
  { image: 'cellar', name: 'Подвал типографии' },
  { image: 'greenhouse', name: 'Оранжерея туманов' },
  { image: 'clocktower', name: 'Часовая башня' },
  { image: 'manor', name: 'Лесная усадьба' },
  { image: 'observatory', name: 'Забытая обсерватория' },
  { image: 'watermill', name: 'Водяная мельница' },
] as const;
export const placeImages = locationCatalog.map((location) => location.image);
export function placeImageKey(place: Place) {
  return (
    place.image ??
    (placeImages.includes(place.id as (typeof placeImages)[number]) ? place.id : 'castle')
  );
}
export function availableLocations(places: readonly Place[]) {
  const used = new Set(places.map(placeImageKey));
  return locationCatalog.filter((location) => !used.has(location.image));
}
export const assetUrl = (name: string) => `${import.meta.env.BASE_URL}images/${name}.png`;
export function portraitUrl(ghost: Ghost) {
  const demo = /^g([1-6])$/.exec(ghost.id);
  const index =
    ghost.portrait ??
    (demo ? Number(demo[1]) - 1 : [...ghost.id].reduce((n, c) => n + c.charCodeAt(0), 0) % 10);
  return assetUrl(ghostPortraits[index]);
}
export function placeImageUrl(place: Place) {
  return assetUrl(placeImageKey(place));
}
