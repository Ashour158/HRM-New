import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { Badge } from '@/components/ui/badge';

export interface ReportRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry: () => void;
  generatedAt?: string;
  children?: ReactNode;
}

/**
 * Shared "prebuilt report result" dialog shell used by My Reports and Team
 * Reports so every report opens into the same one-click, named-view pattern.
 */
export function ReportRunDialog({
  open,
  onOpenChange,
  title,
  description,
  isLoading,
  isError,
  error,
  onRetry,
  generatedAt,
  children,
}: ReportRunDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{title}</DialogTitle>
            {generatedAt ? (
              <Badge variant="outline" className="text-muted-foreground">
                Generated {new Date(generatedAt).toLocaleString()}
              </Badge>
            ) : null}
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : isError ? (
          <ErrorState title="Unable to load this report" error={error} onRetry={onRetry} />
        ) : (
          <div className="space-y-4">{children}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
