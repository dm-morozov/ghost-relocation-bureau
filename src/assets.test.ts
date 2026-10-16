import { expect, it } from 'vitest';
import { availableLocations } from './assets';
import { places } from './data';
import { parseSession } from './storage';
it('не добавляет резервные локации при миграции и учитывает старые дубликаты изображений', () => {
  const migrated = parseSession(JSON.stringify({ ghosts: [], assignments: {} }));
  expect(migrated.places).toHaveLength(5);
  expect(availableLocations(migrated.places).map((p) => p.name)).toEqual([
    'Оранжерея туманов',
    'Часовая башня',
    'Лесная усадьба',
    'Забытая обсерватория',
    'Водяная мельница',
  ]);
  const legacy = { ...places[0], id: 'old-custom', image: 'castle', name: 'Убежище для духа' };
  const session = parseSession(
    JSON.stringify({ ghosts: [], assignments: {}, places: [...places, legacy] }),
  );
  expect(session.places[5].name).toBe('Убежище для духа');
  expect(availableLocations(session.places)).toHaveLength(5);
});
