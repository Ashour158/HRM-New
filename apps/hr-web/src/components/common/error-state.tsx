import { AlertTriangle, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}

function messageFromError(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const maybe = error as { message?: unknown; response?: { data?: { message?: unknown } } };
    const apiMessage = maybe.response?.data?.message;
    if (typeof apiMessage === 'string') return apiMessage;
    if (typeof maybe.message === 'string') return maybe.message;
  }
  return undefined;
}

/**
 * Fusion-styled error state with an optional retry action.
 * Use when a query fails so users see a friendly message instead of a blank page.
 */
export function ErrorState({ title = 'Something went wrong', description, error, onRetry, className }: ErrorStateProps) {
  const detail = description ?? messageFromError(error) ?? 'We could not load this content. Please try again.';
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-200/70 bg-rose-50/50 px-6 py-12 text-center',
        className,
      )}
      role="alert"
    >
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-500/15 text-rose-500">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-bold text-slate-800">{title}</p>
        <p className="mx-auto max-w-md text-sm text-slate-500">{detail}</p>
      </div>
      {onRetry ? (
        <Button
          variant="outline"
          onClick={onRetry}
          className="mt-1 gap-2 rounded-xl border-rose-200 bg-white/70 font-semibold text-rose-600 hover:bg-white"
        >
          <RotateCw className="h-4 w-4" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}
