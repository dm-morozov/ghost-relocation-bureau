import { useState } from 'react';
import { createReport, reportJSON, reportMarkdown, reportStatus, type ReportInput } from './report';
import './report.css';

export default function ReportView(props: ReportInput & { onOpenRequest: (id: string) => void }) {
  const report = createReport(props);
  const [copyMessage, setCopyMessage] = useState('');
  const [fallback, setFallback] = useState('');
  const [exportError, setExportError] = useState('');
  async function copy() {
    const markdown = reportMarkdown(report);
    try {
      await navigator.clipboard.writeText(markdown);
      setFallback('');
      setCopyMessage('Сводка скопирована в Markdown.');
    } catch {
      setCopyMessage(
        'Автоматическое копирование недоступно. Выделите текст ниже и скопируйте его.',
      );
      setFallback(markdown);
    }
  }
  function download() {
    try {
      const url = URL.createObjectURL(
        new Blob([reportJSON(report)], { type: 'application/json;charset=utf-8' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `relocation-${report.date}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportError('');
    } catch {
      setExportError('Не удалось скачать отчёт. Скопируйте сводку или сохраните её через печать.');
    }
  }
  const segments = [
    { className: 'assigned', label: 'Без нарушений', value: report.successful },
    { className: 'conflict', label: 'С конфликтами', value: report.conflicted },
    { className: 'unassigned', label: 'Без места', value: report.unassigned },
  ];
  return (
    <section className="operator-report" aria-label="Отчёт о переселении">
      <header className="report-letterhead">
        <div>
          <p className="eyebrow">Бюро переселения привидений</p>
          <h2>Тихий адрес · отчёт</h2>
        </div>
        <p>
          Состояние на <time dateTime={report.date}>{report.date}</time>
        </p>
      </header>
      <div className="report-actions">
        <button className="secondary" onClick={download}>
          Скачать JSON
        </button>
        <button className="secondary" onClick={() => void copy()}>
          Копировать сводку
        </button>
        <button className="primary" onClick={() => window.print()}>
          Печать / Сохранить в PDF
        </button>
      </div>
      {copyMessage && (
        <p className="report-feedback" role="status">
          {copyMessage}
        </p>
      )}
      {fallback && (
        <label className="report-copy-fallback">
          Сводка для ручного копирования
          <textarea readOnly value={fallback} onFocus={(event) => event.currentTarget.select()} />
        </label>
      )}
      {exportError && (
        <p className="report-feedback" role="alert">
          {exportError}
        </p>
      )}
      <p className="report-disclaimer">
        Отчёт отражает текущие назначения. Назначение с конфликтом требует решения оператора.
        JSON-отчёт не заменяет резервную копию сессии.
      </p>
      <section className="report-distribution" aria-label="Распределение заявок">
        <h3>Распределение · {report.total} заявок</h3>
        <div className="report-stacked-bar" aria-hidden="true">
          {segments.map((segment) => (
            <span
              key={segment.className}
              className={segment.className}
              style={{ width: `${report.total ? (segment.value / report.total) * 100 : 0}%` }}
            />
          ))}
        </div>
        <dl className="report-legend">
          {segments.map((segment) => (
            <div key={segment.className}>
              <dt>
                <span className={`report-dot ${segment.className}`} />
                {segment.label}
              </dt>
              <dd>
                {segment.value} ·{' '}
                {report.total ? Math.round((segment.value / report.total) * 100) : 0}%
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="report-occupancy" aria-label="Вместимость мест">
        <h3>Вместимость мест</h3>
        <p>
          Занято:{' '}
          <strong>
            {report.occupied} из {report.capacity}
          </strong>
          . Назначений сверх вместимости: <strong>{report.overload}</strong>.
        </p>
        <p>
          Свободно:{' '}
          <strong>
            {report.available} ·{' '}
            {report.capacity ? Math.round((report.available / report.capacity) * 100) : 0}%
            вместимости
          </strong>
          . Свободные места считаются отдельно от долей заявок.
        </p>
        {!report.occupancy.length && <p>Места пока не добавлены.</p>}
        {report.occupancy.map((place) => (
          <div className="report-place" key={place.id}>
            <div>
              <span>{place.name}</span>
              <strong>
                {place.occupied} / {place.capacity}
                {place.overload > 0 && (
                  <span className="report-overload"> · сверх вместимости: {place.overload}</span>
                )}
              </strong>
            </div>
            <progress
              aria-label={`Занято мест: ${place.name}`}
              value={Math.min(place.occupied, place.capacity)}
              max={place.capacity}
            />
            <small>
              Свободно: {place.available}
              {place.overload > 0 ? '. Требуется снять лишние назначения.' : ''}
            </small>
          </div>
        ))}
      </section>
      <section aria-label="Все заявки">
        <h3>Все заявки</h3>
        {!report.total ? (
          <p className="report-empty">Заявок нет. Отчёт пуст.</p>
        ) : (
          <div className="report-table-scroll">
            <table className="report-table">
              <caption>Назначения, условия и нерешённые заявки</caption>
              <thead>
                <tr>
                  <th scope="col">Привидение / срок</th>
                  <th scope="col">Адрес / статус</th>
                  <th scope="col">Пояснение</th>
                </tr>
              </thead>
              <tbody>
                {report.requests.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <span>{row.name}</span>
                      <small>До {row.deadline}</small>
                      <button className="text-button" onClick={() => props.onOpenRequest(row.id)}>
                        Открыть заявку: {row.name}
                      </button>
                    </th>
                    <td>
                      <span>{row.place ?? 'Место не назначено'}</span>
                      <strong className={`report-status ${row.status}`}>
                        {reportStatus[row.status as keyof typeof reportStatus]}
                      </strong>
                      {row.settledAt && <small>Переселено: {row.settledAt}</small>}
                      {row.pinned && <small>🔒 Закреплено вручную</small>}
                      {row.comfort !== null && <small>Комфорт: {row.comfort}/100</small>}
                    </td>
                    <td className="report-explanation">{row.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="report-signature">
        <span>Проверил(а): ____________________</span>
        <span>Дата: ____________________</span>
        <span className="report-stamp" aria-label="Декоративная метка бюро">
          Тихий адрес
          <br />
          Декоративная метка
        </span>
      </div>
    </section>
  );
}
