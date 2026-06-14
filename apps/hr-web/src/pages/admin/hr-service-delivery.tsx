import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useTenant } from '@/hooks/use-tenant';
import { useUIStore } from '@/stores/ui-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { cn, formatDate } from '@/lib/utils';
import { CheckCircle2, Clock3, Inbox, LifeBuoy, Search, TimerReset } from 'lucide-react';

type HrServiceCaseStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING_CUSTOMER' | 'RESOLVED' | 'CLOSED' | 'ESCALATED';

interface HrServiceCase {
  id: string;
  caseNumber: string;
  requesterWorkerId: string;
  caseType: string;
  priority: string;
  description: string;
  assignedTo?: string;
  slaDeadline?: string;
  resolvedAt?: string;
  status: HrServiceCaseStatus;
  createdAt: string;
  updatedAt: string;
}

interface HrServiceCatalogItem {
  id: string;
  serviceCode: string;
  serviceName: string;
  description?: string;
  category: string;
  slaHours: number;
  status: 'ACTIVE' | 'SUSPENDED' | 'RETIRED';
}

const emptyCases: HrServiceCase[] = [];
const emptyCatalog: HrServiceCatalogItem[] = [];

function apiData<T>(payload: unknown): T {
  const response = payload as { data?: T; success?: boolean };
  if (response.success === true && response.data !== undefined) return response.data;
  return payload as T;
}

function unwrap<T>(response: { data: unknown }) {
  return apiData<T>(response.data);
}

function formatCaseType(value: string) {
  return value.replace(/_/g, ' ');
}

function isClosed(status: HrServiceCaseStatus) {
  return status === 'RESOLVED' || status === 'CLOSED';
}

function slaHealth(serviceCase: Pick<HrServiceCase, 'slaDeadline' | 'status'>) {
  if (!serviceCase.slaDeadline) return { label: 'SLA not set', tone: 'border-slate-200 bg-slate-50 text-slate-600' };
  if (isClosed(serviceCase.status)) return { label: 'SLA complete', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' };

  const deadline = new Date(serviceCase.slaDeadline).getTime();
  if (Number.isNaN(deadline)) return { label: 'SLA not set', tone: 'border-slate-200 bg-slate-50 text-slate-600' };

  const hoursRemaining = (deadline - Date.now()) / 36e5;
  if (hoursRemaining < 0) return { label: 'SLA breached', tone: 'border-red-200 bg-red-50 text-red-700' };
  if (hoursRemaining <= 24) return { label: 'SLA due soon', tone: 'border-amber-200 bg-amber-50 text-amber-700' };
  return { label: 'SLA on track', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
}

function statusTone(status: HrServiceCaseStatus) {
  if (status === 'RESOLVED' || status === 'CLOSED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'ESCALATED') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'PENDING_CUSTOMER') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-indigo-200 bg-indigo-50 text-indigo-700';
}

function caseActions(status: HrServiceCaseStatus) {
  if (status === 'OPEN') return [{ command: 'mark-in-progress', label: 'Start work' }];
  if (status === 'IN_PROGRESS') {
    return [
      { command: 'mark-pending-customer', label: 'Need employee input', variant: 'outline' as const },
      { command: 'resolve', label: 'Resolve' },
    ];
  }
  if (status === 'PENDING_CUSTOMER') return [{ command: 'resolve', label: 'Resolve' }];
  if (status === 'RESOLVED') return [{ command: 'close', label: 'Close' }];
  return [];
}

export function AdminHrServiceDelivery() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const addNotification = useUIStore((state) => state.addNotification);
  const [search, setSearch] = React.useState('');

  const casesQuery = useQuery({
    enabled: Boolean(tenantId),
    queryKey: ['admin-hr-service-cases', tenantId],
    queryFn: async () => unwrap<HrServiceCase[]>(await apiClient.get(`/hr-service-delivery/cases/tenant/${tenantId}`)),
  });

  const catalogQuery = useQuery({
    enabled: Boolean(tenantId),
    queryKey: ['admin-hr-service-catalog', tenantId],
    queryFn: async () => unwrap<HrServiceCatalogItem[]>(await apiClient.get('/hr-service-delivery/catalog-items')),
  });

  const runCaseCommand = useMutation({
    mutationFn: async ({ caseId, command }: { caseId: string; command: string }) => apiClient.post(`/hr-service-delivery/cases/${caseId}/commands/${command}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-hr-service-cases', tenantId] });
      addNotification({ title: 'Case updated', message: 'The HR service case moved to the next step.', type: 'success', read: false });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to update the case.';
      addNotification({ title: 'Case update failed', message, type: 'error', read: false });
    },
  });

  const cases = React.useMemo(() => (Array.isArray(casesQuery.data) ? casesQuery.data : emptyCases), [casesQuery.data]);
  const catalog = React.useMemo(() => (Array.isArray(catalogQuery.data) ? catalogQuery.data : emptyCatalog), [catalogQuery.data]);
  const filteredCases = React.useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return cases;
    return cases.filter((serviceCase) => `${serviceCase.caseNumber} ${serviceCase.caseType} ${serviceCase.priority} ${serviceCase.description} ${serviceCase.status}`.toLowerCase().includes(normalized));
  }, [cases, search]);

  const openCases = cases.filter((serviceCase) => !isClosed(serviceCase.status)).length;
  const breachedCases = cases.filter((serviceCase) => slaHealth(serviceCase).label === 'SLA breached').length;
  const resolvedCases = cases.filter((serviceCase) => isClosed(serviceCase.status)).length;

  const columns = React.useMemo(() => [
    {
      key: 'case',
      header: 'Case',
      cell: (row: HrServiceCase) => (
        <div>
          <p className="font-mono font-semibold text-slate-950">{row.caseNumber}</p>
          <p className="text-xs text-slate-500">{formatDate(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row: HrServiceCase) => (
        <div>
          <p className="font-semibold uppercase text-slate-900">{formatCaseType(row.caseType)}</p>
          <p className="max-w-[22rem] truncate text-xs text-slate-500">{row.description}</p>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      cell: (row: HrServiceCase) => <Badge variant={row.priority === 'URGENT' || row.priority === 'HIGH' ? 'destructive' : 'outline'}>{row.priority}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: HrServiceCase) => <Badge variant="outline" className={statusTone(row.status)}>{row.status.replace(/_/g, ' ')}</Badge>,
    },
    {
      key: 'sla',
      header: 'SLA',
      cell: (row: HrServiceCase) => {
        const health = slaHealth(row);
        return (
          <div className="space-y-1">
            <Badge variant="outline" className={health.tone}>{health.label}</Badge>
            <p className="text-xs text-slate-500">{formatDate(row.slaDeadline)}</p>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row: HrServiceCase) => {
        const actions = caseActions(row.status);
        if (actions.length === 0) return <span className="text-xs text-slate-500">No actions</span>;
        return (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.command}
                size="sm"
                variant={action.variant ?? 'default'}
                onClick={() => runCaseCommand.mutate({ caseId: row.id, command: action.command })}
              >
                {action.label}
              </Button>
            ))}
          </div>
        );
      },
    },
  ], [runCaseCommand]);

  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3 bg-[#eef2ff] text-[#4f46e5]">Service Operations</Badge>
          <h1 className="font-headline text-3xl font-semibold text-slate-950">HR Service Delivery</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Triage employee HR cases, protect SLA commitments, and move requests through resolution.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input aria-label="Search service cases" className="pl-9" placeholder="Search cases" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>
      <h2 className="sr-only">Service delivery workspace</h2>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: 'Open cases', value: openCases, icon: Inbox },
          { label: 'SLA breached', value: breachedCases, icon: TimerReset },
          { label: 'Resolved', value: resolvedCases, icon: CheckCircle2 },
          { label: 'Catalog items', value: catalog.length, icon: LifeBuoy },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="rounded-xl border-[#e2e8f0]">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
                  <p className="text-2xl font-bold text-slate-950">{metric.value}</p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#eef2ff] text-[#4f46e5]">
                  <Icon className="h-5 w-5" />
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {casesQuery.isError ? <ErrorState error={casesQuery.error} onRetry={() => casesQuery.refetch()} /> : null}

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">Case Queue</TabsTrigger>
          <TabsTrigger value="triage">Triage Board</TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <Card className="rounded-xl border-[#e2e8f0]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <LifeBuoy className="h-5 w-5 text-[#4f46e5]" />
                Case Queue
              </CardTitle>
              <CardDescription>All tenant service cases ordered by latest activity.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={columns} data={filteredCases} keyExtractor={(row) => row.id} isLoading={casesQuery.isLoading} emptyMessage="No service cases found" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="triage">
          {filteredCases.length === 0 && !casesQuery.isLoading ? (
            <EmptyState title="No cases to triage" description="New employee service cases will appear here as soon as they are submitted." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {(['OPEN', 'IN_PROGRESS', 'PENDING_CUSTOMER'] as const).map((status) => (
                <Card key={status} className="rounded-xl border-[#e2e8f0]">
                  <CardHeader>
                    <CardTitle className="text-base">{status.replace(/_/g, ' ')}</CardTitle>
                    <CardDescription>{filteredCases.filter((serviceCase) => serviceCase.status === status).length} active cases</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {filteredCases.filter((serviceCase) => serviceCase.status === status).map((serviceCase) => {
                      const health = slaHealth(serviceCase);
                      return (
                        <div key={serviceCase.id} className={cn('rounded-lg border p-3', health.label === 'SLA breached' ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white')}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-mono text-sm font-semibold">{serviceCase.caseNumber}</p>
                              <p className="mt-1 text-sm text-slate-600">{formatCaseType(serviceCase.caseType)}</p>
                            </div>
                            <Badge variant="outline" className={health.tone}>{health.label}</Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {caseActions(serviceCase.status).map((action) => (
                              <Button key={action.command} size="sm" variant={action.variant ?? 'default'} onClick={() => runCaseCommand.mutate({ caseId: serviceCase.id, command: action.command })}>
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="catalog">
          <Card className="rounded-xl border-[#e2e8f0]">
            <CardHeader>
              <CardTitle className="text-lg">Service Catalog</CardTitle>
              <CardDescription>Services employees can request from self-service.</CardDescription>
            </CardHeader>
            <CardContent>
              {catalogQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4" /> Loading catalog...</div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {catalog.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#4f46e5]">{item.category}</p>
                          <h3 className="mt-1 font-semibold text-slate-950">{item.serviceName}</h3>
                        </div>
                        <Badge variant={item.status === 'ACTIVE' ? 'default' : 'outline'}>{item.status}</Badge>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">{item.description ?? 'Service available to employees.'}</p>
                      <p className="mt-3 text-xs text-slate-500">SLA {item.slaHours}h</p>
                    </div>
                  ))}
                  {catalog.length === 0 ? <EmptyState title="No catalog items" description="Create service catalog entries before employees can request HR services." /> : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
