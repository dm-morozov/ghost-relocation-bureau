// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ReportView from './ReportView';
import { createReport, reportJSON, reportMarkdown, type ReportInput } from './report';
import type { Ghost, Place } from './domain';

const ghost: Ghost = {
  id: 'g1',
  name: 'Мира | Тихая',
  anxiety: 2,
  temperature: 10,
  deadline: '2026-10-20',
  conditions: ['quiet'],
};
const place: Place = {
  id: 'p1',
  name: 'Тихий замок',
  description: '',
  capacity: 2,
  temperature: 10,
  noise: 10,
  light: 20,
  humidity: 50,
  people: false,
  mirrors: false,
  attic: true,
  maxAnxiety: 10,
};
function input(overrides: Partial<ReportInput> = {}): ReportInput {
  return {
    ghosts: [ghost],
    places: [place],
    assignments: { g1: 'p1' },
    pinned: ['g1'],
    today: '2026-10-18',
    ...overrides,
  };
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('данные отчёта', () => {
  it('делит заявки на непересекающиеся категории, а вместимость считает отдельно', () => {
    const report = createReport(
      input({
        ghosts: [ghost, { ...ghost, id: 'g2', conditions: ['noPeople'] }, { ...ghost, id: 'g3' }],
        places: [{ ...place, people: true }],
        assignments: { g1: 'p1', g2: 'p1' },
      }),
    );
    expect([report.successful, report.conflicted, report.unassigned]).toEqual([1, 1, 1]);
    expect(report.successful + report.conflicted + report.unassigned).toBe(report.total);
    expect(report.requests[1].explanation).toContain('Без людей');
    expect(report.requests[2].explanation).toContain('Нет свободных мест');
    expect([report.occupied, report.capacity, report.available, report.overload]).toEqual([
      2, 2, 0, 0,
    ]);
  });
  it('не теряет переполнение и учитывает свободные места в других зданиях', () => {
    const report = createReport(
      input({
        ghosts: [ghost, { ...ghost, id: 'g2' }],
        places: [
          { ...place, capacity: 1 },
          { ...place, id: 'p2', capacity: 3 },
        ],
        assignments: { g1: 'p1', g2: 'p1' },
      }),
    );
    expect([
      report.conflicted,
      report.occupied,
      report.capacity,
      report.available,
      report.overload,
    ]).toEqual([2, 2, 4, 3, 1]);
    expect(report.occupancy[0].available).toBe(0);
    expect(reportMarkdown(report)).toContain('сверх вместимости: 1');
  });
  it('генерирует пустой отчёт и не показывает NaN в интерфейсе', () => {
    const data = input({ ghosts: [], places: [], assignments: {}, pinned: [] });
    const report = createReport(data);
    expect(report.total).toBe(0);
    expect(reportMarkdown(report)).toContain('Заявок нет.');
    render(<ReportView {...data} onOpenRequest={vi.fn()} />);
    expect(screen.getByText('Заявок нет. Отчёт пуст.')).toBeTruthy();
    expect(document.body.textContent).not.toContain('NaN');
  });
  it('экспортирует все строки и закрепления, экранируя Markdown', () => {
    const report = createReport(input());
    const json = JSON.parse(reportJSON(report));
    expect(json.format).toBe('quiet-address-report');
    expect(json.requests[0]).toMatchObject({ name: ghost.name, pinned: true, place: place.name });
    expect(reportMarkdown(report)).toContain('Мира \\| Тихая');
    expect(reportMarkdown(report)).toContain('(закреплено)');
    expect(reportMarkdown(report)).toContain('2026-10-18');
  });
});

describe('оператор работает с отчётом', () => {
  it('копирует сводку и запускает печать, открывает выбранную заявку', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const open = vi.fn();
    render(<ReportView {...input()} onOpenRequest={open} />);
    fireEvent.click(screen.getByRole('button', { name: 'Копировать сводку' }));
    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      'Сводка скопирована в Markdown.',
    );
    expect(writeText).toHaveBeenCalledWith(reportMarkdown(createReport(input())));
    fireEvent.click(screen.getByRole('button', { name: 'Печать / Сохранить в PDF' }));
    expect(print).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: `Открыть заявку: ${ghost.name}` }));
    expect(open).toHaveBeenCalledWith('g1');
    expect(screen.getByRole('table').querySelector('thead')).toBeTruthy();
    expect(screen.getByText('Проверил(а): ____________________')).toBeTruthy();
  });
  it('сохраняет доступную сводку при запрете Clipboard API', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    render(<ReportView {...input()} onOpenRequest={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Копировать сводку' }));
    const fallback = await screen.findByLabelText('Сводка для ручного копирования');
    expect((fallback as HTMLTextAreaElement).value).toContain('# Тихий адрес');
    expect((fallback as HTMLTextAreaElement).readOnly).toBe(true);
    expect(screen.getByRole('status').textContent).toContain(
      'Автоматическое копирование недоступно',
    );
  });
});
