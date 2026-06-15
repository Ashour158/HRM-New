import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { PaletteAction, PaletteSearchResult } from '@/lib/command-actions';
import { useUIStore } from '@/stores/ui-store';
import { i18n } from '@/i18n/i18n';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export type CommandPaletteItem = PaletteAction;

interface CommandPaletteProps {
  items: CommandPaletteItem[];
}

const RECENTS_KEY = 'hrm-command-palette-recents';
const FREQUENTS_KEY = 'hrm-command-palette-frequents';
const MAX_RECENTS = 8;

type RunnablePaletteItem =
  | Extract<PaletteAction, { kind: 'navigate' | 'create' | 'command' }>
  | (PaletteSearchResult & { kind: 'navigate' });

export function CommandPalette({ items }: CommandPaletteProps) {
  const { t } = useTranslation(undefined, { i18n });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [runningId, setRunningId] = React.useState<string | undefined>();
  const [searchResults, setSearchResults] = React.useState<RunnablePaletteItem[]>([]);
  const [errorMessage, setErrorMessage] = React.useState<string | undefined>();
  const listboxId = React.useId();
  const actionableItems = React.useMemo(
    () => items.filter((item): item is Extract<PaletteAction, { kind: 'navigate' | 'create' | 'command' }> => item.kind !== 'search'),
    [items],
  );
  const searchActions = React.useMemo(
    () => items.filter((item): item is Extract<PaletteAction, { kind: 'search' }> => item.kind === 'search'),
    [items],
  );
  const filtered = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const sorted = sortByUsage([...actionableItems, ...searchResults]);
    if (!normalized) return sorted;
    return sorted.filter((item) => fuzzyIncludes([item.label, item.group, ...(item.keywords ?? [])].join(' '), normalized));
  }, [actionableItems, query, searchResults]);
  const activeItem = filtered[activeIndex];
  const activeDescendant = activeItem ? optionId(listboxId, activeItem.id) : undefined;

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query, filtered.length]);

  React.useEffect(() => {
    if (!open) {
      setSearchResults([]);
      setErrorMessage(undefined);
      return;
    }
    const trimmed = query.trim();
    if (!trimmed || searchActions.length === 0) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    Promise.all(searchActions.map(async (action) => {
      const results = await action.resolver(trimmed);
      return results.map<RunnablePaletteItem>((result) => ({ ...result, kind: 'navigate' }));
    }))
      .then((groups) => {
        if (!cancelled) setSearchResults(groups.flat());
      })
      .catch(() => {
        if (!cancelled) {
          setSearchResults([]);
          setErrorMessage(t('commandPalette.commandFailedMessage'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, query, searchActions, t]);

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

  const closePalette = React.useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
    setErrorMessage(undefined);
  }, []);

  const runCommand = React.useCallback(async (item: RunnablePaletteItem) => {
    if (item.kind === 'command' && item.commandPath) {
      setRunningId(item.id);
      setErrorMessage(undefined);
      try {
        await apiClient.post(item.commandPath, item.body ?? {});
        await queryClient.invalidateQueries();
        recordUsage(item.id);
        addNotification({
          title: t('commandPalette.commandCompleted'),
          message: t('commandPalette.commandCompletedMessage'),
          type: 'success',
          read: false,
        });
        closePalette();
      } catch {
        setErrorMessage(t('commandPalette.commandFailedMessage'));
        addNotification({
          title: t('commandPalette.commandFailed'),
          message: t('commandPalette.commandFailedMessage'),
          type: 'error',
          read: false,
        });
      } finally {
        setRunningId(undefined);
      }
      return;
    }

    if (item.kind === 'create') {
      recordUsage(item.id);
      closePalette();
      navigate(item.route);
      return;
    }

    if (item.kind === 'navigate') {
      recordUsage(item.id);
      closePalette();
      navigate(item.path);
    }
  }, [addNotification, closePalette, navigate, queryClient, t]);

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter' && activeItem) {
      event.preventDefault();
      void runCommand(activeItem);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('commandPalette.title')}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3">
          <Search aria-hidden="true" />
          <Input
            role="combobox"
            aria-label={t('commandPalette.searchLabel')}
            aria-controls={listboxId}
            aria-expanded={open}
            aria-autocomplete="list"
            aria-activedescendant={activeDescendant}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            autoFocus
            placeholder={t('commandPalette.placeholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
          />
        </div>
        {errorMessage ? (
          <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        <div id={listboxId} role="listbox" aria-label={t('commandPalette.resultsLabel')} className="max-h-72 overflow-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('commandPalette.empty')}</p>
          ) : null}
          {filtered.map((item, index) => {
            return (
              <button
                id={optionId(listboxId, item.id)}
                key={item.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                  index === activeIndex && 'bg-accent',
                )}
                onClick={() => void runCommand(item)}
                disabled={runningId === item.id}
              >
                <span className="font-medium">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.group}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function optionId(listboxId: string, id: string): string {
  return `${listboxId}-option-${id}`;
}

function fuzzyIncludes(haystack: string, needle: string): boolean {
  const text = haystack.toLowerCase();
  if (text.includes(needle)) return true;
  let cursor = 0;
  for (const char of needle) {
    cursor = text.indexOf(char, cursor);
    if (cursor === -1) return false;
    cursor += 1;
  }
  return true;
}

function readUsage(key: string): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function readRecents(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function sortByUsage<T extends { id: string }>(items: T[]): T[] {
  const recents = readRecents();
  const frequents = readUsage(FREQUENTS_KEY);
  const recentRank = new Map(recents.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const aRecent = recentRank.has(a.id) ? recentRank.get(a.id)! : Number.POSITIVE_INFINITY;
    const bRecent = recentRank.has(b.id) ? recentRank.get(b.id)! : Number.POSITIVE_INFINITY;
    if (aRecent !== bRecent) return aRecent - bRecent;
    return (frequents[b.id] ?? 0) - (frequents[a.id] ?? 0);
  });
}

function recordUsage(id: string): void {
  try {
    const recents = [id, ...readRecents().filter((existing) => existing !== id)].slice(0, MAX_RECENTS);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
    const frequents = readUsage(FREQUENTS_KEY);
    frequents[id] = (frequents[id] ?? 0) + 1;
    window.localStorage.setItem(FREQUENTS_KEY, JSON.stringify(frequents));
  } catch {
    // localStorage unavailable — usage tracking is best-effort.
  }
}
