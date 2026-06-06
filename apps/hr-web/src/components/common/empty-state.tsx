import * as React from 'react';
import { Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  to?: string;
}

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

/**
 * Fusion-styled empty state: icon medallion, title, supporting copy, optional CTA.
 * Use when a query succeeds but returns no records.
 */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/60 bg-white/40 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 text-indigo-500">
        <Icon className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-bold text-slate-800">{title}</p>
        {description ? <p className="mx-auto max-w-md text-sm text-slate-500">{description}</p> : null}
      </div>
      {action ? (
        action.to ? (
          <Button asChild className="mt-1 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-500/25">
            <Link to={action.to}>{action.label}</Link>
          </Button>
        ) : (
          <Button
            onClick={action.onClick}
            className="mt-1 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-500/25"
          >
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  );
}
