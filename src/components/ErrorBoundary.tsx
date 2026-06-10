import React from 'react';

export class ErrorBoundary extends React.Component<{children: React.ReactNode, fallback?: (err: Error) => React.ReactNode}, {error: Error | null}> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return this.props.fallback ? this.props.fallback(this.state.error) : <div className="p-4 text-red-500 overflow-auto"><pre>{(this.state.error as Error).message}{'\n'}{(this.state.error as Error).stack}</pre></div>;
    return this.props.children;
  }
}
