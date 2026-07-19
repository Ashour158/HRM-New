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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Small set of reusable Radix-dialog-based workflow prompts that replace
 * native `window.prompt()` calls across the admin workspace. Each dialog is a
 * plain controlled-state component (no react-hook-form) following the
 * pattern already used by the compensation create dialogs.
 */
interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
}

/* -------------------------------------------------------------------------- */
/* TextReasonDialog                                                          */
/* -------------------------------------------------------------------------- */

export interface TextReasonDialogProps extends BaseDialogProps {
  label: string;
  placeholder?: string;
  helperText?: string;
  rows?: number;
  onSubmit: (value: string) => void;
}

/**
 * Collects a single required free-text value (a reason, review content, an
 * outcome note, a milestone title, ...). Used both as a standalone dialog and
 * as the inline follow-up field rendered by {@link ActionChoiceDialog}.
 */
export function TextReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  helperText,
  rows = 4,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  onSubmit,
}: TextReasonDialogProps) {
  const fieldId = React.useId();
  const [value, setValue] = React.useState('');
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setValue('');
      setTouched(false);
    }
  }, [open]);

  const trimmed = value.trim();
  const showError = touched && trimmed.length === 0;

  const handleSubmit = () => {
    setTouched(true);
    if (trimmed.length === 0) return;
    onSubmit(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={fieldId}>{label}</Label>
          <Textarea
            id={fieldId}
            rows={rows}
            value={value}
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={showError}
            aria-describedby={showError ? `${fieldId}-error` : undefined}
          />
          {helperText && !showError ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
          {showError ? (
            <p id={`${fieldId}-error`} className="text-xs text-destructive">
              This field is required.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* RatingDialog                                                              */
/* -------------------------------------------------------------------------- */

export interface RatingDialogProps extends BaseDialogProps {
  label: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue: number;
  helperText?: string;
  onSubmit: (value: number) => void;
}

/** Collects a single validated numeric rating (calibration rating, final rating, ...). */
export function RatingDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  min = 1,
  max = 5,
  step = 0.1,
  defaultValue,
  helperText,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  onSubmit,
}: RatingDialogProps) {
  const fieldId = React.useId();
  const [value, setValue] = React.useState(String(defaultValue));
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setValue(String(defaultValue));
      setTouched(false);
    }
  }, [open, defaultValue]);

  const numeric = Number(value);
  const isValid = value.trim() !== '' && Number.isFinite(numeric) && numeric >= min && numeric <= max;
  const showError = touched && !isValid;

  const handleSubmit = () => {
    setTouched(true);
    if (!isValid) return;
    onSubmit(numeric);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={fieldId}>{label}</Label>
          <Input
            id={fieldId}
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={showError}
            aria-describedby={showError ? `${fieldId}-error` : undefined}
          />
          {helperText && !showError ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
          {showError ? (
            <p id={`${fieldId}-error`} className="text-xs text-destructive">
              Enter a number between {min} and {max}.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* ActionChoiceDialog                                                        */
/* -------------------------------------------------------------------------- */

export type ActionChoiceFieldType = 'text' | 'textarea' | 'number' | 'date';

export interface ActionChoiceField {
  type: ActionChoiceFieldType;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  /** Defaults to true whenever a field is present. */
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export interface ActionChoice {
  value: string;
  label: string;
  description?: string;
  /** Inline follow-up field shown only while this choice is selected. */
  field?: ActionChoiceField;
}

export interface ActionChoiceDialogProps extends BaseDialogProps {
  choices: ActionChoice[];
  defaultChoice?: string;
  onSubmit: (choice: string, fieldValue?: string) => void;
}

/**
 * Radio/segmented choice among a small set of named actions, with an inline
 * follow-up field for choices that need one (a date, an outcome note, a
 * numeric value, an owner id, ...). Replaces the `window.prompt('Type X, Y,
 * or Z')` branching prompts.
 */
export function ActionChoiceDialog({
  open,
  onOpenChange,
  title,
  description,
  choices,
  defaultChoice,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  onSubmit,
}: ActionChoiceDialogProps) {
  const groupId = React.useId();
  const fieldId = React.useId();
  const initialChoice = defaultChoice ?? choices[0]?.value ?? '';
  const [selected, setSelected] = React.useState(initialChoice);
  const [fieldValue, setFieldValue] = React.useState(
    choices.find((choice) => choice.value === initialChoice)?.field?.defaultValue ?? '',
  );
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const next = defaultChoice ?? choices[0]?.value ?? '';
    setSelected(next);
    setFieldValue(choices.find((choice) => choice.value === next)?.field?.defaultValue ?? '');
    setTouched(false);
    // Only re-sync when the dialog opens; `choices`/`defaultChoice` are recomputed
    // per render from the triggering row and would otherwise reset user input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const activeChoice = choices.find((choice) => choice.value === selected);
  const field = activeChoice?.field;

  const handleSelect = (value: string) => {
    setSelected(value);
    setFieldValue(choices.find((choice) => choice.value === value)?.field?.defaultValue ?? '');
    setTouched(false);
  };

  const fieldRequired = field ? field.required !== false : false;
  const trimmedFieldValue = fieldValue.trim();
  const numericFieldValue = Number(fieldValue);
  const fieldValid = !field
    ? true
    : !fieldRequired && trimmedFieldValue.length === 0
      ? true
      : field.type === 'number'
        ? trimmedFieldValue.length > 0 &&
          Number.isFinite(numericFieldValue) &&
          (field.min === undefined || numericFieldValue >= field.min) &&
          (field.max === undefined || numericFieldValue <= field.max)
        : trimmedFieldValue.length > 0;

  const canSubmit = Boolean(selected) && fieldValid;
  const showFieldError = Boolean(touched && field && !fieldValid);

  const handleSubmit = () => {
    setTouched(true);
    if (!canSubmit) return;
    onSubmit(selected, field ? trimmedFieldValue : undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div role="radiogroup" aria-label={title} className="space-y-2">
          {choices.map((choice) => {
            const inputId = `${groupId}-${choice.value}`;
            return (
              <label
                key={choice.value}
                htmlFor={inputId}
                className={cn(
                  'flex cursor-pointer flex-col gap-1 rounded-lg border px-3 py-2 text-sm transition-colors',
                  selected === choice.value ? 'border-primary bg-primary/5' : 'border-input',
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    id={inputId}
                    type="radio"
                    name={groupId}
                    value={choice.value}
                    checked={selected === choice.value}
                    onChange={() => handleSelect(choice.value)}
                    className="h-4 w-4"
                  />
                  <span className="font-medium">{choice.label}</span>
                </span>
                {choice.description ? <span className="text-xs text-muted-foreground">{choice.description}</span> : null}
              </label>
            );
          })}
        </div>
        {field ? (
          <div className="space-y-2">
            <Label htmlFor={fieldId}>{field.label}</Label>
            {field.type === 'textarea' ? (
              <Textarea
                id={fieldId}
                rows={4}
                value={fieldValue}
                placeholder={field.placeholder}
                onChange={(event) => setFieldValue(event.target.value)}
                aria-invalid={showFieldError}
              />
            ) : (
              <Input
                id={fieldId}
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                min={field.min}
                max={field.max}
                step={field.step}
                value={fieldValue}
                placeholder={field.placeholder}
                onChange={(event) => setFieldValue(event.target.value)}
                aria-invalid={showFieldError}
              />
            )}
            {showFieldError ? <p className="text-xs text-destructive">This field is required.</p> : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* DimensionRatingDialog                                                     */
/* -------------------------------------------------------------------------- */

export interface DimensionDefinition {
  key: string;
  label: string;
}

export interface DimensionRatingDialogProps extends BaseDialogProps {
  dimensions: DimensionDefinition[];
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  onSubmit: (scores: Record<string, number>) => void;
}

/**
 * Collects one validated numeric rating per dimension (used for 360 feedback,
 * where the schema supports per-dimension scores instead of a single overall
 * number copied across every dimension).
 */
export function DimensionRatingDialog({
  open,
  onOpenChange,
  title,
  description,
  dimensions,
  min = 1,
  max = 5,
  step = 1,
  defaultValue = 4,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  onSubmit,
}: DimensionRatingDialogProps) {
  const baseId = React.useId();
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setValues(Object.fromEntries(dimensions.map((dimension) => [dimension.key, String(defaultValue)])));
    setTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultValue]);

  const parsed = dimensions.map((dimension) => ({ key: dimension.key, value: Number(values[dimension.key]) }));
  const isValid =
    parsed.length > 0 && parsed.every(({ value }) => Number.isFinite(value) && value >= min && value <= max);
  const showError = touched && !isValid;

  const handleSubmit = () => {
    setTouched(true);
    if (!isValid) return;
    onSubmit(Object.fromEntries(parsed.map(({ key, value }) => [key, value])));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {dimensions.map((dimension) => {
            const inputId = `${baseId}-${dimension.key}`;
            return (
              <div key={dimension.key} className="space-y-2">
                <Label htmlFor={inputId}>{dimension.label}</Label>
                <Input
                  id={inputId}
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  value={values[dimension.key] ?? ''}
                  onChange={(event) => setValues((current) => ({ ...current, [dimension.key]: event.target.value }))}
                  aria-invalid={showError}
                />
              </div>
            );
          })}
        </div>
        {showError ? (
          <p className="text-xs text-destructive">
            Enter a rating between {min} and {max} for every area.
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
