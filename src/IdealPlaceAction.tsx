import { useReducer } from 'react';
import { relocation, type Assignments, type Ghost, type Place } from './domain';
import './ideal-place-action.css';

export interface IdealPlaceActionProps {
  ghost: Ghost;
  place: Place;
  assignments: Assignments;
  today: string;
  onOpenRequest: (ghostId: string) => void;
  /** Apply a manual assignment and return to the request in the parent. */
  onAssign: (ghostId: string, placeId: string) => void;
}

export default function IdealPlaceAction({
  ghost,
  place,
  assignments,
  today,
  onOpenRequest,
  onAssign,
}: IdealPlaceActionProps) {
  // Re-render rejected clicks too: mutable inputs may have changed since rendering.
  const [, refresh] = useReducer((value: number) => value + 1, 0);
  const conflicts = relocation.conflicts(ghost, place, assignments, today);
  const reasons = ghost.settledAt
    ? ['Переселение уже завершено. Новый дом не назначен.']
    : conflicts;

  function assign() {
    const currentConflicts = relocation.conflicts(ghost, place, assignments, today);
    if (ghost.settledAt || currentConflicts.length) {
      refresh();
      return;
    }
    onAssign(ghost.id, place.id);
  }

  return (
    <section className="ideal-place-action notice" aria-label="Дом для заявки">
      <p>
        Дом «{place.name}» сохранён для заявки «{ghost.name}».
      </p>
      <div aria-live="polite" aria-atomic="true">
        {reasons.length > 0 ? (
          <>
            <p>Назначение недоступно:</p>
            <ul>
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>Условия соблюдены. Назначение закрепится вручную.</p>
        )}
      </div>
      <div className="ideal-place-action-buttons">
        <button type="button" className="primary" disabled={reasons.length > 0} onClick={assign}>
          Назначить и вернуться
        </button>
        <button type="button" className="secondary" onClick={() => onOpenRequest(ghost.id)}>
          Вернуться к заявке
        </button>
      </div>
    </section>
  );
}
