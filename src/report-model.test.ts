import { describe, expect, it } from 'vitest';
import type { Ghost, Place } from './domain';
import {
  attentionSortDescription,
  createReport,
  reportJSON,
  reportMarkdown,
  type ReportInput,
} from './report';

const ghost: Ghost = {
  id: 'g1',
  name: 'Мира',
  anxiety: 2,
  temperature: 10,
  deadline: '2026-10-20',
  conditions: [],
};
const place: Place = {
  id: 'p1',
  name: 'Замок',
  description: '',
  capacity: 10,
  temperature: 10,
  noise: 10,
  light: 20,
  humidity: 50,
  people: false,
  mirrors: false,
  attic: true,
  maxAnxiety: 10,
};
const input = (overrides: Partial<ReportInput> = {}): ReportInput => ({
  ghosts: [ghost],
  places: [place],
  assignments: { g1: 'p1' },
  pinned: [],
  today: '2026-10-18',
  ...overrides,
});

describe('F2: назначения, переезды и очередь внимания', () => {
  it('возвращает нулевые счётчики и пустые списки для пустой сессии', () => {
    const report = createReport(input({ ghosts: [], places: [], assignments: {} }));
    expect(report).toMatchObject({
      total: 0,
      assigned: 0,
      settled: 0,
      planned: 0,
      successful: 0,
      conflicted: 0,
      unassigned: 0,
      attention: [],
      requests: [],
    });
    expect(reportMarkdown(report)).toContain('Завершено (из назначенных): 0');
    expect(JSON.parse(reportJSON(report)).settled).toBe(0);
  });

  it('не выдаёт назначенный адрес за состоявшийся переезд', () => {
    const report = createReport(input());
    expect(report).toMatchObject({ assigned: 1, settled: 0, planned: 1, successful: 1 });
    expect(report.requests[0]).toMatchObject({ anxiety: 2, settledAt: null });
    expect(report.attention).toEqual([]);
    expect(reportMarkdown(report)).toContain('Ожидает переезда (из назначенных): 1');
  });

  it('учитывает завершённый переезд даже при конфликте текущего адреса', () => {
    const report = createReport(
      input({
        ghosts: [{ ...ghost, conditions: ['noPeople'], settledAt: '2026-10-17' }],
        places: [{ ...place, people: true }],
      }),
    );
    expect(report).toMatchObject({
      assigned: 1,
      settled: 1,
      planned: 0,
      successful: 0,
      conflicted: 1,
    });
    expect(report.attention.map((row) => row.id)).toEqual(['g1']);
    expect(reportMarkdown(report)).toContain('| Конфликт | 2026-10-17 |');
    expect(JSON.parse(reportJSON(report))).toMatchObject({
      assigned: 1,
      settled: 1,
      planned: 0,
      conflicted: 1,
    });
  });

  it('не считает переезд завершённым без существующего адреса', () => {
    const report = createReport(
      input({
        ghosts: [
          { ...ghost, settledAt: '2026-10-17' },
          { ...ghost, id: 'g2' },
        ],
        assignments: { g1: 'deleted-place' },
      }),
    );
    expect(report).toMatchObject({ assigned: 0, settled: 0, planned: 0, unassigned: 2 });
    expect(report.requests[0].settledAt).toBe('2026-10-17');
    expect(report.attention).toHaveLength(2);
    expect(reportMarkdown(report)).not.toContain('| 2026-10-17 |');
  });

  it('сохраняет суммы и отдельный смысл конфликтов в смешанной сессии и JSON', () => {
    const report = createReport(
      input({
        ghosts: [
          ghost,
          { ...ghost, id: 'g2', settledAt: '2026-10-17', conditions: ['noPeople'] },
          { ...ghost, id: 'g3' },
          { ...ghost, id: 'g4', settledAt: '2026-10-17' },
        ],
        places: [{ ...place, people: true }],
        assignments: { g1: 'p1', g2: 'p1', g4: 'missing' },
      }),
    );
    expect([
      report.assigned,
      report.settled,
      report.planned,
      report.unassigned,
      report.conflicted,
    ]).toEqual([2, 1, 1, 2, 1]);
    for (const data of [report, JSON.parse(reportJSON(report))]) {
      expect(data.assigned + data.unassigned).toBe(data.total);
      expect(data.settled + data.planned).toBe(data.assigned);
      expect(data.successful + data.conflicted).toBe(data.assigned);
    }
    const markdown = reportMarkdown(report);
    for (const text of [
      'Назначено: 2',
      'Завершено (из назначенных): 1',
      'Ожидает переезда (из назначенных): 1',
      'Без места: 2',
      'С конфликтами (из назначенных): 1',
    ]) {
      expect(markdown).toContain(text);
    }
  });

  it('сортирует по дедлайну, числу нарушений, тревожности и ID независимо от порядка входа', () => {
    const ghosts: Ghost[] = [
      {
        ...ghost,
        id: 'later',
        deadline: '2026-10-21',
        anxiety: 10,
        conditions: ['noPeople', 'noMirrors'],
      },
      { ...ghost, id: 'b', anxiety: 8, conditions: ['noPeople'] },
      { ...ghost, id: 'unassigned', anxiety: 10 },
      { ...ghost, id: 'low', anxiety: 1, conditions: ['noPeople'] },
      { ...ghost, id: 'a', anxiety: 8, conditions: ['noPeople'] },
      { ...ghost, id: 'many', anxiety: 1, conditions: ['noPeople', 'noMirrors'] },
      { ...ghost, id: 'ok' },
      { ...ghost, id: 'early', deadline: '2026-10-19' },
    ];
    const assignments = Object.fromEntries(
      ghosts
        .filter((row) => !['unassigned', 'early'].includes(row.id))
        .map((row) => [row.id, 'p1']),
    );
    const data = input({
      ghosts,
      assignments,
      places: [{ ...place, people: true, mirrors: true }],
    });
    const report = createReport(data);
    const expected = ['early', 'many', 'a', 'b', 'low', 'unassigned', 'later'];
    expect(report.attention.map((row) => row.id)).toEqual(expected);
    expect(
      createReport({ ...data, ghosts: [...ghosts].reverse() }).attention.map((row) => row.id),
    ).toEqual(expected);
    expect(report.requests.map((row) => row.id)).toEqual(ghosts.map((row) => row.id));
    expect(JSON.parse(reportJSON(report)).attention.map((row: { id: string }) => row.id)).toEqual(
      expected,
    );
    expect(reportMarkdown(report)).toContain(attentionSortDescription);
  });

  it('экранирует таблицы, HTML и переносы в Markdown, сохраняя исходные строки в JSON', () => {
    const name = 'Имя \\ | <script>\r\n& текст';
    const address = 'Адрес | <дом>\nэтаж';
    const report = createReport(
      input({
        ghosts: [{ ...ghost, name }],
        places: [{ ...place, name: address }],
        pinned: ['g1'],
      }),
    );
    const markdown = reportMarkdown(report);
    expect(markdown).toContain('Имя \\\\ \\| &lt;script&gt; &amp; текст');
    expect(markdown).toContain('Адрес \\| &lt;дом&gt; этаж (закреплено)');
    expect(markdown).not.toContain('<script>');
    expect(JSON.parse(reportJSON(report)).requests[0]).toMatchObject({
      name,
      place: address,
      pinned: true,
    });
  });
});
