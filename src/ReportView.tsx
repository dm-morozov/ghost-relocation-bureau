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
        <div className="report-letterhead-brand">
          <img src={`${import.meta.env.BASE_URL}brand/mark-64.png`} alt="" width={48} height={48} />
          <div>
            <p className="eyebrow">Бюро переселения привидений</p>
            <h2>Тихий адрес · отчёт</h2>
          </div>
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
      <section className="report-progress" aria-label="Ход переселения">
        <h3>Ход переселения</h3>
        <dl className="report-metrics">
          <div>
            <dt>Назначено адресов</dt>
            <dd>{report.assigned}</dd>
          </div>
          <div>
            <dt>Переселено</dt>
            <dd>{report.settled}</dd>
          </div>
          <div>
            <dt>Ожидает переезда</dt>
            <dd>{report.planned}</dd>
          </div>
          <div>
            <dt>Без места</dt>
            <dd>{report.unassigned}</dd>
          </div>
        </dl>
        <p className="report-disclaimer">
          Назначено адресов = переселено + ожидает переезда. Переселение учитывается после
          подтверждения и при наличии адреса. Конфликты могут быть у назначенных заявок, в том числе
          уже переселённых, и не прибавляются к этим показателям.
        </p>
      </section>
      <section className="report-attention" aria-label="Требуют внимания">
        <h3>Требуют внимания · {report.attention.length}</h3>
        {report.attention.length ? (
          <>
            <p className="report-disclaimer">
              Сначала ближайший срок, при равном сроке — больше нарушений, затем выше тревожность.
            </p>
            <ol className="report-attention-list">
              {report.attention.map((row) => (
                <li key={row.id}>
                  <div className="report-attention-heading">
                    <strong>{row.name}</strong>
                    <span className={`report-status ${row.status}`}>
                      {reportStatus[row.status as keyof typeof reportStatus]}
                    </span>
                  </div>
                  <p>
                    Срок: <time dateTime={row.deadline}>{row.deadline}</time>
                    {' · '}Тревожность: {row.anxiety}/10
                    {row.place && <> · Адрес: {row.place}</>}
                  </p>
                  <p className="report-explanation">Причина: {row.explanation}</p>
                  <button className="text-button" onClick={() => props.onOpenRequest(row.id)}>
                    Разобрать заявку: {row.name}
                  </button>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="report-empty">
            {report.total
              ? 'Заявок с конфликтами или без места нет.'
              : 'Проблемных заявок пока нет.'}
          </p>
        )}
      </section>
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
          <div
            className="report-table-scroll"
            role="region"
            aria-label="Таблица назначений с горизонтальной прокруткой"
            tabIndex={0}
          >
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
                      {row.place && (
                        <small>
                          {row.settledAt ? `Переселено: ${row.settledAt}` : 'Ожидает переезда'}
                        </small>
                      )}
                      {!row.place && row.settledAt && (
                        <small>Есть подтверждение от {row.settledAt}, но адрес не назначен.</small>
                      )}
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
