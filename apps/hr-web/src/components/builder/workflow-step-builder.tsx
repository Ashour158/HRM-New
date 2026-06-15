import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface WorkflowStepBuilderProps {
  index: number;
  code: string;
  label: string;
  order: number;
  mode: 'SEQUENTIAL' | 'PARALLEL';
  approverType: 'ROLE' | 'WORKER';
  approverRole?: string;
  approverWorkerId?: string;
  slaHours?: number;
  escalationAfterHours?: number;
  escalationApproverRole?: string;
  onChange: (patch: {
    code?: string;
    label?: string;
    order?: number;
    mode?: 'SEQUENTIAL' | 'PARALLEL';
    approverType?: 'ROLE' | 'WORKER';
    approverRole?: string;
    approverWorkerId?: string;
    slaHours?: number;
    escalationAfterHours?: number;
    escalationApproverRole?: string;
  }) => void;
  onMove: (direction: 'up' | 'down') => void;
  onDragStart?: () => void;
  onDrop?: () => void;
  onRemove: () => void;
}

export function WorkflowStepBuilder({
  index,
  code,
  label,
  order,
  mode,
  approverType,
  approverRole,
  approverWorkerId,
  slaHours,
  escalationAfterHours,
  escalationApproverRole,
  onChange,
  onMove,
  onDragStart,
  onDrop,
  onRemove,
}: WorkflowStepBuilderProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[36px_80px_1fr_1fr_1fr_120px_1fr_auto]"
      draggable
      onDragOver={(event) => event.preventDefault()}
      onDragStart={onDragStart}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-center text-slate-400" aria-hidden="true">
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`approval-step-order-${index}`}>Order</Label>
        <Input id={`approval-step-order-${index}`} type="number" min={1} value={order} onChange={(event) => onChange({ order: Number(event.target.value) })} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`approval-step-code-${index}`}>Step code</Label>
        <Input id={`approval-step-code-${index}`} value={code} onChange={(event) => onChange({ code: event.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`approval-step-label-${index}`}>Step label</Label>
        <Input id={`approval-step-label-${index}`} value={label} onChange={(event) => onChange({ label: event.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`approval-step-approver-${index}`}>Approver</Label>
        <select
          id={`approval-step-approver-${index}`}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          value={approverType}
          onChange={(event) => onChange({ approverType: event.target.value as 'ROLE' | 'WORKER' })}
        >
          <option value="ROLE">Role</option>
          <option value="WORKER">Worker</option>
        </select>
        <Input
          aria-label={approverType === 'ROLE' ? 'Approver role' : 'Approver worker'}
          value={approverType === 'ROLE' ? approverRole ?? '' : approverWorkerId ?? ''}
          onChange={(event) => onChange(approverType === 'ROLE' ? { approverRole: event.target.value } : { approverWorkerId: event.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`approval-step-mode-${index}`}>Mode</Label>
        <select
          id={`approval-step-mode-${index}`}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          value={mode}
          onChange={(event) => onChange({ mode: event.target.value as 'SEQUENTIAL' | 'PARALLEL' })}
        >
          <option value="SEQUENTIAL">Sequential</option>
          <option value="PARALLEL">Parallel</option>
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`approval-step-sla-${index}`}>SLA hours</Label>
        <Input id={`approval-step-sla-${index}`} type="number" min={0} value={slaHours ?? 24} onChange={(event) => onChange({ slaHours: Number(event.target.value) })} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`approval-step-escalation-${index}`}>Escalation</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            id={`approval-step-escalation-${index}`}
            aria-label="Escalation after hours"
            inputMode="numeric"
            value={escalationAfterHours ?? ''}
            onChange={(event) => onChange({ escalationAfterHours: Number(event.target.value) || undefined })}
            placeholder="After"
          />
          <Input
            aria-label="Escalation approver role"
            value={escalationApproverRole ?? ''}
            onChange={(event) => onChange({ escalationApproverRole: event.target.value })}
            placeholder="Role"
          />
        </div>
      </div>
      <div className="flex items-end gap-1">
        <Button variant="ghost" size="icon" type="button" aria-label={t('builder.moveUp', { defaultValue: 'Move up' })} onClick={() => onMove('up')}>
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" type="button" aria-label={t('builder.moveDown', { defaultValue: 'Move down' })} onClick={() => onMove('down')}>
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" type="button" className={cn('text-destructive')} onClick={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  );
}
