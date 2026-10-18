import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  conditionLabels,
  relocation,
  todayISO,
  addDays,
  isUrgent,
  type Ghost,
  type Condition,
  type Assignments,
  type Place,
} from './domain';
import { demoGhosts, places as demoPlaces } from './data';
import { parseSession, storageKey, type Session } from './storage';
import { loadSession, makeBackup, saveFile } from './backup';
import { useStorageSync } from './useStorageSync';
import StorageConflict from './StorageConflict';
import CharacterStory from './CharacterStory';
import SessionTools from './SessionTools';
import ThemeToggle from './ThemeToggle';
import ReportView from './ReportView';
import ShiftGame from './ShiftGame';
import ArtImage from './ArtImage';
import AllocationPreview from './AllocationPreview';
import {
  createAllocationPlan,
  isAllocationPlanCurrent,
  type AllocationPlan,
} from './allocation-plan';
import IdealPlaceAction from './IdealPlaceAction';
import './theme.css';
import Worklog from './Worklog';
import BrandLogo from './BrandLogo';
import PlaceForm from './PlaceForm';
import ComfortPanel from './ComfortPanel';
import GhostForm from './GhostForm';
import {
  assetUrl,
  ghostPortraits,
  portraitUrl,
  placeImageUrl,
  availableLocations,
  placeImageKey,
} from './assets';

type Tab = 'Заявки' | 'Места' | 'Отчёт' | 'AI Worklog' | 'Смена';
const dateLabel = (s: string) =>
  new Date(`${s}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
export default function App() {
  const [boot] = useState(loadSession);
  const {
    sync,
    state: syncState,
    blocked: syncBlocked,
  } = useStorageSync<Session>({
    key: storageKey,
    baseline: boot.baseline,
    // The existing recovery UI protects malformed boot data until a confirmed replacement.
    parse: (raw) =>
      raw === null
        ? {
            ghosts: demoGhosts(todayISO()),
            places: structuredClone(demoPlaces),
            assignments: {},
            pinned: [],
          }
        : parseSession(raw),
  });
  const [storageBlocked, setStorageBlocked] = useState(boot.blocked);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [scenarioPending, setScenarioPending] = useState<string | null>(null);
  const [undo, setUndo] = useState<Session | null>(null);
  const [allocating, setAllocating] = useState(false);
  const [allocationPlan, setAllocationPlan] = useState<AllocationPlan | null>(null);
  const allocationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allocationButton = useRef<HTMLButtonElement>(null);
  const sessionRef = useRef('');
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [deletingPlace, setDeletingPlace] = useState<Place | null>(null);
  const [idealFor, setIdealFor] = useState<string | null>(null);
  const [createdIdealPlace, setCreatedIdealPlace] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string[]>(boot.pinned ?? []);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [places, setPlaces] = useState(boot.places);
  const [showPlaceForm, setShowPlaceForm] = useState(false);
  const [placeInitial, setPlaceInitial] = useState<Partial<Place>>();
  const [placeFormVersion, setPlaceFormVersion] = useState(0);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const newRequestButton = useRef<HTMLButtonElement>(null);
  const newPlaceButton = useRef<HTMLButtonElement>(null);
  const requestButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnFocus = useRef<HTMLElement | null>(null);
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const focusRequest = useRef(false);
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
  const previousTab = useRef(tab);
  const currentSession: Session = { ghosts, assignments, places, pinned };
  sessionRef.current = JSON.stringify(currentSession);
  useEffect(
    () => () => {
      if (allocationTimer.current) clearTimeout(allocationTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!dirty && !syncBlocked) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, syncBlocked]);
  function mayLeave() {
    return (
      !dirty || window.confirm('В форме есть несохранённые изменения. Закрыть её без сохранения?')
    );
  }
  function changeTab(next: Tab) {
    if (!mayLeave()) return false;
    setDirty(false);
    setEditing(false);
    setShowForm(false);
    setShowPlaceForm(false);
    setTab(next);
    return true;
  }
  function finishForm(focus: HTMLElement | null) {
    setDirty(false);
    returnFocus.current = focus;
  }
  useEffect(() => {
    if (returnFocus.current) {
      returnFocus.current.focus();
      returnFocus.current = null;
    }
  });
  function filterRequests(next: string) {
    if (!changeTab('Заявки')) return;
    setFilter(next);
    setQuery('');
    setMobileDetail(false);
  }
  function restoreSession(next: Session) {
    setUndo(structuredClone(currentSession));
    setGhosts(next.ghosts);
    setPlaces(next.places);
    setAssignments(next.assignments);
    setPinned(next.pinned ?? []);
    setSelected(next.ghosts[0]?.id ?? null);
    setTarget(next.assignments[next.ghosts[0]?.id] ?? '');
    setEditing(false);
    setDirty(false);
    setShowForm(false);
    setPending(null);
    setQuery('');
    setFilter('all');
    setShowPlaceForm(false);
    setEditingPlace(null);
    setDeletingPlace(null);
    setIdealFor(null);
    setCreatedIdealPlace(null);
    setAllocationPlan(null);
    setMobileDetail(false);
    setMessage('Сессия восстановлена. Предыдущую версию можно вернуть кнопкой отмены.');
  }
  useEffect(() => {
    if (tab === 'Заявки' && focusRequest.current) {
      focusRequest.current = false;
      detailHeading.current?.focus();
      detailHeading.current?.scrollIntoView?.({ block: 'nearest' });
    } else if (previousTab.current !== tab) {
      pageHeading.current?.focus();
      pageHeading.current?.scrollIntoView?.({ block: 'start' });
    }
    previousTab.current = tab;
  }, [tab, selected, mobileDetail]);
  useEffect(() => {
    const id = window.setInterval(() => setToday(todayISO()), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (storageBlocked || syncBlocked) return;
    sync.save(JSON.stringify({ ghosts, assignments, places, pinned }));
  }, [ghosts, assignments, places, pinned, storageBlocked, syncBlocked, sync]);
  const ghost = ghosts.find((g) => g.id === selected);
  const assigned = ghosts.filter((g) => assignments[g.id]).length;
  const violations = (g: Ghost) => {
    const p = places.find((p) => p.id === assignments[g.id]);
    return p ? relocation.conflicts(g, p, assignments, today) : [];
  };
  const occupied = (id: string) => Object.values(assignments).filter((p) => p === id).length;
  function createIdealPlace(g: Ghost) {
    if (!mayLeave()) return;
    setDirty(false);
    setEditing(false);
    setShowForm(false);
    setEditingPlace(null);
    setIdealFor(g.id);
    setCreatedIdealPlace(null);
    if (!availableLocations(places).length) {
      setTab('Места');
      setShowPlaceForm(false);
      setMessage(
        'Все локации добавлены. Откройте «Изменить место» у существующего адреса и настройте условия.',
      );
      return;
    }
    setPlaceInitial({
      description: `Место с условиями для ${g.name}`,
      capacity: 1,
      temperature: g.temperature,
      attic: g.conditions.includes('attic'),
      people: false,
      mirrors: false,
      humidity: g.conditions.includes('damp') ? 85 : 45,
      light: g.conditions.includes('dark') ? 15 : 40,
      noise: g.conditions.includes('quiet') ? 15 : 30,
      maxAnxiety: 10,
      image: availableLocations(places)[0]?.image,
    });
    setPlaceFormVersion((v) => v + 1);
    setShowPlaceForm(true);
    setTab('Места');
    setPending(null);
    setMessage(
      `Параметры для ${g.name} заполнены. Проверьте их и сохраните дом, затем назначьте его заявке.`,
    );
  }
  function select(id: string, external = false, saved = false) {
    if (!saved && !mayLeave()) return false;
    setDirty(false);
    setShowForm(false);
    setShowPlaceForm(false);
    focusRequest.current = true;
    setMobileDetail(true);
    if (external) {
      setQuery('');
      setFilter('all');
    }
    setEditing(false);
    setDeleting(false);
    setSelected(id);
    setTarget(assignments[id] ?? '');
    setPending(null);
    return true;
  }
  function scenario(value: string) {
    setIdealFor(null);
    setCreatedIdealPlace(null);
    setUndo(structuredClone(currentSession));
    setDirty(false);
    setScenarioPending(null);
    const next = value === 'empty' ? [] : demoGhosts(today);
    let a: Assignments = {};
    if (value === 'full' && places[0]) a = { g1: places[0].id, g2: places[0].id };
    if (value === 'full' && places[0] && places[0].capacity > 1) {
      a = Object.fromEntries(
        next
          .slice(0, Math.min(next.length, places[0].capacity + 1))
          .map((g) => [g.id, places[0].id]),
      );
    }
    if (value === 'conflict' && places.some((p) => p.id === 'theatre')) a = { g1: 'theatre' };
    setPinned([]);
    setGhosts(next);
    setAssignments(a);
    select(next[0]?.id ?? '', false, true);
    setTarget(a[next[0]?.id] ?? '');
    setQuery('');
    setFilter('all');
    setPending(null);
    setMessage('Сценарий заявок загружен. Назначения заменены; добавленные места сохранены.');
  }
  function allocate() {
    if (allocating || allocationPlan || !mayLeave() || !sync.check()) return;
    setDirty(false);
    setEditing(false);
    setShowForm(false);
    setShowPlaceForm(false);
    setAllocating(true);
    const day = todayISO();
    const snapshot = sessionRef.current;
    allocationTimer.current = setTimeout(() => {
      allocationTimer.current = null;
      setAllocating(false);
      if (sessionRef.current !== snapshot || todayISO() !== day || !sync.check()) {
        setMessage('Данные изменились во время сверки. Запустите подбор повторно.');
        return;
      }
      setAllocationPlan(createAllocationPlan(currentSession, day));
    }, 350);
  }
  function applyPlan() {
    if (!allocationPlan) return;
    if (!sync.check()) return;
    if (!isAllocationPlanCurrent(allocationPlan, currentSession, todayISO())) {
      setAllocationPlan(null);
      setMessage('Данные или дата изменились. Запустите подбор повторно.');
      return;
    }
    setUndo(structuredClone(currentSession));
    setAssignments(allocationPlan.assignments);
    setPending(null);
    setTarget(selected ? (allocationPlan.assignments[selected] ?? '') : '');
    const c = allocationPlan.counts;
    setMessage(
      `Подбор завершён. Изменено: ${c.added + c.removed + c.moved}. Сохранено закреплённых и завершённых: ${c.fixed}. Без места: ${c.unassigned + c.removed}. С конфликтами: ${c.conflicts}.`,
    );
    setAllocationPlan(null);
  }
  function extendDeadline() {
    if (!ghost || ghost.settledAt) return;
    setUndo(structuredClone(currentSession));
    setGhosts((items) =>
      items.map((g) => (g.id === ghost.id ? { ...g, deadline: addDays(g.deadline, 7) } : g)),
    );
    setPending(null);
    setMessage('Дедлайн продлён на 7 календарных дней от прежнего срока.');
  }
  function settle() {
    if (!ghost) return;
    const place = places.find((p) => p.id === assignments[ghost.id]);
    if (!place || relocation.conflicts(ghost, place, assignments, today).length) return;
    setUndo(structuredClone(currentSession));
    setGhosts((items) => items.map((g) => (g.id === ghost.id ? { ...g, settledAt: today } : g)));
    setMessage('Переселение подтверждено. Этот адрес сохраняется при подборе; дедлайн выполнен.');
  }
  function apply(id: string, placeId: string) {
    setUndo(structuredClone(currentSession));
    setPinned((ids) =>
      placeId ? [...ids.filter((value) => value !== id), id] : ids.filter((value) => value !== id),
    );
    setAssignments((a) => {
      const next = { ...a };
      if (placeId) next[id] = placeId;
      else delete next[id];
      return next;
    });
    setPending(null);
    setMessage(
      placeId
        ? 'Ручное назначение сохранено и закреплено. Автоподбор его не изменит.'
        : 'Назначение снято.',
    );
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
    setUndo(structuredClone(currentSession));
    setGhosts((gs) => [...gs, g]);
    select(g.id, false, true);
    setTarget('');
    setShowForm(false);
    setMessage('Заявка добавлена. Запустите подбор или выберите место вручную.');
  }
  function deleteGhost() {
    if (!ghost) return;
    setUndo(structuredClone(currentSession));
    const remaining = ghosts.filter((g) => g.id !== ghost.id);
    setGhosts(remaining);
    setAssignments((current) => {
      const next = { ...current };
      delete next[ghost.id];
      return next;
    });
    setPinned((ids) => ids.filter((id) => id !== ghost.id));
    select(remaining[0]?.id ?? '');
    setTarget(remaining[0] ? (assignments[remaining[0].id] ?? '') : '');
    setMessage('Заявка «' + ghost.name + '» удалена. Занятое ею место освобождено.');
  }
  const visible = ghosts.filter(
    (g) =>
      g.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (filter === 'all' ||
        (filter === 'unassigned'
          ? !assignments[g.id]
          : filter === 'assigned'
            ? !!assignments[g.id]
            : violations(g).length > 0)),
  );
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            changeTab('Заявки');
          }}
        >
          <BrandLogo />
        </a>
        <ThemeToggle />
        <div className="side-label">Рабочее пространство</div>
        <nav aria-label="Основная навигация">
          {(['Заявки', 'Места', 'Отчёт', 'AI Worklog', 'Смена'] as Tab[]).map((t, i) => (
            <button
              key={t}
              aria-current={tab === t ? 'page' : undefined}
              className={tab === t ? 'nav active' : 'nav'}
              onClick={() => changeTab(t)}
            >
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
            Исходный код
          </a>
        </div>
      </aside>
      <main>
        <StorageConflict
          state={syncState}
          subject="Сессия бюро"
          onDownloadLocal={() => {
            try {
              saveFile(makeBackup(currentSession), 'quiet-address-local.json');
            } catch {
              setError(
                'Не удалось скачать копию. Оставьте вкладку открытой и повторите загрузку файла.',
              );
            }
          }}
          onLoadFresh={() => {
            if (!mayLeave()) return;
            sync.loadFresh((next) => {
              if (allocationTimer.current) clearTimeout(allocationTimer.current);
              allocationTimer.current = null;
              setAllocating(false);
              restoreSession(next);
              setUndo(null);
              setScenarioPending(null);
              setStorageBlocked(false);
              setError('');
              setMessage('Загружена актуальная сохранённая версия.');
            });
          }}
        />
        {allocationPlan && (
          <AllocationPreview
            plan={allocationPlan}
            stale={syncBlocked || !isAllocationPlanCurrent(allocationPlan, currentSession, today)}
            onApply={applyPlan}
            returnFocusTo={allocationButton.current}
            onCancel={() => setAllocationPlan(null)}
          />
        )}
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
        {tab !== 'Смена' && message && (
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
            <h1 ref={pageHeading} tabIndex={-1}>
              {tab === 'Заявки'
                ? 'Каждому духу — свой дом.'
                : tab === 'Места'
                  ? 'Адреса с характером.'
                  : tab === 'Отчёт'
                    ? 'Итоги переселения.'
                    : tab === 'Смена'
                      ? 'Три смены до рассвета.'
                      : 'Как создавалось бюро.'}
            </h1>
            <p className="subtitle">
              {tab === 'Заявки'
                ? 'Подберите тихий адрес, проверьте условия и помогите с переездом.'
                : tab === 'Места'
                  ? 'Добавляйте адреса и проверяйте их условия перед назначением.'
                  : tab === 'Отчёт'
                    ? 'Назначение с нарушениями ещё требует решения оператора.'
                    : tab === 'Смена'
                      ? 'Пошаговая история: решения, улучшения и новые жильцы.'
                      : 'Честный журнал участия автора и AI.'}
            </p>
          </div>
          {tab === 'Заявки' && (
            <button
              ref={allocationButton}
              className={allocating ? 'primary allocation-busy' : 'primary'}
              onClick={allocate}
              disabled={!ghosts.length || allocating}
              aria-busy={allocating}
            >
              {allocating ? (
                <>
                  Сверка условий и аур… <span className="allocation-spinner" aria-hidden="true" />
                </>
              ) : (
                <>Подобрать места</>
              )}
            </button>
          )}
        </div>
        {tab === 'Заявки' && (
          <details className="quick-start">
            <summary>Первый день в бюро · три простых шага</summary>
            <ol>
              <li>
                <strong>Познакомьтесь с заявкой.</strong> Выберите привидение, проверьте срок и
                особые условия.
              </li>
              <li>
                <strong>Найдите тихий адрес.</strong> Запустите подбор или выберите место вручную.
                Ручной выбор закрепляется замочком.
              </li>
              <li>
                <strong>Проверьте переезд.</strong> Устраните конфликты, подтвердите переселение и
                откройте отчёт.
              </li>
            </ol>
          </details>
        )}
        {tab !== 'Смена' && undo && (
          <div className="notice undo-notice">
            <span>Последнее действие можно отменить.</span>
            <button
              onClick={() => {
                if (!mayLeave()) return;
                const previous = undo;
                restoreSession(previous);
                setUndo(null);
                setMessage('Последнее действие отменено.');
              }}
            >
              Отменить последнее действие
            </button>
          </div>
        )}
        {tab !== 'Смена' && (
          <section className="metrics" aria-label="Сводка">
            <div>
              <button className="metric-filter" onClick={() => filterRequests('all')}>
                <span>Всего заявок</span>
              </button>
              <strong>{ghosts.length.toString().padStart(2, '0')}</strong>
            </div>
            <div>
              <button className="metric-filter" onClick={() => filterRequests('assigned')}>
                Назначено
              </button>
              <strong>
                {assigned.toString().padStart(2, '0')}
                <small> / {ghosts.length}</small>
              </strong>
            </div>
            <div>
              <button className="metric-filter" onClick={() => filterRequests('unassigned')}>
                Без места
              </button>
              <strong className={ghosts.length - assigned ? 'amber' : ''}>
                {(ghosts.length - assigned).toString().padStart(2, '0')}
              </strong>
            </div>
            <div>
              <button className="metric-filter" onClick={() => filterRequests('conflict')}>
                С нарушениями
              </button>
              <strong className={ghosts.some((g) => violations(g).length) ? 'red' : ''}>
                {ghosts
                  .filter((g) => violations(g).length)
                  .length.toString()
                  .padStart(2, '0')}
              </strong>
            </div>
          </section>
        )}
        {tab !== 'Смена' && (
          <SessionTools
            session={currentSession}
            blocked={storageBlocked}
            original={boot.original}
            canReplace={() => sync.check()}
            onRestore={(next) => {
              if (mayLeave()) {
                restoreSession(next);
                setStorageBlocked(false);
                setError('');
              }
            }}
            onResume={() => {
              if (!sync.check()) return;
              setStorageBlocked(false);
              setError('');
            }}
          />
        )}
        {tab === 'Заявки' && (
          <>
            <div className={`workspace ${mobileDetail ? 'mobile-detail' : ''}`} inert={allocating}>
              <section className="requests">
                <div className="section-heading">
                  <h2>Заявки на переселение</h2>
                  <button
                    ref={newRequestButton}
                    className="secondary"
                    aria-expanded={showForm}
                    onClick={() => {
                      if (!mayLeave()) return;
                      if (showForm) finishForm(newRequestButton.current);
                      else setDirty(false);
                      setEditing(false);
                      setShowForm(!showForm);
                    }}
                  >
                    {showForm ? 'Закрыть форму' : '+ Новая заявка'}
                  </button>
                </div>
                {showForm && (
                  <form
                    className="new-form"
                    aria-label="Новая заявка"
                    onChange={() => setDirty(true)}
                    onSubmit={addGhost}
                  >
                    <label>
                      Имя
                      <input
                        autoFocus
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
                            <ArtImage
                              src={assetUrl(image)}
                              alt={`Привидение ${index + 1}`}
                              width={96}
                              height={96}
                              loading="lazy"
                            />
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
                    <option value="assigned">Назначено</option>
                    <option value="conflict">С нарушениями</option>
                  </select>
                </div>
                <div className="request-list result-enter" key={JSON.stringify(assignments)}>
                  {visible.map((g) => {
                    const p = places.find((p) => p.id === assignments[g.id]),
                      bad = violations(g);
                    return (
                      <button
                        key={g.id}
                        ref={(node) => {
                          if (node) requestButtons.current.set(g.id, node);
                          else requestButtons.current.delete(g.id);
                        }}
                        aria-pressed={selected === g.id}
                        className={`request request-${bad.length ? 'conflict' : p ? 'assigned' : 'unassigned'} ${selected === g.id ? 'selected' : ''}`}
                        onClick={() => select(g.id)}
                      >
                        <ArtImage
                          className="avatar ghost-image"
                          src={portraitUrl(g)}
                          alt=""
                          width="64"
                          height="64"
                        />
                        <span className="request-body">
                          <strong>
                            {g.name}
                            {isUrgent(g, today) && <span className="urgent-badge">🔥 Срочно</span>}
                            {pinned.includes(g.id) && (
                              <span aria-label="Закреплено вручную"> 🔒</span>
                            )}
                          </strong>
                          <span>
                            {g.conditions.map((c) => conditionLabels[c]).join(' · ') ||
                              'Без особых условий'}
                          </span>
                          <span className="request-meta">
                            <span className={g.deadline < today && !g.settledAt ? 'red' : ''}>
                              До {dateLabel(g.deadline)}
                            </span>
                            <span>Тревожность {g.anxiety}/10</span>
                          </span>
                        </span>
                        <span className={`badge ${bad.length ? 'bad' : p ? 'good' : 'warning'}`}>
                          {bad.length
                            ? 'Конфликт'
                            : g.settledAt
                              ? 'Переселено'
                              : p
                                ? 'Назначено'
                                : 'Без места'}
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
              <aside className="detail result-enter" aria-label="Карточка заявки">
                <button
                  className="secondary back-to-list"
                  onClick={() => {
                    if (mayLeave()) {
                      setMobileDetail(false);
                      setEditing(false);
                      setDirty(false);
                      returnFocus.current = selected
                        ? (requestButtons.current.get(selected) ?? newRequestButton.current)
                        : newRequestButton.current;
                    }
                  }}
                >
                  ← Все заявки
                </button>
                {ghost ? (
                  <>
                    <div className="detail-top">
                      <span className="eyebrow">Личное дело</span>
                      <span>
                        № {ghost.id.startsWith('g') ? ghost.id.slice(1).padStart(3, '0') : 'новое'}
                      </span>
                    </div>
                    <ArtImage
                      className="detail-portrait"
                      src={portraitUrl(ghost)}
                      alt={`Портрет: ${ghost.name}`}
                      width="160"
                      height="160"
                    />
                    <h2 ref={detailHeading} tabIndex={-1}>
                      {ghost.name}
                    </h2>
                    <span
                      className={`badge ${violations(ghost).length ? 'bad' : assignments[ghost.id] ? 'good' : 'warning'}`}
                    >
                      {violations(ghost).length
                        ? 'Конфликт'
                        : ghost.settledAt
                          ? 'Переселено'
                          : assignments[ghost.id]
                            ? 'Назначено'
                            : 'Без места'}
                    </span>
                    <div className="request-actions">
                      <button
                        className="secondary"
                        aria-expanded={editing}
                        disabled={!!ghost.settledAt}
                        onClick={() => {
                          if (!mayLeave()) return;
                          setDirty(false);
                          setShowForm(false);
                          setEditing(!editing);
                          setDeleting(false);
                          setPending(null);
                        }}
                      >
                        Редактировать заявку
                      </button>
                      <button
                        className="text-button delete-action"
                        aria-expanded={deleting}
                        onClick={() => {
                          if (!mayLeave()) return;
                          setDirty(false);
                          setDeleting(!deleting);
                          setEditing(false);
                          setShowForm(false);
                          setDirty(false);
                          setPending(null);
                        }}
                      >
                        Удалить заявку
                      </button>
                    </div>
                    {editing && (
                      <GhostForm
                        key={ghost.id}
                        ghost={ghost}
                        onDirty={() => setDirty(true)}
                        onCancel={() => {
                          if (!mayLeave()) return;
                          setEditing(false);
                          finishForm(detailHeading.current);
                        }}
                        onSave={(updated) => {
                          setUndo(structuredClone(currentSession));
                          setDirty(false);
                          setGhosts((items) =>
                            items.map((item) => (item.id === updated.id ? updated : item)),
                          );
                          setEditing(false);
                          finishForm(detailHeading.current);
                          setPending(null);
                          setMessage(
                            'Заявка обновлена. Назначение и закрепление сохранены; проверьте предупреждения об условиях.',
                          );
                        }}
                      />
                    )}
                    {deleting && (
                      <section className="notice danger" aria-label="Подтверждение удаления">
                        <strong>Удалить заявку «{ghost.name}»?</strong>
                        <p>
                          Назначение и закрепление будут сняты. Восстановить заявку можно только
                          создав её заново.
                        </p>
                        <div className="form-actions">
                          <button className="danger-button" onClick={deleteGhost}>
                            Да, удалить заявку
                          </button>
                          <button className="secondary" onClick={() => setDeleting(false)}>
                            Отмена
                          </button>
                        </div>
                      </section>
                    )}
                    {!editing && (
                      <>
                        <CharacterStory ghost={ghost} />
                        {isUrgent(ghost, today) && (
                          <p className="urgent-badge">🔥 Срочно: срок сегодня или завтра</p>
                        )}
                        {!ghost.settledAt && (
                          <button
                            className="secondary"
                            disabled={addDays(ghost.deadline, 7) > '2100-12-31'}
                            onClick={extendDeadline}
                          >
                            +7 дней к сроку
                          </button>
                        )}
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
                            <dd className={ghost.deadline < today && !ghost.settledAt ? 'red' : ''}>
                              {dateLabel(ghost.deadline)}
                              {ghost.deadline < today && !ghost.settledAt ? ' · просрочен' : ''}
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
                          {ghost.settledAt ? (
                            <div className="notice">
                              <strong>Переезд завершён {dateLabel(ghost.settledAt)}</strong>
                              <p>
                                Дедлайн выполнен. Чтобы изменить заявку или адрес, верните её в
                                план.
                              </p>
                              <button
                                onClick={() => {
                                  setUndo(structuredClone(currentSession));
                                  setGhosts((items) =>
                                    items.map((g) =>
                                      g.id === ghost.id ? { ...g, settledAt: undefined } : g,
                                    ),
                                  );
                                }}
                              >
                                Вернуть в план
                              </button>
                            </div>
                          ) : (
                            assignments[ghost.id] && (
                              <button
                                className="secondary"
                                disabled={!!violations(ghost).length}
                                onClick={settle}
                              >
                                Подтвердить переселение
                              </button>
                            )
                          )}
                          {assignments[ghost.id] && !ghost.settledAt && (
                            <div className="pin-control">
                              <button
                                className={
                                  'pin-button ' + (pinned.includes(ghost.id) ? 'is-pinned' : '')
                                }
                                aria-pressed={pinned.includes(ghost.id)}
                                onClick={() => {
                                  setUndo(structuredClone(currentSession));
                                  const locked = pinned.includes(ghost.id);
                                  setPinned((ids) =>
                                    locked
                                      ? ids.filter((id) => id !== ghost.id)
                                      : [...ids, ghost.id],
                                  );
                                  setMessage(
                                    locked
                                      ? 'Закрепление снято. Следующий подбор может изменить этот адрес.'
                                      : 'Назначение закреплено. Автоподбор сохранит этот адрес.',
                                  );
                                }}
                              >
                                {pinned.includes(ghost.id)
                                  ? '🔒 Закреплено вручную'
                                  : '🔓 Закрепить назначение'}
                              </button>
                              <small>
                                {pinned.includes(ghost.id)
                                  ? 'Автоподбор сохранит адрес. Нажмите, чтобы снять замочек.'
                                  : 'Автоподбор может изменить адрес.'}
                              </small>
                            </div>
                          )}
                          <h3>
                            {places.find((p) => p.id === assignments[ghost.id])?.name ??
                              'Место пока не назначено'}
                          </h3>
                          {assignments[ghost.id] ? (
                            <>
                              <ComfortPanel
                                ghost={ghost}
                                place={places.find((p) => p.id === assignments[ghost.id])!}
                                today={today}
                              />
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
                          {(!assignments[ghost.id] ||
                            places.every(
                              (p) => relocation.conflicts(ghost, p, assignments, today).length > 0,
                            )) && (
                            <div className="ideal-action">
                              <button
                                className="primary ideal-button"
                                onClick={() => createIdealPlace(ghost)}
                              >
                                🪄 Создать идеальное место для {ghost.name}
                              </button>
                              {ghost.deadline < today && !ghost.settledAt && (
                                <p className="deadline-note">
                                  Дедлайн просрочен. Новый адрес не изменит срок: продлите его в
                                  заявке перед подбором.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <label className="manual-label">
                          Изменить место вручную
                          <select
                            disabled={!!ghost.settledAt}
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
                        {target && target !== assignments[ghost.id] && (
                          <div className="candidate">
                            {(() => {
                              const p = places.find((p) => p.id === target)!;
                              const c = relocation.conflicts(ghost, p, assignments, today);
                              return (
                                <>
                                  <ComfortPanel ghost={ghost} place={p} today={today} />
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
                        <button
                          className="secondary wide"
                          onClick={choose}
                          disabled={!!ghost.settledAt}
                        >
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
                    )}
                  </>
                ) : (
                  <div className="empty">
                    <h2 ref={detailHeading} tabIndex={-1}>
                      Выберите заявку
                    </h2>
                    <p>Здесь появятся условия, объяснение и ручное назначение.</p>
                  </div>
                )}
              </aside>
            </div>
            {scenarioPending && (
              <section className="notice danger" aria-label="Подтверждение демосценария">
                <strong>Заменить {ghosts.length} заявок и назначения?</strong>
                <p>
                  Демосценарий заменит рабочий список и замочки. Места сохранятся. Последнее
                  действие можно отменить.
                </p>
                <button
                  className="danger-button"
                  onClick={() => {
                    if (mayLeave()) scenario(scenarioPending);
                  }}
                >
                  Загрузить сценарий
                </button>
                <button onClick={() => setScenarioPending(null)}>Отмена</button>
              </section>
            )}
            <section className="scenario">
              <div>
                <h3>Проверить крайние случаи</h3>
                <p>Сценарий заменяет заявки и назначения. Добавленные места сохраняются.</p>
              </div>
              <div className="scenario-buttons">
                <button onClick={() => setScenarioPending('demo')}>Исходные данные</button>
                <button onClick={() => setScenarioPending('empty')}>Пустой список</button>
                <button onClick={() => setScenarioPending('full')}>Переполнение</button>
                <button onClick={() => setScenarioPending('conflict')}>Конфликт условий</button>
              </div>
            </section>
          </>
        )}
        {tab === 'Места' && (
          <section>
            <div className="section-heading places-heading">
              <h2>Места обитания · {places.length}</h2>
              <button
                ref={newPlaceButton}
                className="primary"
                aria-expanded={showPlaceForm}
                onClick={() => {
                  if (!mayLeave()) return;
                  if (showPlaceForm) finishForm(newPlaceButton.current);
                  else setDirty(false);
                  if (!showPlaceForm) {
                    setEditingPlace(null);
                    setIdealFor(null);
                    setPlaceInitial(undefined);
                    setPlaceFormVersion((v) => v + 1);
                  }
                  setShowPlaceForm(!showPlaceForm);
                }}
              >
                {showPlaceForm ? 'Закрыть форму' : '+ Новое место'}
              </button>
            </div>
            {showPlaceForm && (
              <PlaceForm
                key={placeFormVersion}
                initialData={placeInitial}
                editing={!!editingPlace}
                existingPlaces={places}
                onDirty={() => setDirty(true)}
                onCancel={() => {
                  if (!mayLeave()) return;
                  setShowPlaceForm(false);
                  finishForm(newPlaceButton.current);
                }}
                onAdd={(p) => {
                  if (editingPlace) {
                    setUndo(structuredClone(currentSession));
                    setPlaces((items) => items.map((item) => (item.id === p.id ? p : item)));
                    setEditingPlace(null);
                    setShowPlaceForm(false);
                    finishForm(newPlaceButton.current);
                    setMessage(
                      'Место обновлено. Совместимость жильцов пересчитана; проверьте конфликты.',
                    );
                    return;
                  }
                  if (
                    !availableLocations(places).some(
                      (location) => location.image === placeImageKey(p),
                    )
                  ) {
                    setError('Эта локация уже добавлена. Выберите другую.');
                    return;
                  }
                  if (places.length >= 50) {
                    setError('Можно добавить до 50 мест.');
                    return;
                  }
                  setUndo(structuredClone(currentSession));
                  setPlaces((ps) => [...ps, p]);
                  if (idealFor) setCreatedIdealPlace(p.id);
                  setShowPlaceForm(false);
                  finishForm(newPlaceButton.current);
                  setMessage(
                    idealFor
                      ? 'Дом сохранён. Проверьте условия и назначьте его заявке.'
                      : 'Место добавлено. Перейдите в заявки и повторите подбор, чтобы использовать новый адрес.',
                  );
                }}
              />
            )}
            {idealFor &&
              createdIdealPlace &&
              ghosts.some((g) => g.id === idealFor) &&
              !showPlaceForm &&
              places.some((p) => p.id === createdIdealPlace) && (
                <IdealPlaceAction
                  ghost={ghosts.find((g) => g.id === idealFor)!}
                  place={places.find((p) => p.id === createdIdealPlace)!}
                  assignments={assignments}
                  today={today}
                  onOpenRequest={(id) => {
                    if (!select(id, true)) return;
                    setTab('Заявки');
                    setIdealFor(null);
                    setCreatedIdealPlace(null);
                  }}
                  onAssign={(id, placeId) => {
                    const currentGhost = ghosts.find((g) => g.id === id);
                    const currentPlace = places.find((p) => p.id === placeId);
                    if (
                      !currentGhost ||
                      !currentPlace ||
                      currentGhost.settledAt ||
                      relocation.conflicts(currentGhost, currentPlace, assignments, todayISO())
                        .length ||
                      !mayLeave()
                    )
                      return;
                    apply(id, placeId);
                    select(id, true, true);
                    setTarget(placeId);
                    setTab('Заявки');
                    setIdealFor(null);
                    setCreatedIdealPlace(null);
                  }}
                />
              )}
            {deletingPlace && (
              <section className="notice danger" aria-label="Подтверждение удаления места">
                <strong>Удалить «{deletingPlace.name}»?</strong>
                <p>
                  Назначений будет снято: {occupied(deletingPlace.id)}. Жильцы вернутся в план без
                  адреса и замочка. Иллюстрация снова станет доступна.
                </p>
                <button
                  className="danger-button"
                  onClick={() => {
                    if (!mayLeave()) return;
                    finishForm(newPlaceButton.current);
                    const ids = ghosts
                      .filter((g) => assignments[g.id] === deletingPlace.id)
                      .map((g) => g.id);
                    setUndo(structuredClone(currentSession));
                    setPlaces((items) => items.filter((p) => p.id !== deletingPlace.id));
                    setGhosts((items) =>
                      items.map((g) => (ids.includes(g.id) ? { ...g, settledAt: undefined } : g)),
                    );
                    setAssignments((items) =>
                      Object.fromEntries(Object.entries(items).filter(([id]) => !ids.includes(id))),
                    );
                    setPinned((items) => items.filter((id) => !ids.includes(id)));
                    if (selected && ids.includes(selected)) setTarget('');
                    setDeletingPlace(null);
                    setPending(null);
                    setShowPlaceForm(false);
                    setMessage('Место удалено. Назначения сняты; действие можно отменить.');
                  }}
                >
                  Да, удалить место
                </button>
                <button onClick={() => setDeletingPlace(null)}>Отмена</button>
              </section>
            )}
            <div className="places-grid">
              {places.map((p) => (
                <article className="place" key={p.id}>
                  <div className="place-art">
                    <ArtImage
                      src={placeImageUrl(p)}
                      alt={p.name}
                      sizes="(max-width: 700px) 90vw, 480px"
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
                    <section className="residents" aria-label={`Текущие жильцы: ${p.name}`}>
                      <h3>Текущие жильцы</h3>
                      {ghosts.some((g) => assignments[g.id] === p.id) ? (
                        <ul>
                          {ghosts
                            .filter((g) => assignments[g.id] === p.id)
                            .map((g) => (
                              <li key={g.id}>
                                <button
                                  className="resident"
                                  onClick={() => {
                                    if (!select(g.id, true)) return;
                                    setTab('Заявки');
                                  }}
                                >
                                  <ArtImage src={portraitUrl(g)} alt="" width="36" height="36" />
                                  <span>{g.name}</span>
                                </button>
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="residents-empty">Пока никто не заселен</p>
                      )}
                    </section>
                    <div className="form-actions place-actions">
                      <button
                        className="secondary"
                        onClick={() => {
                          if (!mayLeave()) return;
                          setDirty(false);
                          setEditingPlace(p);
                          setPlaceInitial(p);
                          setPlaceFormVersion((v) => v + 1);
                          setShowPlaceForm(true);
                        }}
                      >
                        Изменить место
                      </button>
                      <button
                        className="text-button delete-action"
                        onClick={() => setDeletingPlace(p)}
                      >
                        Удалить место
                      </button>
                    </div>
                    <p>{p.description}</p>
                    <dl className="facts">
                      <div>
                        <dt>Температура</dt>
                        <dd>{p.temperature} °C</dd>
                      </div>
                      <div>
                        <dt>Освещение</dt>
                        <dd>
                          {p.light}/100 · {p.light <= 30 ? 'темно' : 'светло'}
                        </dd>
                      </div>
                      <div>
                        <dt>Шум</dt>
                        <dd>
                          {p.noise}/100 · {p.noise <= 30 ? 'тихо' : 'шумно'}
                        </dd>
                      </div>
                      <div>
                        <dt>Влажность</dt>
                        <dd>
                          {p.humidity}/100 · {p.humidity >= 65 ? 'сыро' : 'сухо'}
                        </dd>
                      </div>
                      <div>
                        <dt>Люди</dt>
                        <dd>{p.people ? 'Есть' : 'Нет'}</dd>
                      </div>
                      <div>
                        <dt>Зеркала</dt>
                        <dd>{p.mirrors ? 'Есть' : 'Нет'}</dd>
                      </div>
                      <div>
                        <dt>Чердак</dt>
                        <dd>{p.attic ? 'Есть' : 'Нет'}</dd>
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
          <ReportView
            ghosts={ghosts}
            places={places}
            assignments={assignments}
            pinned={pinned}
            today={today}
            onOpenRequest={(id) => {
              if (!select(id, true)) return;
              setTab('Заявки');
            }}
          />
        )}
        {tab === 'Смена' && <ShiftGame />}
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
            при распределении. Ручной выбор автоматически закрепляется замочком. Подбор сохраняет
            закреплённые назначения, включая конфликты, и учитывает их вместимость. Снимите замочек,
            чтобы разрешить переназначение.
          </p>
        </details>
        <footer>
          Тихий адрес <span>Бюро переселения привидений</span>
        </footer>
      </main>
    </div>
  );
}
