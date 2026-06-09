import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application screen failed to render', { error, errorInfo });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-on-surface">
        <section className="w-full max-w-md rounded-xl border border-outline-variant bg-surface p-6 shadow-sm">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-error-container text-error">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="font-headline text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            The screen could not be displayed. Reload the page, then contact support if the problem continues.
          </p>
          <Button className="mt-6 w-full gap-2" type="button" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reload page
          </Button>
        </section>
      </main>
    );
  }
}
