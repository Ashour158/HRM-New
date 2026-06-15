import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useTenant } from '@/hooks/use-tenant';
import { useUIStore } from '@/stores/ui-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/common/data-table';
import { ErrorState } from '@/components/common/error-state';
import { formatDate } from '@/lib/utils';
import { CheckCircle2, Globe2, Plane, ShieldCheck, TimerReset } from 'lucide-react';

type WorkAuthorizationStatus = 'OPEN' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'RENEWED' | 'CLOSED';
type InternationalAssignmentStatus = 'DRAFT' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

interface WorkAuthorizationCase {
  id: string;
  workerId: string;
  authorizationType: string;
  issuingCountry: string;
  documentNumber?: string;
  validFrom?: string;
  validUntil?: string;
  status: WorkAuthorizationStatus;
  createdAt?: string;
  updatedAt?: string;
}

interface InternationalAssignment {
  id: string;
  workerId: string;
  homeCountry: string;
  hostCountry: string;
  legalEntityId?: string;
  startDate: string;
  endDate: string;
  assignmentReason: string;
  status: InternationalAssignmentStatus;
  createdAt?: string;
  updatedAt?: string;
}

interface CommandRequest {
  path: string;
  body?: Record<string, unknown>;
}

interface LifecycleAction {
  label: string;
  variant?: 'default' | 'outline';
  request: CommandRequest;
}

const emptyPermits: WorkAuthorizationCase[] = [];
const emptyAssignments: InternationalAssignment[] = [];

function apiData<T>(payload: unknown): T {
  const response = payload as { success?: boolean; data?: T };
  if (response.success === true && response.data !== undefined) return response.data;
  return payload as T;
}

function unwrap<T>(response: { data: unknown }) {
  return apiData<T>(response.data);
}

function humanize(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function expiryHealth(dateValue?: string) {
  if (!dateValue) {
    return {
      label: 'No expiry',
      className: 'border-slate-200 bg-slate-50 text-slate-600',
    };
  }

  const expiry = new Date(dateValue).getTime();
  if (Number.isNaN(expiry)) {
    return {
      label: 'No expiry',
      className: 'border-slate-200 bg-slate-50 text-slate-600',
    };
  }

  const daysUntilExpiry = (expiry - Date.now()) / 86_400_000;
  if (daysUntilExpiry < 0) {
    return {
      label: 'Expired',
      className: 'border-red-200 bg-red-50 text-red-700',
    };
  }
  if (daysUntilExpiry <= 30) {
    return {
      label: 'Expires soon',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }
  if (daysUntilExpiry <= 90) {
    return {
      label: 'Reminder window',
      className: 'border-sky-200 bg-sky-50 text-sky-700',
    };
  }
  return {
    label: 'On track',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
}

function statusTone(status: WorkAuthorizationStatus | InternationalAssignmentStatus) {
  if (status === 'ACTIVE' || status === 'APPROVED' || status === 'RENEWED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'UNDER_REVIEW' || status === 'DRAFT') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  if (status === 'EXPIRED' || status === 'REJECTED' || status === 'CANCELLED') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function workPermitCommands(permit: WorkAuthorizationCase): LifecycleAction[] {
  const base = `/global-hr/work-authorization-cases/${permit.id}/commands`;
  if (permit.status === 'OPEN') {
    return [{ label: 'Start review', request: { path: `${base}/start-review` } }];
  }
  if (permit.status === 'UNDER_REVIEW') {
    return [
      {
        label: 'Approve',
        request: {
          path: `${base}/approve`,
          body: {
            validFrom: permit.validFrom ?? new Date().toISOString(),
            validUntil: permit.validUntil ?? addDays(365),
            documentNumber: permit.documentNumber,
          },
        },
      },
      { label: 'Reject', variant: 'outline' as const, request: { path: `${base}/reject` } },
    ];
  }
  if (permit.status === 'APPROVED' || permit.status === 'RENEWED') {
    return [
      { label: 'Renew', request: { path: `${base}/renew`, body: { newValidUntil: addDays(365) } } },
      { label: 'Expire', variant: 'outline' as const, request: { path: `${base}/expire` } },
      { label: 'Close', variant: 'outline' as const, request: { path: `${base}/close` } },
    ];
  }
  return [];
}

function assignmentCommands(assignment: InternationalAssignment): LifecycleAction[] {
  const base = `/global-hr/international-assignments/${assignment.id}/commands`;
  if (assignment.status === 'DRAFT') {
    return [{ label: 'Approve', request: { path: `${base}/approve` } }];
  }
  if (assignment.status === 'APPROVED') {
    return [
      { label: 'Activate', request: { path: `${base}/activate` } },
      { label: 'Cancel', variant: 'outline' as const, request: { path: `${base}/cancel` } },
    ];
  }
  if (assignment.status === 'ACTIVE') {
    return [
      { label: 'Complete', request: { path: `${base}/complete` } },
      { label: 'Expire', variant: 'outline' as const, request: { path: `${base}/expire` } },
    ];
  }
  return [];
}

export function AdminGlobalHr() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const addNotification = useUIStore((state) => state.addNotification);

  const permitsQuery = useQuery({
    enabled: Boolean(tenantId),
    queryKey: ['admin-global-hr-work-permits', tenantId],
    queryFn: async () => unwrap<WorkAuthorizationCase[]>(await apiClient.get(`/global-hr/work-authorization-cases/tenant/${tenantId}`)),
  });

  const assignmentsQuery = useQuery({
    enabled: Boolean(tenantId),
    queryKey: ['admin-global-hr-assignments', tenantId],
    queryFn: async () => unwrap<InternationalAssignment[]>(await apiClient.get(`/global-hr/international-assignments/tenant/${tenantId}`)),
  });

  const runCommand = useMutation({
    mutationFn: async (request: CommandRequest) => apiClient.post(request.path, request.body ?? {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-global-hr-work-permits', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['admin-global-hr-assignments', tenantId] });
      addNotification({
        title: 'Global HR record updated',
        message: 'The selected record moved to the next lifecycle step.',
        type: 'success',
        read: false,
      });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to update the Global HR record.';
      addNotification({ title: 'Global HR update failed', message, type: 'error', read: false });
    },
  });

  const permits = React.useMemo(() => (Array.isArray(permitsQuery.data) ? permitsQuery.data : emptyPermits), [permitsQuery.data]);
  const assignments = React.useMemo(() => (Array.isArray(assignmentsQuery.data) ? assignmentsQuery.data : emptyAssignments), [assignmentsQuery.data]);

  const expiringPermits = React.useMemo(() => permits.filter((permit) => ['Expires soon', 'Reminder window'].includes(expiryHealth(permit.validUntil).label)).length, [permits]);
  const openReviews = React.useMemo(() => permits.filter((permit) => permit.status === 'UNDER_REVIEW' || permit.status === 'OPEN').length, [permits]);

  const permitColumns = React.useMemo(() => [
    {
      key: 'document',
      header: 'Work permit',
      cell: (row: WorkAuthorizationCase) => (
        <div>
          <p className="font-mono text-sm font-semibold text-slate-950">{row.documentNumber ?? 'Pending document'}</p>
          <p className="text-xs text-slate-500">{humanize(row.authorizationType)} - Issued in {row.issuingCountry}</p>
        </div>
      ),
    },
    {
      key: 'worker',
      header: 'Worker',
      cell: (row: WorkAuthorizationCase) => <span className="font-mono text-xs text-slate-700">{row.workerId}</span>,
    },
    {
      key: 'validity',
      header: 'Validity',
      cell: (row: WorkAuthorizationCase) => (
        <div>
          <p className="text-sm font-medium text-slate-900">{formatDate(row.validFrom)} - {formatDate(row.validUntil)}</p>
          <Badge variant="outline" className={expiryHealth(row.validUntil).className}>{expiryHealth(row.validUntil).label}</Badge>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: WorkAuthorizationCase) => <Badge variant="outline" className={statusTone(row.status)}>{humanize(row.status)}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row: WorkAuthorizationCase) => {
        const actions = workPermitCommands(row);
        if (actions.length === 0) return <span className="text-xs text-slate-500">No actions</span>;
        return (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.label}
                disabled={runCommand.isPending}
                size="sm"
                variant={action.variant ?? 'default'}
                onClick={() => runCommand.mutate(action.request)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        );
      },
    },
  ], [runCommand]);

  const assignmentColumns = React.useMemo(() => [
    {
      key: 'assignment',
      header: 'Assignment',
      cell: (row: InternationalAssignment) => (
        <div>
          <p className="font-semibold text-slate-950">{row.assignmentReason}</p>
          <p className="text-xs text-slate-500">{formatDate(row.startDate)} - {formatDate(row.endDate)}</p>
        </div>
      ),
    },
    {
      key: 'route',
      header: 'Countries',
      cell: (row: InternationalAssignment) => (
        <div className="flex items-center gap-2">
          <Badge variant="outline">{row.homeCountry}</Badge>
          <span className="text-xs text-slate-400">to</span>
          <Badge variant="outline">{row.hostCountry}</Badge>
        </div>
      ),
    },
    {
      key: 'expiry',
      header: 'Expiry',
      cell: (row: InternationalAssignment) => <Badge variant="outline" className={expiryHealth(row.endDate).className}>{expiryHealth(row.endDate).label}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: InternationalAssignment) => <Badge variant="outline" className={statusTone(row.status)}>{humanize(row.status)}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row: InternationalAssignment) => {
        const actions = assignmentCommands(row);
        if (actions.length === 0) return <span className="text-xs text-slate-500">No actions</span>;
        return (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.label}
                disabled={runCommand.isPending}
                size="sm"
                variant={action.variant ?? 'default'}
                onClick={() => runCommand.mutate(action.request)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        );
      },
    },
  ], [runCommand]);

  const metricCards = [
    { label: 'Work permits', value: permits.length, icon: ShieldCheck },
    { label: 'Expiring soon', value: expiringPermits, icon: TimerReset },
    { label: 'Assignments', value: assignments.length, icon: Plane },
    { label: 'Open reviews', value: openReviews, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3 bg-[#ecfeff] text-[#0e7490]">Global Workforce</Badge>
          <h1 className="font-headline text-3xl font-semibold text-slate-950">Global HR</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Manage work permits and international assignments with expiry visibility for workforce compliance.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          <Globe2 className="h-4 w-4 text-cyan-700" />
          Immigration reminders follow these expiry dates
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="rounded-xl border-[#e2e8f0]">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
                  <p className="text-2xl font-bold text-slate-950">{metric.value}</p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#ecfeff] text-[#0e7490]">
                  <Icon className="h-5 w-5" />
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {permitsQuery.isError ? <ErrorState error={permitsQuery.error} onRetry={() => permitsQuery.refetch()} /> : null}
      {assignmentsQuery.isError ? <ErrorState error={assignmentsQuery.error} onRetry={() => assignmentsQuery.refetch()} /> : null}

      <h2 className="sr-only">Global HR operations</h2>
      <Tabs defaultValue="permits" className="space-y-4">
        <TabsList>
          <TabsTrigger value="permits">Work Permits</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="permits">
          <Card className="rounded-xl border-[#e2e8f0]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-cyan-700" />
                Work authorization queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={permitColumns}
                data={permits}
                emptyMessage="No work authorization cases found."
                isLoading={permitsQuery.isLoading}
                keyExtractor={(row) => row.id}
                total={permits.length}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments">
          <Card className="rounded-xl border-[#e2e8f0]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plane className="h-5 w-5 text-cyan-700" />
                International assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={assignmentColumns}
                data={assignments}
                emptyMessage="No international assignments found."
                isLoading={assignmentsQuery.isLoading}
                keyExtractor={(row) => row.id}
                total={assignments.length}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4 text-sm text-cyan-900">
        Expiry indicators feed the same immigration reminder jobs used by the scheduler, so HR can act before work authorization or assignment dates become compliance risks.
      </div>
    </div>
  );
}
