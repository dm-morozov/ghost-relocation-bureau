import type { FormEvent } from 'react';
import type { Place } from './domain';
import { assetUrl, placeImages } from './assets';
export default function PlaceForm({
  onAdd,
  onCancel,
}: {
  onAdd: (place: Place) => void;
  onCancel: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name')).trim();
    if (!name) {
      event.currentTarget
        .querySelector<HTMLInputElement>('[name=name]')
        ?.setCustomValidity('Введите название места');
      event.currentTarget.reportValidity();
      return;
    }
    const number = (key: string) => Number(data.get(key));
    onAdd({
      id: crypto.randomUUID(),
      name,
      description: String(data.get('description')).trim(),
      image: String(data.get('image')),
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
    <form className="new-form place-form" onSubmit={submit}>
      <h2>Новое место обитания</h2>
      <label>
        Название
        <input
          name="name"
          required
          maxLength={60}
          onInput={(e) => e.currentTarget.setCustomValidity('')}
          placeholder="Например, Усадьба у озера"
        />
      </label>
      <label>
        Описание
        <input name="description" required maxLength={180} />
      </label>
      <fieldset>
        <legend>Изображение места</legend>
        <div className="image-options">
          {placeImages.map((image, i) => (
            <label key={image}>
              <input type="radio" name="image" value={image} defaultChecked={i === 0} />
              <img
                src={assetUrl(image)}
                alt={['Замок', 'Маяк', 'Библиотека', 'Театр', 'Типография'][i]}
              />
            </label>
          ))}
        </div>
      </fieldset>
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
              defaultValue={value}
              required
              step="1"
            />
          </label>
        ))}
      </div>
      <fieldset>
        <legend>Особенности</legend>
        <label className="check">
          <input type="checkbox" name="people" />
          Есть люди
        </label>
        <label className="check">
          <input type="checkbox" name="mirrors" />
          Есть зеркала
        </label>
        <label className="check">
          <input type="checkbox" name="attic" />
          Есть чердак
        </label>
      </fieldset>
      <p className="muted">
        Новое место сразу участвует в ручном выборе. Для автоматического распределения повторите
        подбор. Данные сохраняются в этом браузере.
      </p>
      <div className="scenario-buttons">
        <button className="primary" type="submit">
          Добавить место
        </button>
        <button type="button" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}
