import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ReportCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Small label in the corner, e.g. the data domain or "Link". */
  badge?: string;
  actionLabel: string;
  onAction: () => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * Presentational card for a single prebuilt report - the shared visual unit
 * used across My Reports, Team Reports, and (for the top templates) the
 * Organization Reports library, so all three tiers read as one product
 * surface: a named, described, one-click view instead of a raw query form.
 */
export function ReportCard({
  icon: Icon,
  title,
  description,
  badge,
  actionLabel,
  onAction,
  isLoading = false,
  className,
}: ReportCardProps) {
  return (
    <Card className={cn('flex h-full flex-col justify-between rounded-2xl border border-border bg-white/70 transition hover:border-primary/40 hover:shadow-md', className)}>
      <CardHeader className="space-y-3 p-5 pb-2">
        <div className="flex items-start justify-between gap-2">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          {badge ? <Badge variant="outline" className="bg-white text-muted-foreground">{badge}</Badge> : null}
        </div>
        <div>
          <CardTitle className="text-base font-bold text-foreground">{title}</CardTitle>
          <CardDescription className="mt-1 text-sm leading-5">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-3">
        <Button className="w-full" variant="outline" onClick={onAction} disabled={isLoading}>
          {isLoading ? 'Loading...' : actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ReportCardGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
