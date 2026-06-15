import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface InlineEditProps {
  value: string | number | null | undefined;
  label: string;
  inputType?: React.HTMLInputTypeAttribute;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  onSave: (value: string) => Promise<void> | void;
}

export function InlineEdit({
  value,
  label,
  inputType = 'text',
  className,
  disabled = false,
  placeholder = '',
  onSave,
}: InlineEditProps): JSX.Element {
  const { t } = useTranslation();
  const normalizedValue = stringifyValue(value);
  const [displayValue, setDisplayValue] = React.useState(normalizedValue);
  const [draft, setDraft] = React.useState(normalizedValue);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setDisplayValue(normalizedValue);
    setDraft(normalizedValue);
  }, [normalizedValue]);

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const cancel = React.useCallback(() => {
    setDraft(displayValue);
    setEditing(false);
    setSaving(false);
  }, [displayValue]);

  const commit = React.useCallback(async () => {
    const nextValue = draft.trim();
    const previousValue = displayValue;
    setDisplayValue(nextValue);
    setEditing(false);
    setSaving(true);
    try {
      await onSave(nextValue);
    } catch (error) {
      setDisplayValue(previousValue);
      setDraft(previousValue);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [displayValue, draft, onSave]);

  if (editing) {
    return (
      <Input
        ref={inputRef}
        aria-label={label}
        className={cn('h-8 min-w-[10rem]', className)}
        disabled={saving}
        onBlur={cancel}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit();
          }
        }}
        placeholder={placeholder}
        type={inputType}
        value={draft}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={t('inlineEdit.editAria', { label, defaultValue: `Edit ${label}` })}
      className={cn(
        'min-h-8 rounded-md px-2 py-1 text-left text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      disabled={disabled || saving}
      onClick={() => {
        setDraft(displayValue);
        setEditing(true);
      }}
    >
      {displayValue || placeholder || t('inlineEdit.emptyValue', { defaultValue: 'Not set' })}
    </button>
  );
}

function stringifyValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}
