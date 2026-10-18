import { useEffect, useRef, useState } from 'react';
import { placeImageUrl, portraitUrl } from './assets';
import ArtImage from './ArtImage';
import CharacterStory from './CharacterStory';
import StorageConflict from './StorageConflict';
import { useStorageSync } from './useStorageSync';
import { readStorageBaseline } from './storage-sync';
import { saveFile } from './backup';
import { conditionLabels, relocation } from './domain';
import {
  advancePreview,
  arrivals,
  currentGhosts,
  events,
  gameConflicts,
  gameStorageKey,
  newGame,
  parseGame,
  play,
  serializeGame,
  upgradeAvailable,
  upgradeLabels,
  type GameAction,
  type Upgrade,
} from './game';
import './game.css';

const upgradeDetails = {
  quiet: { title: 'Шумоизоляция', field: 'noise', label: 'Шум', condition: 'тишины' },
  dark: { title: 'Шторы', field: 'light', label: 'Свет', condition: 'темноты' },
  damp: { title: 'Увлажнение', field: 'humidity', label: 'Влажность', condition: 'сырости' },
} as const;
// Read the resulting values from the game action, keeping the UI tied to its rules.
const upgradeTargets = Object.fromEntries(
  (Object.keys(upgradeDetails) as Upgrade[]).map((upgrade) => {
    const initial = newGame();
    const improved = play(initial, { type: 'upgrade', placeId: initial.places[0].id, upgrade });
    return [upgrade, improved.places[0][upgradeDetails[upgrade].field]];
  }),
) as Record<Upgrade, number>;

function loadGame() {
  const baseline = readStorageBaseline(gameStorageKey);
  try {
    if (!baseline.ok) throw new Error('Storage unavailable');
    const raw = baseline.raw;
    return {
      state: raw !== null ? parseGame(raw) : newGame(),
      recovery: false,
      error: '',
      baseline,
    };
  } catch {
    return {
      state: newGame(),
      recovery: true,
      baseline,
      error:
        'Не удалось прочитать сохранение смены. Оно сохранено без изменений. Можно вернуться позже или явно начать новую игру.',
    };
  }
}

export default function ShiftGame() {
  const [boot] = useState(loadGame);
  const {
    sync,
    state: syncState,
    blocked: syncBlocked,
  } = useStorageSync({
    key: gameStorageKey,
    baseline: boot.baseline,
    parse: (raw) => (raw === null ? newGame() : parseGame(raw)),
  });
  const [state, setState] = useState(boot.state);
  const [recovery, setRecovery] = useState(boot.recovery);
  const [error, setError] = useState(boot.error);
  const [preview, setPreview] = useState(false);
  const [restart, setRestart] = useState(false);
  const gameHeading = useRef<HTMLHeadingElement>(null);
  const forecastHeading = useRef<HTMLHeadingElement>(null);
  const forecastButton = useRef<HTMLButtonElement>(null);
  const restartButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (preview) forecastHeading.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current.focus();
      returnFocus.current = null;
    }
  });
  useEffect(() => {
    if (recovery || syncBlocked) return;
    sync.save(serializeGame(state));
  }, [state, recovery, syncBlocked, sync]);
  const act = (action: GameAction) => {
    if (!sync.check()) return;
    try {
      setState(play(state, action));
      if (action.type === 'advance') returnFocus.current = gameHeading.current;
      setError('');
      setPreview(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось выполнить действие.');
    }
  };
  const reset = () => {
    if (!sync.check()) return;
    if (recovery && boot.baseline.ok && boot.baseline.raw !== null) {
      try {
        localStorage.setItem('quiet-address-game-recovery-v1', boot.baseline.raw);
      } catch {
        setError('Не удалось сохранить исходник игры. Сброс отменён; скачайте локальную копию.');
        return;
      }
    }
    setState(newGame());
    returnFocus.current = gameHeading.current;
    setRecovery(false);
    setError('');
    setPreview(false);
    setRestart(false);
  };
  const forecast = advancePreview(state);
  const completed = state.turn > 3;
  const housed = state.outcomes.filter((o) => o.placeId).length;
  const score = state.outcomes.reduce((sum, o) => sum + o.score, 0);
  return (
    <section className="shift-game" aria-label="Смена в бюро">
      <header className="game-intro">
        <p className="eyebrow">Пошаговая история · 3 смены · отдельное сохранение</p>
        <h2 ref={gameHeading} tabIndex={-1}>
          Ночная вахта: шесть тихих адресов
        </h2>
        <p>
          Помогите шести привидениям за три смены. На всё бюро — три жетона улучшений. Каждый дом
          вмещает двух постоянных жильцов. Время движется только после подтверждения конца смены.
        </p>
        <p>
          Цель: переселить 6 из 6 с максимальным комфортом. Советник выбирает адреса, но подготовку
          домов решаете вы. Решения песочницы остаются отдельно.
        </p>
      </header>
      <StorageConflict
        state={syncState}
        subject="Ночная вахта"
        onDownloadLocal={() => {
          try {
            saveFile(serializeGame(state), 'quiet-address-game-local.json');
          } catch {
            setError('Не удалось скачать локальную копию игры. Оставьте вкладку открытой.');
          }
        }}
        onLoadFresh={() =>
          sync.loadFresh((next) => {
            setState(next);
            setRecovery(false);
            setError('');
            setPreview(false);
            setRestart(false);
          })
        }
      />
      {error && (
        <div role="alert" className="notice warning">
          {error}
        </div>
      )}
      <div className="game-metrics" aria-label="Результат кампании">
        <span>
          <strong>{Math.min(state.turn, 3)} / 3</strong> смена{completed ? ' · завершено' : ''}
        </span>
        <span>
          <strong>{state.tokens}</strong> жетонов осталось
        </span>
        <span>
          <strong>{housed} / 6</strong> переселено
        </span>
        <span>
          <strong>{score}</strong> очков комфорта
        </span>
      </div>
      {recovery ? (
        <button type="button" onClick={() => setRestart(true)}>
          Начать новую игру вместо повреждённой
        </button>
      ) : (
        <>
          {completed ? (
            <div className="game-finale" role="status">
              <h3>{housed === 6 ? 'Все нашли свой тихий адрес!' : 'Вахта завершена'}</h3>
              <p>
                Переселено {housed} из 6, без адреса осталось {6 - housed}. Комфорт: {score} очков.
                Очки — сумма комфорта при переселении; нерасселённая заявка даёт 0.
              </p>
              <p>
                {score >= 476
                  ? 'Достигнут лучший результат этой кампании. Все шесть жильцов нашли дом.'
                  : housed === 6
                    ? 'Попробуйте другую комбинацию улучшений, чтобы повысить комфорт.'
                    : 'Улучшение одного дома под каждую волну помогает разместить больше жильцов. Повторная игра начинается с чистой кампании.'}
              </p>
            </div>
          ) : (
            <>
              <div className="game-event">
                <strong>Смена {state.turn}.</strong>{' '}
                {state.turn === 1
                  ? events[0]
                  : state.turn === 2
                    ? 'Прибыли Вера и Лев: им нужна темнота.'
                    : 'Прибыли Ирис и Фома: им нужна сырость.'}
                <p>
                  {state.turn < 3
                    ? events[state.turn]
                    : 'Это последняя смена. Проверьте все назначения перед завершением.'}
                </p>
              </div>
              <div className="game-requests">
                {currentGhosts(state).map((ghost) => (
                  <article className="game-ghost" key={ghost.id}>
                    <ArtImage src={portraitUrl(ghost)} width="80" height="80" sizes="80px" alt="" />
                    <h3>{ghost.name}</h3>
                    <CharacterStory ghost={ghost} />
                    <p>
                      {ghost.conditions.map((c) => conditionLabels[c]).join(', ')} · идеально{' '}
                      {ghost.temperature} °C
                    </p>
                    <label>
                      Адрес для {ghost.name}
                      <select
                        value={state.assignments[ghost.id] ?? ''}
                        onChange={(e) =>
                          act({ type: 'assign', ghostId: ghost.id, placeId: e.target.value })
                        }
                      >
                        <option value="">Пока без места</option>
                        {state.places.map((place) => {
                          const conflicts = gameConflicts(state, ghost, place);
                          return (
                            <option key={place.id} value={place.id}>
                              {place.name}
                              {conflicts.length
                                ? ` — ${conflicts.join('; ')}`
                                : ` — комфорт ${relocation.evaluate(ghost, place, '2000-01-01').score}/100`}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  </article>
                ))}
              </div>
              <button type="button" onClick={() => act({ type: 'advise' })}>
                Советник: подобрать адреса
              </button>
            </>
          )}
          <p className="game-condition-guide">
            Условия дома: тишина — шум ≤ 30/100; темнота — свет ≤ 30/100; сырость — влажность ≥
            65/100. Шум, свет и влажность измеряются по шкале от 0 до 100. Улучшение действует до
            конца кампании, но не добавляет мест и не меняет температуру.
          </p>
          <div className="game-buildings">
            {state.places.map((place) => {
              const residents = state.outcomes
                .filter((o) => o.placeId === place.id)
                .map((o) => arrivals.find((g) => g.id === o.ghostId)!);
              const planned = Object.values(state.assignments).filter(
                (id) => id === place.id,
              ).length;
              return (
                <article
                  key={place.id}
                  className="game-building"
                  aria-labelledby={`game-${place.id}`}
                >
                  <ArtImage
                    className="game-place-image"
                    src={placeImageUrl(place)}
                    width="180"
                    height="150"
                    sizes="180px"
                    loading="lazy"
                    alt=""
                  />
                  <h3 id={`game-${place.id}`}>{place.name}</h3>
                  <dl className="game-place-stats">
                    <div>
                      <dt>Температура</dt>
                      <dd>{place.temperature} °C</dd>
                    </div>
                    <div>
                      <dt>Шум</dt>
                      <dd>
                        {place.noise}/100 · {place.noise <= 30 ? 'тихо' : 'шумно'}
                      </dd>
                    </div>
                    <div>
                      <dt>Свет</dt>
                      <dd>
                        {place.light}/100 · {place.light <= 30 ? 'темно' : 'светло'}
                      </dd>
                    </div>
                    <div>
                      <dt>Влажность</dt>
                      <dd>
                        {place.humidity}/100 · {place.humidity >= 65 ? 'сыро' : 'сухо'}
                      </dd>
                    </div>
                  </dl>
                  <p>
                    Заселено: {residents.length}/2{planned ? ` · в плане: ${planned}` : ''}
                  </p>
                  <div className="game-residents">
                    {residents.map((ghost) => (
                      <span key={ghost.id}>
                        <ArtImage
                          src={portraitUrl(ghost)}
                          width="32"
                          height="32"
                          sizes="32px"
                          alt=""
                        />
                        {ghost.name}
                      </span>
                    ))}
                  </div>
                  {!completed && (
                    <div className="game-upgrades">
                      {(Object.keys(upgradeLabels) as Upgrade[]).map((upgrade) => {
                        const available = upgradeAvailable(place, upgrade);
                        const detail = upgradeDetails[upgrade];
                        return (
                          <button
                            key={upgrade}
                            type="button"
                            disabled={!state.tokens || !available}
                            onClick={() => act({ type: 'upgrade', placeId: place.id, upgrade })}
                          >
                            <strong>{detail.title}</strong>{' '}
                            <span>
                              {detail.label}: {place[detail.field]}/100
                              {available ? ` → ${upgradeTargets[upgrade]}/100` : ''}
                              {' · '}условие {detail.condition}{' '}
                              {available ? 'будет выполнено' : 'выполнено'}
                            </span>{' '}
                            <span className="game-upgrade-state">
                              {!available
                                ? 'Установлено'
                                : state.tokens < 1
                                  ? 'Недостаточно жетонов · нужно 1'
                                  : 'Установить · 1 жетон'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {!completed && (
            <button
              ref={forecastButton}
              className="primary"
              type="button"
              onClick={() => setPreview(true)}
            >
              Прогноз завершения смены
            </button>
          )}
          {preview && !completed && (
            <section className="game-preview" aria-label="Последствия завершения смены">
              <h3 ref={forecastHeading} tabIndex={-1}>
                Проверьте последствия
              </h3>
              <ul>
                {forecast.map((outcome) => (
                  <li key={outcome.ghostId}>
                    {arrivals.find((g) => g.id === outcome.ghostId)!.name}:{' '}
                    {outcome.placeId
                      ? `${state.places.find((p) => p.id === outcome.placeId)!.name}, комфорт ${outcome.score}/100`
                      : 'останется без адреса и не вернётся в следующей смене'}
                  </li>
                ))}
              </ul>
              <p>
                {state.turn < 3
                  ? events[state.turn]
                  : 'После подтверждения откроется итог кампании.'}{' '}
                Жетонов останется: {state.tokens}.
              </p>
              <div className="game-actions">
                <button className="primary" type="button" onClick={() => act({ type: 'advance' })}>
                  Подтвердить и завершить смену
                </button>
                <button
                  type="button"
                  onClick={() => {
                    returnFocus.current = forecastButton.current;
                    setPreview(false);
                  }}
                >
                  Вернуться к решениям
                </button>
              </div>
            </section>
          )}
          <details className="game-log">
            <summary>Журнал смены ({state.log.length})</summary>
            {state.log.length ? (
              <ol>
                {state.log.map((entry, i) => (
                  <li key={i}>{entry}</li>
                ))}
              </ol>
            ) : (
              <p>Улучшения и результаты смен появятся здесь.</p>
            )}
          </details>
          <button ref={restartButton} type="button" onClick={() => setRestart(true)}>
            Начать заново
          </button>
        </>
      )}
      {restart && (
        <div className="notice warning" role="region" aria-label="Подтверждение новой игры">
          <p>
            Начать заново? Текущая кампания и её сохранение будут заменены. Песочница не изменится.
          </p>
          <div className="game-actions">
            <button type="button" onClick={reset}>
              Да, начать новую игру
            </button>
            <button
              type="button"
              onClick={() => {
                returnFocus.current = restartButton.current ?? gameHeading.current;
                setRestart(false);
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
