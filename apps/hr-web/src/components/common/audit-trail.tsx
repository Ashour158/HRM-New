import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Clock, User, FileText, AlertTriangle } from 'lucide-react';
import type { AuditEntry } from '@/types';

interface AuditTrailProps {
  resourceType: string;
  resourceId: string;
}

const actionColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CREATE: 'default',
  UPDATE: 'secondary',
  DELETE: 'destructive',
  VIEW: 'outline',
};

function actionIcon(action: string) {
  if (action === 'CREATE') return <FileText className="h-4 w-4" aria-hidden="true" />;
  if (action === 'UPDATE') return <FileText className="h-4 w-4" aria-hidden="true" />;
  if (action === 'DELETE') return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
  return <Clock className="h-4 w-4" aria-hidden="true" />;
}

/**
 * Displays audit log entries for a resource in a timeline view.
 */
export function AuditTrail({ resourceType, resourceId }: AuditTrailProps) {
  const [actionFilter, setActionFilter] = React.useState<string>('ALL');
  const [dateFrom, setDateFrom] = React.useState<string>('');
  const [dateTo, setDateTo] = React.useState<string>('');

  const { data: entries, isLoading } = useQuery({
    queryKey: ['audit-trail', resourceType, resourceId, actionFilter, dateFrom, dateTo],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: AuditEntry[] }>('/audit', {
        params: {
          resourceType,
          resourceId,
          action: actionFilter === 'ALL' ? undefined : actionFilter,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      });
      return response.data.data;
    },
    enabled: !!resourceType && !!resourceId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Action</label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px]" aria-label="Action">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All actions</SelectItem>
              <SelectItem value="CREATE">Create</SelectItem>
              <SelectItem value="UPDATE">Update</SelectItem>
              <SelectItem value="DELETE">Delete</SelectItem>
              <SelectItem value="VIEW">View</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DateRangePicker
          className="min-w-[20rem] flex-1 p-3"
          label="Date range"
          value={{ from: dateFrom, to: dateTo }}
          onChange={(value) => {
            setDateFrom(value.from ?? '');
            setDateTo(value.to ?? '');
          }}
        />
      </div>

      <div className="relative">
        <div className="absolute bottom-0 start-4 top-0 w-px bg-border" />
        <div className="space-y-4">
          {entries && entries.length > 0 ? (
            entries.map((entry) => (
              <div key={entry.id} className="relative ps-10">
                <div className="absolute start-2 top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-border bg-background">
                  {actionIcon(entry.action)}
                </div>
                <div className="rounded-lg border bg-card p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{entry.actorName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={actionColors[entry.action] || 'default'} className="gap-1">
                        {actionIcon(entry.action)}
                        {entry.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(entry.timestamp, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  {entry.details && Object.keys(entry.details).length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {JSON.stringify(entry.details)}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">No audit entries found</p>
          )}
        </div>
      </div>
    </div>
  );
}
