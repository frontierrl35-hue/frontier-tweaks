import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Renderer error boundary caught:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-[var(--ft-bg)] text-[var(--ft-text-primary)]">
          <div className="ft-card p-8 max-w-md text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[rgba(248,85,95,0.12)] flex items-center justify-center">
              <AlertTriangle className="text-[var(--ft-danger)]" size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Something went wrong</h2>
              <p className="text-sm text-[var(--ft-text-secondary)] mt-1">
                Frontier Tweaks hit an unexpected error, but it's been contained. Restarting the view should fix it.
              </p>
            </div>
            <button
              onClick={() => this.setState({ error: null })}
              className="no-drag inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--ft-accent)] text-white text-sm font-medium hover:brightness-110 transition"
            >
              <RotateCcw size={15} /> Reload view
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
