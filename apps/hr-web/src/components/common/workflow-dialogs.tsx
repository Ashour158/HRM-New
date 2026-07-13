import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Reusable confirmation dialog that collects a required free-text reason
 * before an irreversible or state-changing workflow action (terminate,
 * suspend, reject, cancel, ...). Replaces raw `window.prompt` dialogs with a
 * real, accessible modal form.
 */
export interface TextReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as a destructive action (e.g. terminate). */
  destructive?: boolean;
  isSubmitting?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
}

export function TextReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label = 'Reason',
  placeholder = 'Describe the reason for this action',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  isSubmitting = false,
  onConfirm,
}: TextReasonDialogProps) {
  const [reason, setReason] = React.useState('');
  const textareaId = React.useId();

  React.useEffect(() => {
    if (open) {
      setReason('');
    }
  }, [open]);

  const trimmedReason = reason.trim();

  const handleConfirm = async () => {
    if (!trimmedReason || isSubmitting) return;
    await onConfirm(trimmedReason);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={textareaId}>{label}</Label>
          <textarea
            id={textareaId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={placeholder}
            rows={4}
            autoFocus
            className={cn(
              'flex w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50',
            )}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={!trimmedReason || isSubmitting}
          >
            {isSubmitting ? 'Working...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
