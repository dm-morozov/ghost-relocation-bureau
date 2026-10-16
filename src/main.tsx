import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';

class ErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="fatal">
        <h1>Не удалось открыть бюро</h1>
        <p>
          Произошла ошибка интерфейса. Перезагрузите страницу. Если ошибка повторяется, очистите
          сохранённую сессию.
        </p>
        <button
          onClick={() => {
            try {
              localStorage.removeItem('quiet-address-v1');
            } catch {
              // Reload remains available when browser storage is disabled.
            }
            location.reload();
          }}
        >
          Очистить сессию и перезагрузить
        </button>
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
