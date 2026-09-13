import {StrictMode, Component, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Filter out benign Monaco Editor cancellation errors and ResizeObserver (flow control)
function isBenign(item: any): boolean {
  if (!item) return false;
  if (typeof item === 'string') {
    return (
      item.includes('operation is manually canceled') ||
      item.includes('cancelation') ||
      item.includes('Canceled') ||
      item.includes('ResizeObserver')
    );
  }
  if (typeof item === 'object') {
    if (item.type === 'cancelation') return true;
    if (item.msg === 'operation is manually canceled') return true;
    if (
      item.message &&
      (item.message.includes('operation is manually canceled') ||
        item.message.includes('cancelation') ||
        item.message === 'Canceled' ||
        item.message.includes('ResizeObserver'))
    ) {
      return true;
    }
    if (item.name === 'Canceled' || item.name === 'CancellationError') return true;
    try {
      const str = JSON.stringify(item);
      if (str && (str.includes('operation is manually canceled') || str.includes('cancelation'))) {
        return true;
      }
    } catch {
      // Ignore JSON serialization errors
    }
  }
  return false;
}

window.addEventListener(
  'unhandledrejection',
  (event) => {
    if (isBenign(event.reason)) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    }
  },
  true
);

window.addEventListener(
  'error',
  (event) => {
    if (isBenign(event.error) || isBenign(event.message)) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    }
  },
  true
);

class ErrorBoundary extends Component<{children: ReactNode}, {error: Error | null}> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return <div style={{padding: 20, color: 'red'}}><pre>{(this.state.error as Error).message}{'\n'}{(this.state.error as Error).stack}</pre></div>;
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
