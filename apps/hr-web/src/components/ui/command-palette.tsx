import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export interface CommandPaletteItem {
  label: string;
  path: string;
  keywords?: string[];
}

interface CommandPaletteProps {
  items: CommandPaletteItem[];
}

export function CommandPalette({ items }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const filtered = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => [item.label, ...(item.keywords ?? [])].join(' ').toLowerCase().includes(normalized));
  }, [items, query]);

  React.useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const runCommand = (path: string) => {
    setOpen(false);
    setQuery('');
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Command palette</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3">
          <Search aria-hidden="true" />
          <Input className="border-0 bg-transparent shadow-none focus-visible:ring-0" autoFocus placeholder="Search pages, reports, people..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div aria-label="Command palette results" className="max-h-72 overflow-auto">
          {filtered.map((item) => (
            <button
              key={item.path}
              type="button"
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              onClick={() => runCommand(item.path)}
            >
              <span className="font-semibold">{item.label}</span>
              <span className="text-xs text-muted-foreground">Enter</span>
            </button>
          ))}
          {filtered.length === 0 ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">No commands found</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
