import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BulkActionToolbar, type BulkAction } from '@/components/ui/bulk-action-toolbar';
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
}: DataTableProps<T>) {
  const totalPages = Math.ceil(total / pageSize);
  const visibleRowIds = React.useMemo(() => data.map((row) => keyExtractor(row)), [data, keyExtractor]);
  const selectedSet = React.useMemo(() => new Set(selectedRowIds), [selectedRowIds]);
  const allVisibleSelected = visibleRowIds.length > 0 && visibleRowIds.every((id) => selectedSet.has(id));
  const selectedCount = selectedRowIds.length;

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
    if (sortColumn !== column.key) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
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
                <th className="h-12 w-12 px-4 text-left align-middle">
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
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'h-12 px-4 text-left align-middle font-medium text-muted-foreground',
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
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="h-24 text-center text-muted-foreground">
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
                    {columns.map((column) => (
                      <td key={column.key} className={cn('p-4 align-middle', column.className)}>
                        {column.cell(row)}
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
          <div className="flex items-center space-x-2">
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
