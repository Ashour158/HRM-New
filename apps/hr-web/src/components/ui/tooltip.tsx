import * as React from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
}

export function Tooltip({ content, children }: TooltipProps) {
  const id = React.useId();
  return (
    <span className="group relative inline-flex">
      {React.cloneElement(children, {
        'aria-describedby': id,
      } as React.HTMLAttributes<HTMLElement>)}
      <span
        id={id}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-max max-w-xs -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs font-semibold text-popover-foreground shadow-lg',
          'group-focus-within:block group-hover:block',
        )}
      >
        {content}
      </span>
    </span>
  );
}
