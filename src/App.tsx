import { useEffect, useState, type FormEvent } from 'react';
import {
  conditionLabels,
  relocation,
  todayISO,
  type Ghost,
  type Condition,
  type Assignments,
} from './domain';
import { demoGhosts, places as demoPlaces } from './data';
import { parseSession, storageKey, type Session } from './storage';
import Worklog from './Worklog';
import PlaceForm from './PlaceForm';
import { assetUrl, ghostPortraits, portraitUrl, placeImageUrl } from './assets';

type Tab = 'Заявки' | 'Места' | 'Отчёт' | 'AI Worklog';
function initial(): Session & { error: string } {
  try {
    const raw = localStorage.getItem(storageKey);
    return {
      ...(raw
        ? parseSession(raw)
        : { ghosts: demoGhosts(todayISO()), assignments: {}, places: structuredClone(demoPlaces) }),
      error: '',
    };
  } catch {
    return {
      ghosts: demoGhosts(todayISO()),
      assignments: {},
      places: structuredClone(demoPlaces),
      error:
        'Сохранённая сессия недоступна или повреждена. Загружены демоданные; проверьте их перед подбором.',
    };
  }
}
const dateLabel = (s: string) =>
  new Date(`${s}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
export default function App() {
  const [boot] = useState(initial);
  const [places, setPlaces] = useState(boot.places);
  const [showPlaceForm, setShowPlaceForm] = useState(false);
  const [ghosts, setGhosts] = useState(boot.ghosts),
    [assignments, setAssignments] = useState<Assignments>(boot.assignments);
  const [error, setError] = useState(boot.error),
    [message, setMessage] = useState('');
  const [tab, setTab] = useState<Tab>('Заявки'),
    [selected, setSelected] = useState<string | null>(boot.ghosts[0]?.id ?? null);
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [showForm, setShowForm] = useState(false);
  const [target, setTarget] = useState(boot.assignments[boot.ghosts[0]?.id] ?? ''),
    [pending, setPending] = useState<{
      ghostId: string;
      placeId: string;
      conflicts: string[];
    } | null>(null);
  const [today, setToday] = useState(todayISO());
  useEffect(() => {
    const id = window.setInterval(() => setToday(todayISO()), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ ghosts, assignments, places }));
    } catch {
      setError(
        'Не удалось сохранить изменения в браузере. Текущая работа доступна до закрытия страницы; скачайте отчёт.',
      );
    }
  }, [ghosts, assignments, places]);
  const ghost = ghosts.find((g) => g.id === selected);
  const assigned = ghosts.filter((g) => assignments[g.id]).length;
  const violations = (g: Ghost) => {
    const p = places.find((p) => p.id === assignments[g.id]);
    return p ? relocation.conflicts(g, p, assignments, today) : [];
  };
  const problemGhosts = ghosts.filter((g) => !assignments[g.id] || violations(g).length);
  const occupied = (id: string) => Object.values(assignments).filter((p) => p === id).length;
  const overloaded = places.filter((p) => occupied(p.id) > p.capacity);
  function select(id: string) {
    setSelected(id);
    setTarget(assignments[id] ?? '');
    setPending(null);
  }
  function scenario(value: string) {
    const next = value === 'empty' ? [] : demoGhosts(today);
    let a: Assignments = {};
    if (value === 'full') a = { g1: 'castle', g2: 'castle' };
    if (value === 'conflict') a = { g1: 'theatre' };
    setGhosts(next);
    setAssignments(a);
    select(next[0]?.id ?? '');
    setTarget(a[next[0]?.id] ?? '');
    setQuery('');
    setFilter('all');
    setPending(null);
    setMessage('Сценарий заявок загружен. Назначения заменены; добавленные места сохранены.');
  }
  function allocate() {
    const result = relocation.allocate(ghosts, places, today);
    setAssignments(result);
    setPending(null);
    setTarget(selected ? (result[selected] ?? '') : '');
    setMessage(
      'Подбор завершён. Обязательные условия и вместимость учтены; предыдущие ручные назначения заменены.',
    );
  }
  function apply(id: string, placeId: string) {
    setAssignments((a) => {
      const next = { ...a };
      if (placeId) next[id] = placeId;
      else delete next[id];
      return next;
    });
    setPending(null);
    setMessage(placeId ? 'Ручное назначение сохранено.' : 'Назначение снято.');
  }
  function choose() {
    if (!ghost) return;
    const p = places.find((p) => p.id === target);
    const conflicts = p ? relocation.conflicts(ghost, p, assignments, today) : [];
    if (conflicts.length) setPending({ ghostId: ghost.id, placeId: target, conflicts });
    else apply(ghost.id, target);
  }
  function addGhost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name')).trim();
    if (!name) {
      setError('Введите имя привидения: пробелы не считаются именем.');
      return;
    }
    if (ghosts.length >= 50) {
      setError('В демоверсии можно создать до 50 заявок.');
      return;
    }
    const g: Ghost = {
      id: crypto.randomUUID(),
      name,
      anxiety: Number(data.get('anxiety')),
      temperature: Number(data.get('temperature')),
      deadline: String(data.get('deadline')),
      conditions: data.getAll('conditions') as Condition[],
      portrait: Number(data.get('portrait')),
    };
    setGhosts((gs) => [...gs, g]);
    select(g.id);
    setTarget('');
    setShowForm(false);
    setMessage('Заявка добавлена. Запустите подбор или выберите место вручную.');
  }
  function download() {
    const rows = ghosts.map((g) => ({
      имя: g.name,
      место: places.find((p) => p.id === assignments[g.id])?.name ?? null,
      предупреждения: violations(g),
    }));
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              date: today,
              assigned,
              unassigned: ghosts.length - assigned,
              overloaded: overloaded.map((p) => p.name),
              requests: rows,
            },
            null,
            2,
          ),
        ],
        { type: 'application/json;charset=utf-8' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `relocation-${today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const visible = ghosts.filter(
    (g) =>
      g.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (filter === 'all' ||
        (filter === 'unassigned' ? !assignments[g.id] : violations(g).length > 0)),
  );
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab('Заявки');
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            Б
          </span>
          <span>
            Тихий адрес<small>Бюро переселения привидений</small>
          </span>
        </a>
        <div className="side-label">Рабочее пространство</div>
        <nav aria-label="Основная навигация">
          {(['Заявки', 'Места', 'Отчёт', 'AI Worklog'] as Tab[]).map((t, i) => (
            <button key={t} className={tab === t ? 'nav active' : 'nav'} onClick={() => setTab(t)}>
              <span className="nav-number">0{i + 1}</span>
              {t}
              {t === 'Заявки' && <span className="count">{ghosts.length}</span>}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <span className="status-dot" /> Локальная демосессия
          <p>Изменения сохраняются только в этом браузере.</p>
          <a
            href="https://github.com/dm-morozov/ghost-relocation-bureau"
            target="_blank"
            rel="noreferrer"
          >
            Исходный код ↗
          </a>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>Отдел заботы о потустороннем</span>
          <time dateTime={today}>
            {new Date(`${today}T12:00:00`).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </time>
        </header>
        {error && (
          <div role="alert" className="notice danger">
            {error}
            <button className="text-button" onClick={() => setError('')}>
              Закрыть
            </button>
          </div>
        )}
        {message && (
          <div role="status" className="notice">
            {message}
            <button className="text-button" onClick={() => setMessage('')}>
              Закрыть
            </button>
          </div>
        )}
        <div className="page-heading">
          <div>
            <p className="eyebrow">Никто не должен остаться без своего угла</p>
            <h1>
              {tab === 'Заявки'
                ? 'Каждому духу — свой дом.'
                : tab === 'Места'
                  ? 'Адреса с характером.'
                  : tab === 'Отчёт'
                    ? 'Итоги переселения.'
                    : 'Как создавалось бюро.'}
            </h1>
            <p className="subtitle">
              {tab === 'Заявки'
                ? 'Подберите тихий адрес, проверьте условия и помогите с переездом.'
                : tab === 'Места'
                  ? 'Добавляйте адреса и проверяйте их условия перед назначением.'
                  : tab === 'Отчёт'
                    ? 'Назначение с нарушениями ещё требует решения оператора.'
                    : 'Честный журнал участия автора и AI.'}
            </p>
          </div>
          {tab === 'Заявки' && (
            <button className="primary" onClick={allocate} disabled={!ghosts.length}>
              Подобрать места <span aria-hidden="true">↗</span>
            </button>
          )}
        </div>
        <section className="metrics" aria-label="Сводка">
          <div>
            <span>Всего заявок</span>
            <strong>{ghosts.length.toString().padStart(2, '0')}</strong>
          </div>
          <div>
            <span>Назначено</span>
            <strong>
              {assigned.toString().padStart(2, '0')}
              <small> / {ghosts.length}</small>
            </strong>
          </div>
          <div>
            <span>Без места</span>
            <strong className={ghosts.length - assigned ? 'amber' : ''}>
              {(ghosts.length - assigned).toString().padStart(2, '0')}
            </strong>
          </div>
          <div>
            <span>С нарушениями</span>
            <strong className={ghosts.some((g) => violations(g).length) ? 'red' : ''}>
              {ghosts
                .filter((g) => violations(g).length)
                .length.toString()
                .padStart(2, '0')}
            </strong>
          </div>
        </section>
        {tab === 'Заявки' && (
          <>
            <div className="workspace">
              <section className="requests">
                <div className="section-heading">
                  <h2>Заявки на переселение</h2>
                  <button className="secondary" onClick={() => setShowForm(!showForm)}>
                    {showForm ? 'Закрыть форму' : '+ Новая заявка'}
                  </button>
                </div>
                {showForm && (
                  <form className="new-form" onSubmit={addGhost}>
                    <label>
                      Имя
                      <input
                        name="name"
                        required
                        maxLength={60}
                        placeholder="Например, Оскар Чердачный"
                      />
                    </label>
                    <div className="form-grid">
                      <label>
                        Тревожность (1–10)
                        <input
                          name="anxiety"
                          type="number"
                          min="1"
                          max="10"
                          defaultValue="5"
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
                          defaultValue="12"
                          required
                        />
                      </label>
                    </div>
                    <label>
                      Дедлайн (включительно)
                      <input
                        type="date"
                        name="deadline"
                        defaultValue={today}
                        required
                        min="2000-01-01"
                        max="2100-12-31"
                      />
                    </label>
                    <fieldset>
                      <legend>Особые условия</legend>
                      {Object.entries(conditionLabels).map(([key, label]) => (
                        <label className="check" key={key}>
                          <input type="checkbox" name="conditions" value={key} />
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
                              defaultChecked={index === ghosts.length % 10}
                            />
                            <img src={assetUrl(image)} alt={`Привидение ${index + 1}`} />
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <button className="primary" type="submit">
                      Добавить заявку
                    </button>
                  </form>
                )}
                <div className="filters">
                  <input
                    aria-label="Поиск по имени"
                    placeholder="Найти привидение…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <select
                    aria-label="Фильтр заявок"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">Все заявки</option>
                    <option value="unassigned">Без места</option>
                    <option value="conflict">С нарушениями</option>
                  </select>
                </div>
                <div className="request-list">
                  {visible.map((g) => {
                    const p = places.find((p) => p.id === assignments[g.id]),
                      bad = violations(g);
                    return (
                      <button
                        key={g.id}
                        className={`request ${selected === g.id ? 'selected' : ''}`}
                        onClick={() => select(g.id)}
                      >
                        <img
                          className="avatar ghost-image"
                          src={portraitUrl(g)}
                          alt=""
                          width="64"
                          height="64"
                        />
                        <span className="request-body">
                          <strong>{g.name}</strong>
                          <span>
                            {g.conditions.map((c) => conditionLabels[c]).join(' · ') ||
                              'Без особых условий'}
                          </span>
                          <span className="request-meta">
                            <span className={g.deadline < today ? 'red' : ''}>
                              До {dateLabel(g.deadline)}
                            </span>
                            <span>Тревожность {g.anxiety}/10</span>
                          </span>
                        </span>
                        <span className={`badge ${bad.length ? 'bad' : p ? 'good' : ''}`}>
                          {bad.length ? 'Конфликт' : p ? 'Назначено' : 'Без места'}
                        </span>
                      </button>
                    );
                  })}
                  {!visible.length && (
                    <div className="empty">
                      <h3>{ghosts.length ? 'Ничего не найдено' : 'Пока здесь тихо'}</h3>
                      <p>
                        {ghosts.length
                          ? 'Измените поиск или фильтр.'
                          : 'Добавьте первую заявку или загрузите демосценарий ниже.'}
                      </p>
                    </div>
                  )}
                </div>
              </section>
              <aside className="detail" aria-label="Карточка заявки">
                {ghost ? (
                  <>
                    <div className="detail-top">
                      <span className="eyebrow">Личное дело</span>
                      <span>
                        № {ghost.id.startsWith('g') ? ghost.id.slice(1).padStart(3, '0') : 'новое'}
                      </span>
                    </div>
                    <img
                      className="detail-portrait"
                      src={portraitUrl(ghost)}
                      alt={`Портрет: ${ghost.name}`}
                      width="160"
                      height="160"
                    />
                    <h2>{ghost.name}</h2>
                    <p className="muted">В поисках места, которое можно назвать своим.</p>
                    <dl className="facts">
                      <div>
                        <dt>Тревожность</dt>
                        <dd>{ghost.anxiety} из 10</dd>
                      </div>
                      <div>
                        <dt>Любимая температура</dt>
                        <dd>{ghost.temperature} °C</dd>
                      </div>
                      <div>
                        <dt>Дедлайн</dt>
                        <dd className={ghost.deadline < today ? 'red' : ''}>
                          {dateLabel(ghost.deadline)}
                          {ghost.deadline < today ? ' · просрочен' : ''}
                        </dd>
                      </div>
                    </dl>
                    <h3>Особые условия</h3>
                    <div className="tags">
                      {ghost.conditions.length ? (
                        ghost.conditions.map((c) => <span key={c}>{conditionLabels[c]}</span>)
                      ) : (
                        <span>Нет</span>
                      )}
                    </div>
                    <div className="decision">
                      <p className="eyebrow">Текущее решение</p>
                      <h3>
                        {places.find((p) => p.id === assignments[ghost.id])?.name ??
                          'Место пока не назначено'}
                      </h3>
                      {assignments[ghost.id] ? (
                        <>
                          <p>
                            {
                              relocation.evaluate(
                                ghost,
                                places.find((p) => p.id === assignments[ghost.id])!,
                                today,
                              ).explanation
                            }
                          </p>
                          {violations(ghost).length > 0 && (
                            <ul className="red">
                              {violations(ghost).map((c) => (
                                <li key={c}>{c}</li>
                              ))}
                            </ul>
                          )}
                        </>
                      ) : (
                        <p>
                          {places.every(
                            (p) => relocation.conflicts(ghost, p, assignments, today).length,
                          )
                            ? 'Подходящих свободных мест нет. Причины для каждого адреса — в списке ниже.'
                            : 'Есть подходящие места. Запустите подбор или назначьте адрес вручную.'}
                        </p>
                      )}
                    </div>
                    <label className="manual-label">
                      Изменить место вручную
                      <select
                        value={target}
                        onChange={(e) => {
                          setTarget(e.target.value);
                          setPending(null);
                        }}
                      >
                        <option value="">Без назначения</option>
                        {places.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {occupied(p.id)}/{p.capacity}
                          </option>
                        ))}
                      </select>
                    </label>
                    {target && (
                      <div className="candidate">
                        {(() => {
                          const p = places.find((p) => p.id === target)!;
                          const c = relocation.conflicts(ghost, p, assignments, today);
                          return (
                            <>
                              <p>{relocation.evaluate(ghost, p, today).explanation}</p>
                              {c.length ? (
                                <ul className="red">
                                  {c.map((s) => (
                                    <li key={s}>{s}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="green">Можно назначить: условия соблюдены.</p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                    <button className="secondary wide" onClick={choose}>
                      Применить выбор
                    </button>
                    {pending && (
                      <div className="notice danger" role="alert">
                        <strong>Назначение нарушает условия</strong>
                        <ul>
                          {pending.conflicts.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                        <p>Оно будет отмечено как проблемное в отчёте.</p>
                        <button
                          className="danger-button"
                          onClick={() => apply(pending.ghostId, pending.placeId)}
                        >
                          Всё равно назначить
                        </button>
                        <button className="text-button" onClick={() => setPending(null)}>
                          Отмена
                        </button>
                      </div>
                    )}
                    <details className="reasons">
                      <summary>Изменить дедлайн</summary>
                      <form
                        className="new-form"
                        key={ghost.id}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const deadline = String(new FormData(e.currentTarget).get('newDeadline'));
                          setGhosts((gs) =>
                            gs.map((g) => (g.id === ghost.id ? { ...g, deadline } : g)),
                          );
                          setPending(null);
                          setMessage('Дедлайн обновлён. При необходимости повторите подбор.');
                        }}
                      >
                        <label>
                          Новый дедлайн
                          <input
                            type="date"
                            name="newDeadline"
                            defaultValue={ghost.deadline}
                            min="2000-01-01"
                            max="2100-12-31"
                            required
                          />
                        </label>
                        <button type="submit" className="secondary">
                          Сохранить срок
                        </button>
                      </form>
                    </details>
                    <details className="reasons">
                      <summary>Проверка всех адресов</summary>
                      {places.map((p) => {
                        const c = relocation.conflicts(ghost, p, assignments, today);
                        return (
                          <div key={p.id}>
                            <strong>{p.name}</strong>
                            <p>
                              {c.join('; ') ||
                                `Подходит · комфорт ${relocation.evaluate(ghost, p, today).score}/100`}
                            </p>
                          </div>
                        );
                      })}
                    </details>
                  </>
                ) : (
                  <div className="empty">
                    <h2>Выберите заявку</h2>
                    <p>Здесь появятся условия, объяснение и ручное назначение.</p>
                  </div>
                )}
              </aside>
            </div>
            <section className="scenario">
              <div>
                <h3>Проверить крайние случаи</h3>
                <p>Сценарий заменяет заявки и назначения. Добавленные места сохраняются.</p>
              </div>
              <div className="scenario-buttons">
                <button onClick={() => scenario('demo')}>Исходные данные</button>
                <button onClick={() => scenario('empty')}>Пустой список</button>
                <button onClick={() => scenario('full')}>Переполнение</button>
                <button onClick={() => scenario('conflict')}>Конфликт условий</button>
              </div>
            </section>
          </>
        )}
        {tab === 'Места' && (
          <section>
            <div className="section-heading places-heading">
              <h2>Места обитания · {places.length}</h2>
              <button className="primary" onClick={() => setShowPlaceForm(!showPlaceForm)}>
                {showPlaceForm ? 'Закрыть форму' : '+ Новое место'}
              </button>
            </div>
            {showPlaceForm && (
              <PlaceForm
                onCancel={() => setShowPlaceForm(false)}
                onAdd={(p) => {
                  if (places.length >= 50) {
                    setError('Можно добавить до 50 мест.');
                    return;
                  }
                  setPlaces((ps) => [...ps, p]);
                  setShowPlaceForm(false);
                  setMessage(
                    'Место добавлено. Перейдите в заявки и повторите подбор, чтобы использовать новый адрес.',
                  );
                }}
              />
            )}
            <div className="places-grid">
              {places.map((p) => (
                <article className="place" key={p.id}>
                  <div className="place-art">
                    <img
                      src={placeImageUrl(p)}
                      alt={p.name}
                      width="512"
                      height="512"
                      loading="lazy"
                    />
                  </div>
                  <div className="place-content">
                    <div className="section-heading">
                      <h2>{p.name}</h2>
                      <span className={`badge ${occupied(p.id) > p.capacity ? 'bad' : ''}`}>
                        {occupied(p.id)}/{p.capacity}
                      </span>
                    </div>
                    <p>{p.description}</p>
                    <dl className="facts">
                      <div>
                        <dt>Температура</dt>
                        <dd>{p.temperature} °C</dd>
                      </div>
                      <div>
                        <dt>Свет / шум / влажность</dt>
                        <dd>
                          {p.light} / {p.noise} / {p.humidity}
                        </dd>
                      </div>
                      <div>
                        <dt>Люди / зеркала / чердак</dt>
                        <dd>
                          {[p.people, p.mirrors, p.attic]
                            .map((v) => (v ? 'да' : 'нет'))
                            .join(' / ')}
                        </dd>
                      </div>
                      <div>
                        <dt>Макс. тревожность</dt>
                        <dd>{p.maxAnxiety}/10</dd>
                      </div>
                    </dl>
                    <small>Свет, шум и влажность: шкала 0–100.</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        {tab === 'Отчёт' && (
          <section className="document">
            <div className="section-heading">
              <h2>План переселения</h2>
              <button className="secondary" onClick={download}>
                Скачать JSON
              </button>
            </div>
            <p>
              Назначено без нарушений:{' '}
              <strong>
                {ghosts.filter((g) => assignments[g.id] && !violations(g).length).length}
              </strong>
              . С нарушениями: <strong>{ghosts.filter((g) => violations(g).length).length}</strong>.
              Без места: <strong>{ghosts.length - assigned}</strong>.
            </p>
            <h3>Требуют внимания · {problemGhosts.length}</h3>
            {!problemGhosts.length && (
              <p>
                {ghosts.length ? 'Все заявки назначены без нарушений.' : 'Заявок нет. Отчёт пуст.'}
              </p>
            )}
            {[...problemGhosts]
              .sort((a, b) => a.deadline.localeCompare(b.deadline) || b.anxiety - a.anxiety)
              .map((g) => (
                <div className="report-row" key={g.id}>
                  <strong>{g.name}</strong>
                  <p>
                    {violations(g).join('; ') ||
                      (places.every((p) => relocation.conflicts(g, p, assignments, today).length)
                        ? 'Нет подходящего свободного места. Откройте заявку для разбора каждого адреса.'
                        : 'Место ещё не назначено; запустите подбор.')}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => {
                      select(g.id);
                      setTab('Заявки');
                    }}
                  >
                    Открыть заявку →
                  </button>
                </div>
              ))}
            <h3>Вместимость мест</h3>
            {places.map((p) => (
              <div className="capacity-row" key={p.id}>
                <span>{p.name}</span>
                <strong className={occupied(p.id) > p.capacity ? 'red' : ''}>
                  {occupied(p.id)} из {p.capacity}
                  {occupied(p.id) > p.capacity ? ' · переполнено' : ''}
                </strong>
              </div>
            ))}
            <p>
              {overloaded.length
                ? `Перегруженных мест: ${overloaded.length}. Снимите лишние назначения или повторите автоматический подбор.`
                : 'Переполненных мест нет.'}
            </p>
          </section>
        )}
        {tab === 'AI Worklog' && <Worklog />}
        <details className="method">
          <summary>Как работает подбор</summary>
          <p>
            Обязательные условия проверяются до оценки комфорта. Темнота: свет ≤ 30; тишина: шум ≤
            30; сырость: влажность ≥ 65. Дедлайн включителен, считается по локальной дате браузера.
            Просроченная заявка не участвует в автоматическом подборе.
          </p>
          <p>
            Комфорт = max(0, 100 − min(60, |желаемая температура − температура места| × 4) −
            round(шум × тревожность / 25)). Температура — предпочтение, а не запрет.
          </p>
          <p>
            Алгоритм сначала расселяет максимально возможное число привидений, затем выбирает
            наибольшую суммарную оценку комфорта. При равенстве результат детерминирован порядком
            данных. Дедлайн и тревожность сортируют проблемные заявки в отчёте, но не дают приоритет
            при распределении. Повторный подбор заменяет ручные назначения.
          </p>
        </details>
        <footer>
          Тихий адрес <span>Бюро переселения привидений</span>
        </footer>
      </main>
    </div>
  );
}
