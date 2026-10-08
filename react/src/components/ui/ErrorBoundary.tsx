import React from 'react';
import { unexpected } from '../../lib/faults';
import { isChunkLoadError, shouldReloadForChunk, sessionStore } from '../../lib/chunkRecovery';
import { forceReloadForUpdate } from '../../lib/pwa';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  /** W6 (FE-UIS-12): resets so far. A second "Try Again" reloads, because re-rendering re-throws. */
  private resets = 0;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // E2E-only: the synthetic error page (pages/__e2e__ErrorTest.tsx) throws
    // until this signal is set, so "Try Again" can recover it. Scoped strictly
    // to that one marker message — real errors never set the flag.
    if (error?.message === 'E2E-test-intentional-throw') {
      (window as unknown as { __e2e_error_recovered?: boolean }).__e2e_error_recovered = true;
      return;
    }
    // W6 (audit FE-UIS-12): a crash used to leave no trace at all. It is recorded on the app's
    // fault channel (the error only; no component state, no financial data).
    unexpected(error, 'render:ErrorBoundary');
    // A chunk from an older build: reload once to fetch the new one.
    if (isChunkLoadError(error) && shouldReloadForChunk(sessionStore(), Date.now())) void forceReloadForUpdate();
  }

  handleReset = () => {
    if (this.resets >= 1) { window.location.reload(); return; }
    this.resets += 1;
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div role="alert" className="flex flex-col items-center justify-center min-h-screen bg-bg text-ink p-8">
          <div className="display-italic text-3xl text-coral mb-2">Something broke</div>
          <div className="mono-label mb-4">Your data is safe locally. Try refreshing the page or contact support if the issue persists.</div>
          <button className="btn btn-primary" onClick={this.handleReset}>Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
