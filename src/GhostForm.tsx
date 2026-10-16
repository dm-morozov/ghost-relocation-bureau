import { useState, type FormEvent } from 'react';
import { conditionLabels, type Condition, type Ghost } from './domain';
import { assetUrl, ghostPortraits, portraitUrl } from './assets';

interface Props {
  ghost: Ghost;
  onSave: (ghost: Ghost) => void;
  onCancel: () => void;
}
export default function GhostForm({ ghost, onSave, onCancel }: Props) {
  const [error, setError] = useState('');
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name')).trim();
    if (!name) {
      setError('Введите имя: пробелы не считаются именем.');
      return;
    }
    onSave({
      ...ghost,
      name,
      anxiety: Number(data.get('anxiety')),
      temperature: Number(data.get('temperature')),
      deadline: String(data.get('deadline')),
      portrait: Number(data.get('portrait')),
      conditions: data.getAll('conditions') as Condition[],
    });
  }
  return (
    <form className="new-form edit-request" aria-label="Редактирование заявки" onSubmit={save}>
      <h3>Параметры заявки</h3>
      <p>Текущий адрес сохранится. После изменения условий проверьте его совместимость.</p>
      {error && (
        <p role="alert" className="red">
          {error}
        </p>
      )}
      <label>
        Имя
        <input name="name" defaultValue={ghost.name} maxLength={60} required />
      </label>
      <div className="form-grid">
        <label>
          Тревожность (1–10)
          <input
            name="anxiety"
            type="number"
            min="1"
            max="10"
            defaultValue={ghost.anxiety}
            required
          />
        </label>
        <label>
          Температура, °C
          <input
            name="temperature"
            type="number"
            min="-20"
            max="40"
            defaultValue={ghost.temperature}
            required
          />
        </label>
      </div>
      <label>
        Дедлайн (включительно)
        <input
          name="deadline"
          type="date"
          min="2000-01-01"
          max="2100-12-31"
          defaultValue={ghost.deadline}
          required
        />
      </label>
      <fieldset>
        <legend>Особые условия</legend>
        {Object.entries(conditionLabels).map(([key, label]) => (
          <label className="check" key={key}>
            <input
              type="checkbox"
              name="conditions"
              value={key}
              defaultChecked={ghost.conditions.includes(key as Condition)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Портрет привидения</legend>
        <div className="image-options ghost-options">
          {ghostPortraits.map((image, index) => (
            <label key={image}>
              <input
                type="radio"
                name="portrait"
                value={index}
                defaultChecked={assetUrl(image) === portraitUrl(ghost)}
              />
              <img src={assetUrl(image)} alt={`Привидение ${index + 1}`} />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="form-actions">
        <button className="primary" type="submit">
          Сохранить изменения
        </button>
        <button className="secondary" type="button" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}
