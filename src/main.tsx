import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { resetSavedSession } from './backup';
import './style.css';

class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean; confirm: boolean; error: string }
> {
  state = { failed: false, confirm: false, error: '' };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="fatal">
        <h1>Не удалось открыть бюро</h1>
        <p>Произошла ошибка интерфейса. Сначала попробуйте перезагрузить страницу.</p>
        <button onClick={() => location.reload()}>Перезагрузить страницу</button>
        <button onClick={() => this.setState({ confirm: true })}>Сбросить сессию</button>
        {this.state.confirm && (
          <section className="notice danger">
            <p>
              Начать с демоданных? Текущая сессия сначала будет скопирована в резервное хранилище
              браузера. Игровые смены останутся отдельно.
            </p>
            <button
              onClick={() => {
                try {
                  resetSavedSession();
                  location.reload();
                } catch {
                  this.setState({
                    error: 'Не удалось сохранить резервную копию. Сессия не сброшена.',
                  });
                }
              }}
            >
              Сохранить копию и сбросить
            </button>
            <button onClick={() => this.setState({ confirm: false })}>Отмена</button>
          </section>
        )}
        {this.state.error && <p role="alert">{this.state.error}</p>}
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
