import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
}

interface ComboboxProps {
  label: string;
  value?: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function Combobox({ label, value, options, onChange, placeholder = 'Search options...', className }: ComboboxProps) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className={cn('relative flex flex-col gap-2', className)}>
      <Label id={`${id}-label`}>{label}</Label>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-controls={`${id}-listbox`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="justify-between"
      >
        <span>{selected?.label ?? placeholder}</span>
        <ChevronsUpDown aria-hidden="true" />
      </Button>
      {open ? (
        <div className="absolute top-full z-50 mt-2 w-full rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} aria-label={`${label} search`} />
          <div id={`${id}-listbox`} role="listbox" className="mt-2 max-h-56 overflow-auto">
            {filtered.length ? filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  setQuery('');
                }}
              >
                <span>
                  <span className="block font-semibold">{option.label}</span>
                  {option.description ? <span className="block text-xs text-muted-foreground">{option.description}</span> : null}
                </span>
                {option.value === value ? <Check aria-hidden="true" /> : null}
              </button>
            )) : (
              <p className="px-3 py-4 text-sm text-muted-foreground">No matching options</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
