import { useId } from 'react';
import type { StorageSyncState } from './storage-sync';
import './storage-sync.css';

export interface StorageConflictProps {
  state: StorageSyncState;
  subject: string;
  onLoadFresh: () => void;
  onDownloadLocal: () => void;
}

export default function StorageConflict({
  state,
  subject,
  onLoadFresh,
  onDownloadLocal,
}: StorageConflictProps) {
  const heading = useId();
  if (state.status === 'ready') return null;
  return (
    <section className="storage-conflict" role="alert" aria-labelledby={heading}>
      <h3 id={heading}>Автосохранение приостановлено · {subject}</h3>
      <p>
        {state.status === 'unavailable'
          ? 'Хранилище браузера недоступно. Текущая работа остаётся в этой вкладке.'
          : state.status === 'invalid'
            ? 'Сохранённая версия повреждена или имеет неизвестный формат. Она оставлена без изменений.'
            : state.remoteRaw === null
              ? 'Сохранение удалено в другой вкладке. Текущая работа остаётся здесь.'
              : 'Сохранение изменилось в другой вкладке. Текущая работа остаётся здесь.'}
      </p>
      <p>
        Скачайте локальную копию перед загрузкой свежей версии: загрузка заменит данные в этой
        вкладке. Скачивание не возобновляет запись.
      </p>
      <div className="storage-conflict-actions">
        <button type="button" onClick={onDownloadLocal}>
          Скачать локальную копию
        </button>
        <button type="button" onClick={onLoadFresh}>
          Загрузить свежую версию
        </button>
      </div>
    </section>
  );
}
