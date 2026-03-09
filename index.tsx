import React from 'react';
import ReactDOM from 'react-dom/client';
// ✅ 핵심 성능 최적화: App과 CliApp을 lazy import로 분리!
// 초기 번들에서 무거운 App.tsx 모든 의존성들(lucide-react, plugins, contexts 등)을 제외함다.
// 이렇게 하면 React 마운트 직후 즉시 LoadingSplash가 화면에 뜨고,
// 그 동안 App 번들이 백그라운드에서 로드됨다! 🐧🚀
const App = React.lazy(() => import('./App'));
const CliApp = React.lazy(() => import('./CliApp'));
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Global Error Handler for non-React errors
window.onerror = function (message, source, lineno, colno, error) {
  const errDiv = document.createElement('div');
  errDiv.style.position = 'fixed';
  errDiv.style.top = '0';
  errDiv.style.left = '0';
  errDiv.style.width = '100%';
  errDiv.style.background = 'red';
  errDiv.style.color = 'white';
  errDiv.style.padding = '20px';
  errDiv.style.zIndex = '9999';
  errDiv.innerHTML = `<h1>Global Error</h1><pre>${message}\n${source}:${lineno}:${colno}\n${error?.stack}</pre>`;
  document.body.appendChild(errDiv);
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  state: { hasError: boolean, error: any } = { hasError: false, error: null };

  constructor(props: any) {
    super(props);
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: '#333', color: '#fff', height: '100vh' }}>
          <h1>Something went wrong.</h1>
          <pre style={{ color: 'red' }}>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }

    return (this.props as any).children;
  }
}

const urlParams = new URLSearchParams(window.location.search);
const isCliMode = urlParams.get('mode') === 'cli';

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* ✅ Suspense fallback=null: App 내부의 LoadingSplash가 로딩 UI를 담당함다. 🐧 */}
      <React.Suspense fallback={null}>
        {isCliMode ? <CliApp /> : <App />}
      </React.Suspense>
    </ErrorBoundary>
  </React.StrictMode>
);
