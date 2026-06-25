import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden="true" className={cn('h-4 w-4 animate-spin', className)} />;
}

export function LoadingState({
  label = 'Loading',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground', className)} role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}
