import { relocation, type Assignments, type Ghost, type Place } from './domain';

export interface ReportInput {
  ghosts: Ghost[];
  places: Place[];
  assignments: Assignments;
  pinned: readonly string[];
  today: string;
}

export function createReport({ ghosts, places, assignments, pinned, today }: ReportInput) {
  const requests = ghosts.map((ghost) => {
    const place = places.find((item) => item.id === assignments[ghost.id]);
    const conflicts = place ? relocation.conflicts(ghost, place, assignments, today) : [];
    const status = !place ? 'unassigned' : conflicts.length ? 'conflict' : 'assigned';
    const candidates = place
      ? []
      : places.map((candidate) => ({
          name: candidate.name,
          conflicts: relocation.conflicts(ghost, candidate, assignments, today),
        }));
    const explanation = place
      ? conflicts.length
        ? conflicts.join('; ')
        : relocation.evaluate(ghost, place, today).explanation
      : !places.length
        ? 'В справочнике нет мест. Добавьте место обитания.'
        : candidates.some((candidate) => !candidate.conflicts.length)
          ? 'Есть подходящий свободный адрес. Запустите подбор или назначьте его вручную.'
          : candidates
              .map((candidate) => `${candidate.name}: ${candidate.conflicts.join('; ')}`)
              .join('\n');
    return {
      id: ghost.id,
      name: ghost.name,
      anxiety: ghost.anxiety,
      deadline: ghost.deadline,
      settledAt: ghost.settledAt ?? null,
      place: place?.name ?? null,
      pinned: pinned.includes(ghost.id),
      status,
      comfort: place ? relocation.evaluate(ghost, place, today).score : null,
      conflicts,
      explanation,
    };
  });
  const occupancy = places.map((place) => {
    const occupied = ghosts.filter((ghost) => assignments[ghost.id] === place.id).length;
    return {
      id: place.id,
      name: place.name,
      capacity: place.capacity,
      occupied,
      available: Math.max(0, place.capacity - occupied),
      overload: Math.max(0, occupied - place.capacity),
    };
  });
  const assigned = requests.filter((row) => row.place !== null).length;
  const settled = requests.filter((row) => row.place !== null && row.settledAt).length;
  // ISO dates sort chronologically; the unique request ID breaks all remaining ties.
  const compareText = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);
  const attention = requests
    .filter((row) => row.status === 'conflict' || row.status === 'unassigned')
    .sort(
      (left, right) =>
        compareText(left.deadline, right.deadline) ||
        right.conflicts.length - left.conflicts.length ||
        right.anxiety - left.anxiety ||
        compareText(left.id, right.id),
    );
  return {
    date: today,
    total: requests.length,
    assigned,
    settled,
    planned: assigned - settled,
    successful: requests.filter((row) => row.status === 'assigned').length,
    conflicted: requests.filter((row) => row.status === 'conflict').length,
    unassigned: requests.filter((row) => row.status === 'unassigned').length,
    capacity: occupancy.reduce((sum, place) => sum + place.capacity, 0),
    occupied: occupancy.reduce((sum, place) => sum + place.occupied, 0),
    available: occupancy.reduce((sum, place) => sum + place.available, 0),
    overload: occupancy.reduce((sum, place) => sum + place.overload, 0),
    requests,
    attention,
    occupancy,
  };
}

export type RelocationReport = ReturnType<typeof createReport>;
export const attentionSortDescription =
  'Сначала ближайший дедлайн, затем больше нарушений, затем выше тревожность; при равенстве — ID заявки по возрастанию.';
export const reportStatus = {
  assigned: 'Назначено без нарушений',
  conflict: 'Конфликт',
  unassigned: 'Без места',
};

export function reportMarkdown(report: RelocationReport) {
  const cell = (value: string) =>
    value
      .replace(/\\/g, '\\\\')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\|/g, '\\|')
      .replace(/[\r\n]+/g, ' ');
  return [
    '# Тихий адрес — отчёт о переселении',
    `Дата: ${report.date}`,
    '',
    `Всего заявок: ${report.total}. Назначено: ${report.assigned}. Завершено (из назначенных): ${report.settled}. Ожидает переезда (из назначенных): ${report.planned}. Без места: ${report.unassigned}. С конфликтами (из назначенных): ${report.conflicted}. Назначено без нарушений: ${report.successful}.`,
    `Занято: ${report.occupied} из ${report.capacity}. Свободно: ${report.available}. Назначений сверх вместимости: ${report.overload}.`,
    '',
    '| Привидение | Адрес | Статус назначения | Переезд завершён | Дедлайн | Пояснение |',
    '| --- | --- | --- | --- | --- | --- |',
    ...report.requests.map(
      (row) =>
        `| ${cell(row.name)} | ${cell(row.place ?? '—')}${row.pinned ? ' (закреплено)' : ''} | ${reportStatus[row.status as keyof typeof reportStatus]} | ${row.place !== null && row.settledAt ? cell(row.settledAt) : '—'} | ${cell(row.deadline)} | ${cell(row.explanation)} |`,
    ),
    ...(report.total ? [] : ['Заявок нет.']),
    '',
    '## Требует внимания',
    attentionSortDescription,
    ...report.attention.map(
      (row) =>
        `- ${cell(row.name)}: ${reportStatus[row.status as keyof typeof reportStatus]}, дедлайн ${cell(row.deadline)}, нарушений: ${row.conflicts.length}, тревожность: ${row.anxiety}/10.`,
    ),
    ...(report.attention.length ? [] : ['Проблемных заявок нет.']),
    '',
    '## Вместимость мест',
    ...report.occupancy.map(
      (place) =>
        `- ${cell(place.name)}: ${place.occupied}/${place.capacity}${place.overload ? `, сверх вместимости: ${place.overload}` : ''}.`,
    ),
    '',
    'Отчёт отражает текущие назначения. Это не резервная копия сессии.',
  ].join('\n');
}

export function reportJSON(report: RelocationReport) {
  return JSON.stringify({ format: 'quiet-address-report', version: 1, ...report }, null, 2);
}
