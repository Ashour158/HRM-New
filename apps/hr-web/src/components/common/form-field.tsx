import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  id?: string;
  label: React.ReactNode;
  error?: React.ReactNode;
  helpText?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactElement;
}

export function FormField({
  id,
  label,
  error,
  helpText,
  required,
  className,
  children,
}: FormFieldProps) {
  const generatedId = React.useId();
  const controlId = id ?? generatedId;
  const helpId = helpText ? `${controlId}-help` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={controlId}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {React.cloneElement(children, {
        id: controlId,
        'aria-invalid': Boolean(error) || undefined,
        'aria-describedby': describedBy,
      })}
      {helpText ? (
        <p id={helpId} className="text-sm text-muted-foreground">
          {helpText}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
