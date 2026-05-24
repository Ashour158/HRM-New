import * as React from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/common/data-table';
import { AllowedActions } from '@/components/common/allowed-actions';
import { formatDate } from '@/lib/utils';
import { Calendar, Plus, Clock } from 'lucide-react';
import type { AbsenceRequest } from '@/types';

interface AbsenceBalance {
  type: string;
  total: number;
  used: number;
  remaining: number;
  unit: string;
}

/**
 * Time off requests page with balance display, request form, and history.
 */
export function EmployeeTimeOff() {
  const [showForm, setShowForm] = React.useState(false);
  const [formData, setFormData] = React.useState({
    type: '',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const { data: requests, isLoading: requestsLoading } = useApiQuery<AbsenceRequest[]>(
    ['employee-absences'],
    '/employee/absences'
  );

  const { data: balances, isLoading: balancesLoading } = useApiQuery<AbsenceBalance[]>(
    ['employee-absence-balance'],
    '/employee/absences/balance'
  );

  const createMutation = useApiMutation<AbsenceRequest, typeof formData>(
    '/employee/absences',
    'post',
    [['employee-absences']]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync(formData);
    setShowForm(false);
    setFormData({ type: '', startDate: '', endDate: '', reason: '' });
  };

  const columns = [
    { key: 'type', header: 'Type', cell: (row: AbsenceRequest) => row.type },
    {
      key: 'dates',
      header: 'Dates',
      cell: (row: AbsenceRequest) => (
        <span>
          {formatDate(row.startDate)} - {formatDate(row.endDate)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: AbsenceRequest) => {
        const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
          PENDING: 'secondary',
          APPROVED: 'default',
          REJECTED: 'destructive',
          CANCELLED: 'outline',
        };
        return <Badge variant={variants[row.status] || 'default'}>{row.status}</Badge>;
      },
    },
    { key: 'reason', header: 'Reason', cell: (row: AbsenceRequest) => row.reason || '-' },
    {
      key: 'requested',
      header: 'Requested',
      cell: (row: AbsenceRequest) => formatDate(row.requestedAt),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Time Off
          </h2>
          <p className="text-muted-foreground">Submit and track your absence requests</p>
        </div>
        <AllowedActions
          aggregateType="ABSENCE"
          onAction={() => setShowForm(true)}
        />
      </div>

      {/* Balance Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {balancesLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : balances && balances.length > 0 ? (
          balances.map((bal) => (
            <Card key={bal.type}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{bal.type}</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{bal.remaining}</span>
                  <span className="text-xs text-muted-foreground">{bal.unit}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {bal.used} used / {bal.total} total
                </p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">No balance data available</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Request Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Submit Absence Request</CardTitle>
            <CardDescription>Fill in the details for your time off request</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="type">Absence Type</Label>
                  <select
                    id="type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    required
                  >
                    <option value="">Select type</option>
                    <option value="VACATION">Vacation</option>
                    <option value="SICK">Sick Leave</option>
                    <option value="PERSONAL">Personal Leave</option>
                    <option value="FAMILY">Family Leave</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Input
                  id="reason"
                  placeholder="Optional reason for absence"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Submit Request
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Request History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Request History</CardTitle>
          <CardDescription>Your past and pending absence requests</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={requests ?? []}
            keyExtractor={(row) => row.id}
            isLoading={requestsLoading}
            emptyMessage="No absence requests found"
          />
        </CardContent>
      </Card>
    </div>
  );
}
