import {
  ConditionsRule,
  conditionLabels,
  relocation,
  type Condition,
  type Ghost,
  type Place,
} from './domain';
const icons: Record<Condition, string> = {
  attic: '🏠',
  noPeople: '👥',
  noMirrors: '🪞',
  damp: '💧',
  dark: '🌙',
  quiet: '🤫',
};
const conditionRule = new ConditionsRule();
export default function ComfortPanel({
  ghost,
  place,
  today,
}: {
  ghost: Ghost;
  place: Place;
  today: string;
}) {
  const { score, conflicts } = relocation.evaluate(ghost, place, today);
  const tone = score >= 75 ? 'good' : score >= 45 ? 'warning' : 'bad';
  const delta = place.temperature - ghost.temperature;
  const load = Math.round((place.noise * ghost.anxiety) / 25);
  return (
    <section className={`comfort-panel comfort-${tone}`} aria-label={`Комфорт: ${place.name}`}>
      <div className="comfort-heading">
        <span>Комфорт проживания</span>
        <strong>
          {score}
          <small> / 100</small>
        </strong>
      </div>
      <div
        className="comfort-track"
        role="progressbar"
        aria-label={`Комфорт в месте «${place.name}»`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        aria-valuetext={`${score} из 100`}
      >
        <span style={{ width: `${score}%` }} />
      </div>
      <p className="comfort-level">
        {score >= 75 ? 'Высокий комфорт' : score >= 45 ? 'Средний комфорт' : 'Низкий комфорт'} ·{' '}
        <span className={conflicts.length ? 'red' : undefined}>
          {conflicts.length ? 'есть обязательные ограничения' : 'обязательные условия соблюдены'}
        </span>
      </p>
      <div className="parameter-chips">
        <span className="parameter-chip">
          🌡{' '}
          {delta === 0
            ? `Идеально: ${place.temperature} °C`
            : `Отклонение: ${delta > 0 ? '+' : ''}${delta} °C`}
        </span>
        <span className="parameter-chip">
          🤫 Шум {place.noise}/100 · тревожность {ghost.anxiety}/10
          <br />
          <small>Нагрузка: −{load} балл. комфорта</small>
        </span>
      </div>
      <ul className="condition-chips" aria-label="Проверка обязательных условий">
        {ghost.conditions.map((c) => {
          const ok = conditionRule.check({ ...ghost, conditions: [c] }, place).length === 0;
          return (
            <li key={c} className={`condition-chip ${ok ? 'good' : 'bad'}`}>
              <span>
                <span aria-hidden="true">{icons[c]}</span> {conditionLabels[c]}
              </span>
              <strong>{ok ? '✓ Выполнено' : '✕ Нарушено'}</strong>
            </li>
          );
        })}
        <li className={`condition-chip ${ghost.anxiety <= place.maxAnxiety ? 'good' : 'bad'}`}>
          Допустимая тревожность: до {place.maxAnxiety}/10
          <strong>{ghost.anxiety <= place.maxAnxiety ? '✓ Выполнено' : '✕ Нарушено'}</strong>
        </li>
      </ul>
      <p className="comfort-note">Оценка комфорта не отменяет проверку вместимости и дедлайна.</p>
    </section>
  );
}
