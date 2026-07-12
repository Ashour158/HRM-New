import * as React from 'react';
import { Loader2, Search, UserRound, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import type { Worker } from '@/types';

const SEARCH_DEBOUNCE_MS = 300;
const RESULT_PAGE_SIZE = 10;

export interface WorkerPickerProps {
  /** Currently selected worker id (empty string when nothing is selected). */
  value: string;
  /** Called with the selected worker's id and a human-readable label once a result is picked, or ('', '') on clear. */
  onChange: (workerId: string, workerLabel: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Accessible label for the search input when no visible <Label htmlFor> is used. */
  ariaLabel?: string;
}

function workerLabel(worker: Worker): string {
  return `${worker.firstName} ${worker.lastName}`.trim() || worker.employeeId;
}

function workerDescription(worker: Worker): string {
  const parts = [worker.employeeId, worker.jobTitle].filter((part): part is string => Boolean(part && part.trim()));
  return parts.join(' • ');
}

/**
 * Async worker/people picker. Debounces free-text search, queries the real
 * `GET /hr/core/workers?search=` endpoint, and reports the selected worker's
 * id + label. Drop-in replacement for a plain text input bound to a worker
 * UUID: it is a controlled component driven entirely by `value` + `onChange`.
 */
export function WorkerPicker({
  value,
  onChange,
  id,
  placeholder = 'Search by name or employee ID...',
  className,
  disabled,
  ariaLabel,
}: WorkerPickerProps) {
  const reactId = React.useId();
  const listboxId = `${id ?? reactId}-worker-picker-listbox`;

  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  // Tracks the worker id that `query` currently reflects, so external resets
  // to `value` (e.g. a form clear) can be distinguished from a live edit.
  const committedIdRef = React.useRef('');

  React.useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  React.useEffect(() => {
    if (value === committedIdRef.current) return;
    committedIdRef.current = value;
    if (!value) {
      setQuery('');
    } else {
      // Value was set externally without going through onChange (e.g. programmatic
      // reset); show the raw id as a fallback until the user searches again.
      setQuery((previous) => previous || value);
    }
  }, [value]);

  React.useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const searchEnabled = open && debouncedQuery.length > 0;
  const searchQuery = useApiQuery<Worker[]>(
    ['worker-picker-search', debouncedQuery],
    `/hr/core/workers?search=${encodeURIComponent(debouncedQuery)}&pageSize=${RESULT_PAGE_SIZE}`,
    { enabled: searchEnabled, staleTime: 15000 },
  );

  const results = React.useMemo(() => searchQuery.data ?? [], [searchQuery.data]);

  React.useEffect(() => {
    setHighlightedIndex(results.length > 0 ? 0 : -1);
  }, [results]);

  const commitSelection = (worker: Worker) => {
    const label = workerLabel(worker);
    committedIdRef.current = worker.id;
    setQuery(label);
    setOpen(false);
    onChange(worker.id, label);
  };

  const handleClear = () => {
    committedIdRef.current = '';
    setQuery('');
    setDebouncedQuery('');
    setOpen(false);
    onChange('', '');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) setOpen(true);
      setHighlightedIndex((current) => (results.length ? (current + 1) % results.length : -1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((current) => (results.length ? (current - 1 + results.length) % results.length : -1));
      return;
    }
    if (event.key === 'Enter') {
      if (open && highlightedIndex >= 0 && results[highlightedIndex]) {
        event.preventDefault();
        commitSelection(results[highlightedIndex]);
      }
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const showDropdown = open && debouncedQuery.length > 0;
  const isSelected = Boolean(value) && committedIdRef.current === value;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id={id}
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          className={cn('pl-9', isSelected ? 'pr-9' : undefined)}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            if (isSelected) {
              // The confirmed selection no longer matches the visible text.
              committedIdRef.current = '';
              onChange('', '');
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {isSelected ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Clear selected worker"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {showDropdown ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute top-full z-50 mt-1 w-full max-h-72 overflow-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {searchQuery.isLoading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Searching workers…
            </div>
          ) : searchQuery.isError ? (
            <div className="px-3 py-3 text-sm text-destructive">Unable to search workers. Try again.</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">No matching workers found.</div>
          ) : (
            results.map((worker, index) => (
              <button
                key={worker.id}
                type="button"
                role="option"
                aria-selected={worker.id === value}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                  index === highlightedIndex ? 'bg-accent' : undefined,
                )}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => commitSelection(worker)}
              >
                <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{workerLabel(worker)}</span>
                  <span className="truncate text-xs text-muted-foreground">{workerDescription(worker)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export default WorkerPicker;
