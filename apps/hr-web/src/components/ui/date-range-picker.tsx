import * as React from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface DateRangeValue {
  from?: string;
  to?: string;
}

interface DateRangePickerProps {
  label: string;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  className?: string;
}

export function DateRangePicker({ label, value, onChange, className }: DateRangePickerProps) {
  const fromId = React.useId();
  const toId = React.useId();

  return (
    <fieldset className={cn('rounded-2xl border border-border bg-card p-4 text-card-foreground', className)}>
      <legend className="px-1 text-sm font-semibold text-foreground">
        <CalendarDays className="mr-2 inline-block" aria-hidden="true" />
        {label}
      </legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={fromId}>{label} from</Label>
          <Input id={fromId} type="date" value={value.from ?? ''} onChange={(event) => onChange({ ...value, from: event.target.value })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={toId}>{label} to</Label>
          <Input id={toId} type="date" value={value.to ?? ''} onChange={(event) => onChange({ ...value, to: event.target.value })} />
        </div>
      </div>
    </fieldset>
  );
}
