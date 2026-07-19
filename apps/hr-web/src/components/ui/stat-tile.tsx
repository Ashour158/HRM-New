import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatTileTone = 'default' | 'alert' | 'success' | 'primary' | 'secondary' | 'info';
export type StatTileVariant = 'card' | 'glass' | 'strip' | 'plain';
export type StatTileSize = 'sm' | 'md' | 'lg';
export type StatTileIconPosition = 'leading' | 'trailing' | 'inline';

export interface StatTileProps {
  /** Icon component rendered alongside the label/value (optional). */
  icon?: React.ComponentType<{ className?: string }>;
  /** Where the icon sits relative to the label/value block. Defaults to 'trailing' when an icon is provided. */
  iconPosition?: StatTileIconPosition;
  /** Wrap the icon in a colored rounded box. Defaults to true for 'leading'/'trailing', false for 'inline'. */
  iconWrap?: boolean;
  label: React.ReactNode;
  value: React.ReactNode;
  /** Optional secondary line rendered under the value (a description, count breakdown, etc.). */
  helperText?: React.ReactNode;
  /** Semantic tone driving the icon box / value accent color. */
  tone?: StatTileTone;
  /** Outer container treatment. */
  variant?: StatTileVariant;
  /** Value text size. */
  size?: StatTileSize;
  align?: 'left' | 'center';
  /** Renders the thin gradient accent bar used by some 'card' tiles. */
  topAccent?: boolean;
  /** Disable the fusion-hover lift animation on 'glass' tiles. */
  hover?: boolean;
  /** Breakpoint at which 'strip' tiles switch from bottom borders to side borders. */
  stripBreakpoint?: 'sm' | 'md';
  className?: string;
  contentClassName?: string;
  /** Fully replaces the default label classes when provided. */
  labelClassName?: string;
  /** Fully replaces the default value classes (size/tone) when provided. */
  valueClassName?: string;
  /** Fully replaces the default helper text classes when provided. */
  helperClassName?: string;
  /** Fully replaces the default icon box classes when provided. */
  iconBoxClassName?: string;
  iconClassName?: string;
  'data-testid'?: string;
}

const VALUE_SIZE_CLASSES: Record<StatTileSize, string> = {
  sm: 'text-xl font-semibold',
  md: 'text-2xl font-bold',
  lg: 'text-3xl font-bold',
};

const TONE_VALUE_CLASSES: Record<StatTileTone, string> = {
  default: '',
  alert: 'text-amber-600',
  success: 'text-emerald-600',
  primary: 'text-primary',
  secondary: '',
  info: '',
};

const TONE_ICON_BOX_CLASSES: Record<StatTileTone, string> = {
  default: 'bg-accent text-primary',
  alert: 'bg-rose-50 text-rose-600',
  success: 'bg-emerald-50 text-emerald-600',
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-primary',
  info: 'bg-info/10 text-info',
};

const GLASS_BASE = 'fusion-glass rounded-2xl p-4';
const PLAIN_BASE = 'rounded-2xl border border-slate-200 bg-white p-4';

function stripBaseClasses(breakpoint: 'sm' | 'md') {
  return cn(
    'flex min-h-[88px] items-center gap-3 border-b border-border/50 px-4 py-4 last:border-b-0',
    breakpoint === 'sm' ? 'sm:border-b-0 sm:border-r sm:last:border-r-0' : 'md:border-b-0 md:border-r md:last:border-r-0',
  );
}

/**
 * Shared KPI/stat tile used across admin and employee dashboards: an icon,
 * a label, a value, and an optional helper line, in one of a few container
 * treatments ('card' | 'glass' | 'strip' | 'plain').
 */
export function StatTile({
  icon: Icon,
  iconPosition,
  iconWrap,
  label,
  value,
  helperText,
  tone = 'default',
  variant = 'card',
  size = 'md',
  align = 'left',
  topAccent = false,
  hover = true,
  stripBreakpoint = 'sm',
  className,
  contentClassName,
  labelClassName,
  valueClassName,
  helperClassName,
  iconBoxClassName,
  iconClassName,
  'data-testid': dataTestId,
}: StatTileProps) {
  const resolvedIconPosition: StatTileIconPosition = iconPosition ?? (Icon ? 'trailing' : 'leading');
  const resolvedIconWrap = iconWrap ?? resolvedIconPosition !== 'inline';

  const labelClasses = labelClassName ?? 'text-xs font-semibold uppercase tracking-wide text-muted-foreground';
  const valueClasses = valueClassName ?? cn(VALUE_SIZE_CLASSES[size], TONE_VALUE_CLASSES[tone]);
  const iconBoxClasses = iconBoxClassName ?? cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', TONE_ICON_BOX_CLASSES[tone]);

  const iconNode = Icon ? (
    resolvedIconWrap ? (
      <span className={iconBoxClasses}>
        <Icon className={cn('h-5 w-5', iconClassName)} />
      </span>
    ) : (
      <Icon className={cn('h-5 w-5 shrink-0 text-primary', iconClassName)} />
    )
  ) : null;

  const textBlock = (
    <div className={cn(align === 'center' && 'w-full text-center')}>
      {resolvedIconPosition === 'inline' && Icon ? (
        <div className={cn('flex items-center gap-2', align === 'center' && 'justify-center', labelClasses)}>
          <Icon className={cn('h-4 w-4', iconClassName)} />
          <span>{label}</span>
        </div>
      ) : (
        <p className={labelClasses}>{label}</p>
      )}
      <p className={cn('mt-1', valueClasses)}>{value}</p>
      {helperText ? <p className={helperClassName ?? 'mt-1 text-sm text-muted-foreground'}>{helperText}</p> : null}
    </div>
  );

  const content = resolvedIconPosition === 'inline' || !Icon ? (
    textBlock
  ) : (
    <div className={cn('flex items-center gap-3', resolvedIconPosition === 'trailing' && 'w-full justify-between')}>
      {resolvedIconPosition === 'leading' && iconNode}
      {textBlock}
      {resolvedIconPosition === 'trailing' && iconNode}
    </div>
  );

  if (variant === 'card') {
    return (
      <Card className={cn(topAccent && 'relative overflow-hidden border-transparent', className)} data-testid={dataTestId}>
        {topAccent ? (
          <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-teal-400" />
        ) : null}
        <CardContent className={cn('p-4', contentClassName)}>{content}</CardContent>
      </Card>
    );
  }

  if (variant === 'strip') {
    return (
      <div className={cn(stripBaseClasses(stripBreakpoint), className)} data-testid={dataTestId}>
        {content}
      </div>
    );
  }

  if (variant === 'plain') {
    return (
      <div className={cn(PLAIN_BASE, className)} data-testid={dataTestId}>
        {content}
      </div>
    );
  }

  return (
    <div className={cn(GLASS_BASE, hover && 'fusion-hover', className)} data-testid={dataTestId}>
      {content}
    </div>
  );
}
