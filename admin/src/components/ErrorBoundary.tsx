// Audit 7.3 — a render error boundary for the admin app.
// The root previously had none: a throwing chart or editor took down the whole
// shell with a white screen. This catches render errors, shows a recoverable
// state, and keeps the failure out of the auth/nav chrome.

import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown): void {
    // Surface to the console for now; wire to an observability sink when one
    // exists (audit 10.4). Never rethrow — the boundary's job is to contain.
    // eslint-disable-next-line no-console
    console.error('[admin] render error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="panel max-w-md w-full p-6 text-center">
            <div className="display-serif text-2xl text-ink mb-2">Something broke in this view</div>
            <p className="text-ink-mid text-[0.9rem] mb-4">
              {this.state.error.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.assign('/'); }}
              className="px-4 py-2 bg-claude text-white rounded-md text-[0.88rem] hover:opacity-90 transition"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
