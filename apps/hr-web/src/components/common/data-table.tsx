import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BulkActionToolbar, type BulkAction } from '@/components/ui/bulk-action-toolbar';
import { InlineEdit } from '@/components/common/inline-edit';
import { useSavedViews, type SavedViewRecord } from '@/hooks/use-saved-views';
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

/**
 * Column definition for the data table.
 */
export interface DataTableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  editable?: {
    value: (row: T) => string | number | null | undefined;
    label?: (row: T) => string;
    inputType?: React.HTMLInputTypeAttribute;
    onSave: (row: T, value: string) => Promise<void> | void;
  };
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  selectable?: boolean;
  selectedRowIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  bulkActions?: BulkAction[];
  listKey?: string;
  viewFilters?: Record<string, unknown>;
  onApplyView?: (view: SavedViewRecord) => void;
}

/**
 * Reusable sortable, filterable, paginated data table.
 */
export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'No data available',
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  sortColumn,
  sortDirection,
  onSort,
  selectable = false,
  selectedRowIds = [],
  onSelectionChange,
  bulkActions = [],
  listKey,
  viewFilters = {},
  onApplyView,
}: DataTableProps<T>) {
  const defaultColumnKeys = React.useMemo(() => columns.map((column) => column.key), [columns]);
  const [activeColumnKeys, setActiveColumnKeys] = React.useState<string[]>(defaultColumnKeys);
  const totalPages = Math.ceil(total / pageSize);
  const visibleColumns = React.useMemo(
    () => columns.filter((column) => activeColumnKeys.includes(column.key)),
    [activeColumnKeys, columns],
  );
  const visibleRowIds = React.useMemo(() => data.map((row) => keyExtractor(row)), [data, keyExtractor]);
  const selectedSet = React.useMemo(() => new Set(selectedRowIds), [selectedRowIds]);
  const allVisibleSelected = visibleRowIds.length > 0 && visibleRowIds.every((id) => selectedSet.has(id));
  const selectedCount = selectedRowIds.length;

  React.useEffect(() => {
    setActiveColumnKeys((current) => {
      const validKeys = new Set(defaultColumnKeys);
      const next = current.filter((key) => validKeys.has(key));
      const resolved = next.length > 0 ? next : defaultColumnKeys;
      return arraysEqual(current, resolved) ? current : resolved;
    });
  }, [defaultColumnKeys]);

  const handleSort = (columnKey: string) => {
    if (!onSort) return;
    if (sortColumn === columnKey) {
      onSort(columnKey, sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(columnKey, 'asc');
    }
  };

  const setSelected = (ids: string[]) => {
    onSelectionChange?.(ids);
  };

  const toggleRow = (id: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedSet);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(Array.from(next));
  };

  const toggleAllVisible = () => {
    if (!onSelectionChange) return;
    if (allVisibleSelected) {
      setSelected(selectedRowIds.filter((id) => !visibleRowIds.includes(id)));
      return;
    }
    setSelected(Array.from(new Set([...selectedRowIds, ...visibleRowIds])));
  };

  const renderSortIcon = (column: DataTableColumn<T>) => {
    if (!column.sortable) return null;
    if (sortColumn !== column.key) return <ArrowUpDown className="ms-2 h-4 w-4" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="ms-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ms-2 h-4 w-4" />
    );
  };

  const renderCell = (column: DataTableColumn<T>, row: T): React.ReactNode => {
    if (!column.editable) return column.cell(row);
    return (
      <InlineEdit
        value={column.editable.value(row)}
        label={column.editable.label?.(row) ?? column.header}
        inputType={column.editable.inputType}
        onSave={(value) => column.editable?.onSave(row, value)}
      />
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {listKey ? (
        <SavedViewsToolbar
          activeColumnKeys={activeColumnKeys}
          columns={columns}
          defaultColumnKeys={defaultColumnKeys}
          listKey={listKey}
          onApplyView={onApplyView}
          setActiveColumnKeys={setActiveColumnKeys}
          viewFilters={viewFilters}
        />
      ) : null}
      {selectable && selectedCount > 0 ? (
        <BulkActionToolbar
          actions={bulkActions}
          selectedCount={selectedCount}
          onClearSelection={() => setSelected([])}
        />
      ) : null}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b bg-muted/50">
            <tr>
              {selectable ? (
                <th className="h-12 w-12 px-4 text-start align-middle">
                  <input
                    aria-label="Select all rows"
                    checked={allVisibleSelected}
                    className="h-4 w-4 rounded border-border text-primary focus-visible:ring-ring"
                    disabled={!onSelectionChange || visibleRowIds.length === 0}
                    onChange={toggleAllVisible}
                    type="checkbox"
                  />
                </th>
              ) : null}
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'h-12 px-4 text-start align-middle font-medium text-muted-foreground',
                    column.sortable && 'cursor-pointer select-none',
                    column.className
                  )}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center">
                    {column.header}
                    {renderSortIcon(column)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {data.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0)} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const rowId = keyExtractor(row);
                const isSelected = selectedSet.has(rowId);
                return (
                  <tr
                    key={rowId}
                    className={cn('border-b transition-colors hover:bg-muted/50', isSelected && 'bg-muted/60')}
                  >
                    {selectable ? (
                      <td className="w-12 p-4 align-middle">
                        <input
                          aria-label="Select row"
                          checked={isSelected}
                          className="h-4 w-4 rounded border-border text-primary focus-visible:ring-ring"
                          disabled={!onSelectionChange}
                          onChange={() => toggleRow(rowId)}
                          type="checkbox"
                        />
                      </td>
                    ) : null}
                    {visibleColumns.map((column) => (
                      <td key={column.key} className={cn('p-4 text-start align-middle', column.className)}>
                        {renderCell(column, row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {onPageChange && totalPages > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {Math.min((page - 1) * pageSize + 1, total)} to {Math.min(page * pageSize, total)} of {total} entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

interface SavedViewsToolbarProps<T> {
  activeColumnKeys: string[];
  columns: DataTableColumn<T>[];
  defaultColumnKeys: string[];
  listKey: string;
  onApplyView?: (view: SavedViewRecord) => void;
  setActiveColumnKeys: React.Dispatch<React.SetStateAction<string[]>>;
  viewFilters: Record<string, unknown>;
}

function SavedViewsToolbar<T>({
  activeColumnKeys,
  columns,
  defaultColumnKeys,
  listKey,
  onApplyView,
  setActiveColumnKeys,
  viewFilters,
}: SavedViewsToolbarProps<T>): JSX.Element {
  const { t } = useTranslation();
  const { views, createView, isSaving } = useSavedViews(listKey);
  const [selectedViewId, setSelectedViewId] = React.useState('');
  const [viewName, setViewName] = React.useState('');
  const currentViewValue = '__current_view__';

  React.useEffect(() => {
    const defaultView = views.find((view) => view.isDefault);
    if (!defaultView) return;
    setSelectedViewId(defaultView.id);
    if (defaultView.columns.length > 0) {
      const validKeys = new Set(defaultColumnKeys);
      const nextColumns = defaultView.columns.filter((key) => validKeys.has(key));
      setActiveColumnKeys(nextColumns.length > 0 ? nextColumns : defaultColumnKeys);
    }
    onApplyView?.(defaultView);
  }, [defaultColumnKeys, onApplyView, setActiveColumnKeys, views]);

  const toggleColumn = (columnKey: string) => {
    setActiveColumnKeys((current) => {
      if (current.includes(columnKey)) {
        return current.length === 1 ? current : current.filter((key) => key !== columnKey);
      }
      return [...current, columnKey];
    });
  };

  const applyView = (viewId: string) => {
    if (viewId === currentViewValue) {
      setSelectedViewId('');
      setActiveColumnKeys(defaultColumnKeys);
      return;
    }
    setSelectedViewId(viewId);
    const view = views.find((candidate) => candidate.id === viewId);
    if (!view) return;
    if (view.columns.length > 0) {
      const validKeys = new Set(defaultColumnKeys);
      const nextColumns = view.columns.filter((key) => validKeys.has(key));
      setActiveColumnKeys(nextColumns.length > 0 ? nextColumns : defaultColumnKeys);
    }
    onApplyView?.(view);
  };

  const saveCurrentView = async () => {
    if (viewName.trim().length === 0) return;
    const saved = await createView({
      listKey,
      name: viewName.trim(),
      filters: viewFilters,
      columns: activeColumnKeys,
      isDefault: views.length === 0,
    });
    if (saved?.id) {
      setSelectedViewId(saved.id);
      setViewName('');
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-end">
        <label className="space-y-1 text-sm font-medium text-foreground">
          <span>{t('savedViews.viewLabel', { defaultValue: 'Saved view' })}</span>
          <Select value={selectedViewId || currentViewValue} onValueChange={applyView}>
            <SelectTrigger className="h-9 min-w-[12rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={currentViewValue}>{t('savedViews.selectPlaceholder', { defaultValue: 'Current view' })}</SelectItem>
              {views.map((view) => (
                <SelectItem key={view.id} value={view.id}>{view.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1 text-sm font-medium text-foreground">
          <span>{t('savedViews.nameLabel', { defaultValue: 'View name' })}</span>
          <Input
            className="h-9 min-w-[12rem]"
            onChange={(event) => setViewName(event.target.value)}
            placeholder={t('savedViews.namePlaceholder', { defaultValue: 'My filtered view' })}
            value={viewName}
          />
        </label>
        <Button
          disabled={isSaving || !viewName.trim()}
          onClick={() => void saveCurrentView()}
          type="button"
          variant="outline"
        >
          {t('savedViews.saveButton', { defaultValue: 'Save view' })}
        </Button>
      </div>
      <fieldset className="flex flex-wrap gap-3 text-sm">
        <legend className="sr-only">{t('savedViews.columnsLegend', { defaultValue: 'Visible columns' })}</legend>
        {columns.map((column) => (
          <label key={column.key} className="flex items-center gap-2 text-muted-foreground">
            <input
              checked={activeColumnKeys.includes(column.key)}
              onChange={() => toggleColumn(column.key)}
              type="checkbox"
            />
            <span>{column.header}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
