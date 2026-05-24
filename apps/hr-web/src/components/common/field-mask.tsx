import * as React from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FieldDecision } from '@/types';
import { cn } from '@/lib/utils';

interface FieldMaskProps {
  value: string | number | undefined;
  decision: FieldDecision;
  maskingRule?: string;
  reason?: string;
  className?: string;
  onStepUp?: () => void;
}

/**
 * Displays a field value based on the backend access decision.
 * - VISIBLE: shows full value
 * - MASKED: shows masked value
 * - HIDDEN: shows placeholder
 * - REQUIRES_STEP_UP: shows lock icon with step-up button
 */
export function FieldMask({
  value,
  decision,
  maskingRule,
  reason,
  className,
  onStepUp,
}: FieldMaskProps) {
  const [showUnmasked, setShowUnmasked] = React.useState(false);

  const renderMaskedValue = (): string => {
    if (value === undefined || value === null) return '-';
    const str = String(value);
    switch (maskingRule) {
      case 'LAST_4':
        return `****${str.slice(-4)}`;
      case 'FIRST_4':
        return `${str.slice(0, 4)}****`;
      case 'CURRENCY_MASK':
        return '$XX,XXX.XX';
      case 'EMAIL_MASK': {
        const [local, domain] = str.split('@');
        return `${local.charAt(0)}***@${domain}`;
      }
      case 'PHONE_MASK':
        return `(***) ***-${str.slice(-4)}`;
      default:
        return str.length > 4 ? `${str.slice(0, 2)}****${str.slice(-2)}` : '****';
    }
  };

  if (decision === 'HIDDEN') {
    return (
      <span className={cn('text-muted-foreground italic', className)} aria-label="Access denied">
        ••••
      </span>
    );
  }

  if (decision === 'REQUIRES_STEP_UP') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-muted-foreground">Restricted</span>
        {onStepUp && (
          <Button variant="ghost" size="sm" onClick={onStepUp} aria-label="Step up authentication">
            Unlock
          </Button>
        )}
        {reason && <span className="text-xs text-muted-foreground">({reason})</span>}
      </div>
    );
  }

  if (decision === 'MASKED') {
    const masked = renderMaskedValue();
    return (
      <span className={cn('font-mono', className)}>
        {showUnmasked ? String(value) : masked}
        <Button
          variant="ghost"
          size="sm"
          className="ml-1 h-6 w-6 p-0"
          onClick={() => setShowUnmasked(!showUnmasked)}
          aria-label={showUnmasked ? 'Hide value' : 'Show value'}
        >
          {showUnmasked ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </Button>
        {reason && <span className="ml-2 text-xs text-muted-foreground">({reason})</span>}
      </span>
    );
  }

  // VISIBLE
  return <span className={className}>{value !== undefined && value !== null ? String(value) : '-'}</span>;
}
