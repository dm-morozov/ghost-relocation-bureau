import { useId, useState, type ChangeEvent } from 'react';
import { makeBackup, preserveSavedSession, readBackup, recoveryKey, saveFile } from './backup';
import type { Session } from './storage';
import './session-tools.css';

export default function SessionTools({
  session,
  onRestore,
  blocked,
  original,
  onResume,
  canReplace = () => true,
}: {
  session: Session;
  onRestore: (session: Session) => void;
  blocked: boolean;
  original: string | null;
  onResume: () => void;
  canReplace?: () => boolean;
}) {
  const exportHeading = useId();
  const importHeading = useId();
  const fileHint = useId();
  const [fileName, setFileName] = useState('');
  const [candidate, setCandidate] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const [reset, setReset] = useState(false);
  const [recovery, setRecovery] = useState<string | null>(() => {
    try {
      return localStorage.getItem(recoveryKey);
    } catch {
      return null;
    }
  });
  function preserveOriginal() {
    if (!canReplace()) {
      setError(
        'Сохранение изменилось или недоступно. Скачайте локальную копию и загрузите свежую версию.',
      );
      return false;
    }
    if (!blocked) return true;
    try {
      const saved = preserveSavedSession();
      if (saved !== null) setRecovery(saved);
      setError('');
      return true;
    } catch {
      setError(
        'Не удалось сохранить исходные данные для восстановления. Замена отменена; исходная сессия не изменена. Скачайте исходные данные и освободите место в браузере.',
      );
      return false;
    }
  }
  function download(text: string, filename: string) {
    try {
      saveFile(text, filename);
      setError('');
    } catch {
      setError(
        'Не удалось скачать файл. Не закрывайте страницу; попробуйте разрешить загрузку файлов в браузере.',
      );
    }
  }
  async function read(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFileName('');
    try {
      if (file.size > 2_000_000) throw new Error('Файл больше 2 МБ');
      setCandidate(readBackup(await file.text()));
      setFileName(file.name);
      setError('');
    } catch {
      setCandidate(null);
      setError('Копия не прочитана: проверьте формат, версию и поля. Текущие данные сохранены.');
    }
  }
  return (
    <details className="session-tools" open={blocked || undefined}>
      <summary>
        <span>Сохранение и восстановление</span>
        <span className="session-summary-note">На этом устройстве</span>
        <span className="session-disclosure" aria-hidden="true" />
      </summary>
      <div className="session-body">
        <p className="session-intro">
          Сохраните работу в файл, чтобы перенести её или вернуться к ней позже. Игровые смены
          сохраняются отдельно.
        </p>
        <div className="session-actions">
          <section className="session-card" aria-labelledby={exportHeading}>
            <h3 id={exportHeading}>Сохранить копию</h3>
            <p>Все заявки, адреса, назначения и закрепления в одном файле.</p>
            <button
              className="secondary session-action"
              type="button"
              onClick={() => download(makeBackup(session), 'quiet-address-backup.json')}
            >
              Скачать резервную копию
            </button>
            <small className="session-file-hint">Полная копия · JSON</small>
          </section>
          <section className="session-card" aria-labelledby={importHeading}>
            <h3 id={importHeading}>Восстановить работу</h3>
            <p>Выберите сохранённую копию. Перед заменой данных мы попросим подтверждение.</p>
            <label className="session-file-choice">
              <span aria-hidden="true">Выбрать JSON-файл</span>
              <input
                type="file"
                aria-label="Восстановить из файла"
                aria-describedby={fileHint}
                accept=".json,application/json"
                onChange={read}
              />
            </label>
            <small className="session-file-hint" id={fileHint}>
              Формат JSON · до 2 МБ
            </small>
            {fileName && candidate && (
              <p className="session-file-name" role="status">
                Файл проверен: {fileName}
              </p>
            )}
          </section>
        </div>
        {recovery !== null && (
          <div className="session-recovery">
            <p>Исходная версия сохранена для восстановления.</p>
            <button
              className="secondary"
              type="button"
              onClick={() => download(recovery, 'quiet-address-recovery.json')}
            >
              Скачать сохранённый исходник
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="red">
            {error}
          </p>
        )}
        {candidate && (
          <section className="notice" aria-label="Подтверждение восстановления">
            <strong>Заменить текущую сессию?</strong>
            <p>
              В копии: {candidate.ghosts.length} заявок, {candidate.places.length} мест. Текущие
              данные будут заменены; перед продолжением скачайте их копию.
            </p>
            <button
              onClick={() => {
                if (!preserveOriginal()) return;
                onRestore(candidate);
                setCandidate(null);
              }}
            >
              Восстановить сессию
            </button>
            <button onClick={() => setCandidate(null)}>Отмена</button>
          </section>
        )}
        {blocked && (
          <section className="notice danger">
            <strong>Автосохранение временно приостановлено</strong>
            <p>
              Сначала скачайте исходные данные для восстановления. Работа с демоданными не меняет
              старую сессию, пока вы явно не разрешите замену.
            </p>
            {original !== null && (
              <button onClick={() => download(original, 'quiet-address-original.json')}>
                Скачать исходные данные
              </button>
            )}
            {!reset ? (
              <button onClick={() => setReset(true)}>Начать новую сессию</button>
            ) : (
              <>
                <p>Заменить старые данные текущей демосессией?</p>
                <button
                  className="danger-button"
                  onClick={() => {
                    if (!preserveOriginal()) return;
                    onResume();
                    setReset(false);
                  }}
                >
                  Да, разрешить замену
                </button>
                <button onClick={() => setReset(false)}>Отмена</button>
              </>
            )}
          </section>
        )}
      </div>
    </details>
  );
}
