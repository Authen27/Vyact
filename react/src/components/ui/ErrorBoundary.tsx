import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Sentry wiring placeholder:
    // Example:
    // import * as Sentry from '@sentry/react';
    // Sentry.captureException(error, { extra: errorInfo });
    // console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-screen bg-bone dark:bg-ink text-ink dark:text-bone p-8">
          <div className="display-italic text-3xl text-coral mb-2">Something broke</div>
          <div className="mono-label mb-4">Your data is safe locally. Try refreshing the page or contact support if the issue persists.</div>
          <button className="btn btn-primary" onClick={this.handleReset}>Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
