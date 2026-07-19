import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function ReportStatTile({ label, value, tone, className }: { label: string; value: ReactNode; tone?: 'default' | 'warning' | 'success'; className?: string }) {
  const toneClass = tone === 'warning' ? 'text-warning-foreground' : tone === 'success' ? 'text-success' : 'text-foreground';
  return (
    <div className={cn('rounded-2xl border border-border bg-white p-4', className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-2 text-2xl font-bold', toneClass)}>{value}</p>
    </div>
  );
}
