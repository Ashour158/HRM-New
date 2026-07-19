import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TextField } from '@/components/admin/text-field';
import type { FieldRule } from '@/types';

/**
 * Renders the appropriate input for a genuinely admin-defined custom
 * FieldRule (text/number/date/boolean/select), driven by rule.fieldType.
 * Used by both employee creation and the employee profile custom-fields
 * editor so a new custom field an admin defines is actually fillable and
 * persists identically in both places.
 */
export function DynamicFieldInput({
  rule,
  value,
  onChange,
}: {
  rule: FieldRule;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const type = rule.fieldType ?? 'TEXT';
  const label = rule.label || rule.fieldKey;
  const id = React.useId();

  if (type === 'BOOLEAN') {
    const current = value === true ? 'true' : value === false ? 'false' : 'unset';
    return (
      <div className="grid gap-2">
        <Label htmlFor={id}>
          {label}
          {rule.required ? <span className="text-destructive"> *</span> : null}
        </Label>
        <Select value={current} onValueChange={(next) => onChange(next === 'unset' ? undefined : next === 'true')}>
          <SelectTrigger id={id}>
            <SelectValue placeholder="Not specified" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unset">Not specified</SelectItem>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (type === 'SELECT') {
    const options = rule.options ?? [];
    const current = typeof value === 'string' && value ? value : 'none';
    return (
      <div className="grid gap-2">
        <Label htmlFor={id}>
          {label}
          {rule.required ? <span className="text-destructive"> *</span> : null}
        </Label>
        <Select value={current} onValueChange={(next) => onChange(next === 'none' ? undefined : next)}>
          <SelectTrigger id={id}>
            <SelectValue placeholder="Not specified" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not specified</SelectItem>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (type === 'NUMBER') {
    return (
      <TextField
        label={label}
        type="number"
        required={rule.required}
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(next) => onChange(next === '' ? undefined : Number(next))}
      />
    );
  }

  if (type === 'DATE') {
    return (
      <TextField
        label={label}
        type="date"
        required={rule.required}
        value={typeof value === 'string' ? value : ''}
        onChange={(next) => onChange(next || undefined)}
      />
    );
  }

  return (
    <TextField
      label={label}
      required={rule.required}
      value={typeof value === 'string' ? value : ''}
      onChange={(next) => onChange(next || undefined)}
    />
  );
}
