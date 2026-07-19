import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { APPROVAL_CONDITION_OPERATORS, type ApprovalConditionOperator } from '@/lib/approval-conditions';

export interface ConditionRowBuilderProps {
  index: number;
  field: string;
  operator: ApprovalConditionOperator;
  value: string;
  onChange: (patch: { field?: string; operator?: ApprovalConditionOperator; value?: string }) => void;
  onRemove: () => void;
}

/**
 * A single field / operator / value condition row for routing rules whose interception should
 * depend on the command payload (e.g. "only require approval if newAnnualSalary > 10000").
 * Intentionally simple — a structured tuple builder, not a general expression editor.
 */
export function ConditionRowBuilder({
  index,
  field,
  operator,
  value,
  onChange,
  onRemove,
}: ConditionRowBuilderProps): JSX.Element {
  return (
    <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
      <div className="grid gap-1">
        <Label htmlFor={`condition-field-${index}`}>Payload field</Label>
        <Input
          id={`condition-field-${index}`}
          placeholder="e.g. compensationChange.newAnnualSalary"
          value={field}
          onChange={(event) => onChange({ field: event.target.value })}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`condition-operator-${index}`}>Operator</Label>
        <select
          id={`condition-operator-${index}`}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          value={operator}
          onChange={(event) => onChange({ operator: event.target.value as ApprovalConditionOperator })}
        >
          {APPROVAL_CONDITION_OPERATORS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`condition-value-${index}`}>Value</Label>
        <Input
          id={`condition-value-${index}`}
          placeholder="e.g. 10000"
          value={value}
          onChange={(event) => onChange({ value: event.target.value })}
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="Remove condition"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
