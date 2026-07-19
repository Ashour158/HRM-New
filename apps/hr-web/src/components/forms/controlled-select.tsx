import * as React from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface ControlledSelectOption {
  value: string;
  label: React.ReactNode;
}

interface ControlledSelectProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  options: ControlledSelectOption[];
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  'aria-describedby'?: string;
}

/**
 * Wires the existing Radix-based `Select` primitives (@/components/ui/select)
 * into react-hook-form via `Controller`. Radix's Select is not a native form
 * control, so it cannot be wired with `register()` — this is the standard way
 * to bridge it. See ./README.md for the full pattern.
 *
 * Use this for simple "pick one of these options, nothing else happens"
 * selects. If changing the select needs to trigger side effects beyond
 * setting its own field (e.g. resetting other fields), use `Controller`
 * directly in the page instead of this wrapper.
 */
export function ControlledSelect<TFieldValues extends FieldValues>({
  control,
  name,
  options,
  id,
  placeholder,
  disabled,
  ...rest
}: ControlledSelectProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Select value={field.value as string} onValueChange={field.onChange} disabled={disabled}>
          <SelectTrigger
            id={id}
            onBlur={field.onBlur}
            aria-invalid={Boolean(fieldState.error) || undefined}
            aria-describedby={rest['aria-describedby']}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}
