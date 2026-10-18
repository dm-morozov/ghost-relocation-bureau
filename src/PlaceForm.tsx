import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Place } from './domain';
import ArtImage from './ArtImage';
import { assetUrl, availableLocations, placeImageKey } from './assets';
export default function PlaceForm({
  onAdd,
  onCancel,
  initialData,
  existingPlaces = [],
  editing = false,
  onDirty,
}: {
  onAdd: (place: Place) => void;
  onCancel: () => void;
  initialData?: Partial<Place>;
  existingPlaces?: readonly Place[];
  editing?: boolean;
  onDirty?: () => void;
}) {
  const options =
    editing && initialData?.id && initialData.name
      ? [{ image: placeImageKey(initialData as Place), name: initialData.name }]
      : availableLocations(existingPlaces);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(
    () => options.find((o) => o.image === initialData?.image)?.image ?? options[0]?.image ?? '',
  );
  const selectedLocation = options.find((o) => o.image === selectedImage) ?? options[0];
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!selectedLocation) return;
    const number = (key: string) => Number(data.get(key));
    const description = String(data.get('description')).trim();
    if (!description) {
      setError('Добавьте описание: пробелы не считаются текстом.');
      return;
    }
    onAdd({
      id: editing ? initialData!.id! : crypto.randomUUID(),
      name: selectedLocation.name,
      description,
      image: editing ? (initialData?.image ?? selectedLocation.image) : selectedLocation.image,
      capacity: number('capacity'),
      temperature: number('temperature'),
      light: number('light'),
      noise: number('noise'),
      humidity: number('humidity'),
      maxAnxiety: number('maxAnxiety'),
      people: data.has('people'),
      mirrors: data.has('mirrors'),
      attic: data.has('attic'),
    });
  }
  return (
    <form
      className="new-form place-form"
      aria-label={editing ? 'Редактирование места' : 'Новое место'}
      onChange={onDirty}
      onSubmit={submit}
    >
      <h2 ref={heading} tabIndex={-1}>
        {editing ? 'Изменить место обитания' : 'Новое место обитания'}
      </h2>
      {error && (
        <p role="alert" className="red">
          {error}
        </p>
      )}
      {!options.length ? (
        <div className="notice" role="status">
          <strong>Все локации уже добавлены</strong>
          <p>Свободных изображений больше нет. Используйте существующие места для переселения.</p>
          <button type="button" onClick={onCancel}>
            Закрыть
          </button>
        </div>
      ) : (
        <>
          <p className="muted">
            Выберите свободную локацию. Название закреплено за изображением; описание и условия
            можно изменить.
          </p>
          <fieldset>
            <legend>Локация и изображение</legend>
            <div className="image-options location-options">
              {options.map((location) => (
                <label key={location.image}>
                  <input
                    type="radio"
                    name="image"
                    value={location.image}
                    checked={selectedLocation?.image === location.image}
                    onChange={() => setSelectedImage(location.image)}
                  />
                  <ArtImage
                    src={assetUrl(location.image)}
                    alt=""
                    width={192}
                    height={192}
                    loading="lazy"
                  />
                  <span>{location.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Название
            <input name="name" value={selectedLocation?.name ?? ''} readOnly />
          </label>
          <label>
            Описание
            <input
              name="description"
              required
              maxLength={180}
              defaultValue={initialData?.description ?? ''}
            />
          </label>
          <div className="form-grid">
            {[
              ['capacity', 'Вместимость', 1, 50, 1],
              ['temperature', 'Температура, °C', -20, 40, 12],
              ['light', 'Освещение (0–100)', 0, 100, 20],
              ['noise', 'Шум (0–100)', 0, 100, 20],
              ['humidity', 'Влажность (0–100)', 0, 100, 50],
              ['maxAnxiety', 'Макс. тревожность (1–10)', 1, 10, 10],
            ].map(([name, label, min, max, value]) => (
              <label key={name}>
                {label}
                <input
                  type="number"
                  name={String(name)}
                  min={min}
                  max={max}
                  defaultValue={
                    initialData?.[
                      String(name) as
                        'capacity' | 'temperature' | 'light' | 'noise' | 'humidity' | 'maxAnxiety'
                    ] ?? value
                  }
                  required
                  step="1"
                />
              </label>
            ))}
          </div>
          <fieldset>
            <legend>Особенности</legend>
            <label className="check">
              <input type="checkbox" name="people" defaultChecked={initialData?.people ?? false} />
              Есть люди
            </label>
            <label className="check">
              <input
                type="checkbox"
                name="mirrors"
                defaultChecked={initialData?.mirrors ?? false}
              />
              Есть зеркала
            </label>
            <label className="check">
              <input type="checkbox" name="attic" defaultChecked={initialData?.attic ?? false} />
              Есть чердак
            </label>
          </fieldset>
          <p className="muted">
            {editing
              ? 'После сохранения совместимость всех жильцов будет проверена заново. Назначения сохраняются.'
              : 'Новое место сразу участвует в ручном выборе. Для автоматического распределения повторите подбор. Данные сохраняются в этом браузере.'}
          </p>
          <div className="form-actions">
            <button className="primary" type="submit">
              {editing ? 'Сохранить место' : 'Добавить место'}
            </button>
            <button type="button" onClick={onCancel}>
              Отмена
            </button>
          </div>
        </>
      )}
    </form>
  );
}
