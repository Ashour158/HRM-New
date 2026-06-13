import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface BulkAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface BulkActionToolbarProps {
  selectedCount: number;
  actions: BulkAction[];
  onClearSelection: () => void;
}

export function BulkActionToolbar({ selectedCount, actions, onClearSelection }: BulkActionToolbarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-card-foreground shadow-sm" role="toolbar" aria-label="Bulk actions">
      <span className="text-sm font-semibold">{selectedCount} selected</span>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Button key={action.label} type="button" size="sm" variant="outline" disabled={action.disabled} onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={onClearSelection} aria-label="Clear selected rows">
          <X aria-hidden="true" />
          Clear
        </Button>
      </div>
    </div>
  );
}
