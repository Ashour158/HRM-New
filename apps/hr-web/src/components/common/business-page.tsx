import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BusinessPageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}

export function BusinessPageHeader({
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  actions,
  className,
}: BusinessPageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
        ) : null}
        <div className="flex items-center gap-3">
          {Icon ? (
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-primary">
              <Icon className="h-5 w-5" />
            </div>
          ) : null}
          <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        </div>
        {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

interface BusinessMetricProps {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'warning' | 'success';
}

export function BusinessMetric({ label, value, tone = 'default' }: BusinessMetricProps) {
  const toneClass = tone === 'warning'
    ? 'text-warning-foreground'
    : tone === 'success'
      ? 'text-success'
      : 'text-foreground';

  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-2 text-2xl font-bold', toneClass)}>{value}</p>
    </div>
  );
}

interface SectionHeadingProps {
  title: string;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeading({ title, actions, className }: SectionHeadingProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <h2 className="font-headline text-xl font-bold text-foreground">{title}</h2>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
