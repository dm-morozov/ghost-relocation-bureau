import { useState, type ChangeEvent } from 'react';
import { makeBackup, readBackup, saveFile } from './backup';
import type { Session } from './storage';

export default function SessionTools({
  session,
  onRestore,
  blocked,
  original,
  onResume,
}: {
  session: Session;
  onRestore: (session: Session) => void;
  blocked: boolean;
  original: string | null;
  onResume: () => void;
}) {
  const [candidate, setCandidate] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const [reset, setReset] = useState(false);
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
    try {
      if (file.size > 2_000_000) throw new Error('Файл больше 2 МБ');
      setCandidate(readBackup(await file.text()));
      setError('');
    } catch {
      setCandidate(null);
      setError('Копия не прочитана: проверьте формат, версию и поля. Текущие данные сохранены.');
    }
  }
  return (
    <details className="session-tools" open={blocked || undefined}>
      <summary>Сохранение и восстановление</summary>
      <p>
        Полная резервная копия содержит заявки, адреса, назначения и замочки. Игровые смены
        сохраняются отдельно.
      </p>
      <div className="form-actions">
        <button onClick={() => download(makeBackup(session), 'quiet-address-backup.json')}>
          Скачать резервную копию
        </button>
        <label className="backup-upload">
          Восстановить из файла
          <input type="file" accept=".json,application/json" onChange={read} />
        </label>
      </div>
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
    </details>
  );
}
