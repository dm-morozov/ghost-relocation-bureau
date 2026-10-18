import { useEffect, useId, useRef } from 'react';
import type { AllocationPlan, AllocationChange } from './allocation-plan';
import './allocation-preview.css';

const labels: Record<AllocationChange, string> = {
  added: 'Добавлено',
  removed: 'Снято',
  moved: 'Новый адрес',
  preserved: 'Сохранено',
  unassigned: 'Без места',
};

export interface AllocationPreviewProps {
  plan: AllocationPlan;
  /** Derived from isAllocationPlanCurrent on every render; recheck again in onApply. */
  stale?: boolean;
  onApply: () => void;
  onCancel: () => void;
  returnFocusTo?: HTMLElement | null;
}

export default function AllocationPreview({
  plan,
  stale = false,
  onApply,
  onCancel,
  returnFocusTo,
}: AllocationPreviewProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const previous = returnFocusTo ?? document.activeElement;
    const element = dialog.current;
    element?.showModal();
    cancel.current?.focus();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  const { counts } = plan;
  return (
    <dialog
      ref={dialog}
      className="allocation-preview"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id={titleId}>Предпросмотр подбора</h2>
      <p id={descriptionId}>
        Проверьте адреса перед применением. Текущие назначения пока сохранены.
      </p>
      <p className="allocation-preview-summary">
        Добавлено: {counts.added} · Снято: {counts.removed} · Переназначено: {counts.moved} ·
        Сохранено: {counts.preserved} · Без места: {counts.unassigned + counts.removed}
      </p>
      <p>
        Закреплённых и завершённых сохранено: {counts.fixed}. С конфликтами: {counts.conflicts}.
      </p>
      {stale && (
        <p role="alert">Данные или дата изменились. Отмените план и запустите подбор повторно.</p>
      )}
      <ul className="allocation-preview-rows" aria-label="Изменения адресов">
        {plan.rows.map((row) => (
          <li key={row.ghostId}>
            <div className="allocation-preview-row-title">
              <strong>{row.name}</strong>
              <span>{labels[row.change]}</span>
            </div>
            {row.pinned && <p>🔒 Закреплено вручную</p>}
            {row.settledAt && <p>🔒 Переезд завершён {row.settledAt}</p>}
            <dl>
              <div>
                <dt>Старый адрес</dt>
                <dd>{row.previousAddress}</dd>
              </div>
              <div>
                <dt>Новый адрес</dt>
                <dd>{row.nextAddress}</dd>
              </div>
            </dl>
            {!!row.conflicts.length && (
              <p className="allocation-preview-conflicts">Конфликты: {row.conflicts.join('; ')}</p>
            )}
          </li>
        ))}
      </ul>
      {!plan.rows.length && <p>Заявок пока нет.</p>}
      <div className="allocation-preview-actions">
        <button ref={cancel} type="button" onClick={onCancel}>
          Отмена
        </button>
        <button type="button" disabled={stale} onClick={onApply}>
          Применить план
        </button>
      </div>
    </dialog>
  );
}
