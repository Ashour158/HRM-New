import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileText, HeartHandshake, Plus, Search, ShieldCheck } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { useUIStore } from '@/stores/ui-store';
import { BusinessMetric, BusinessPageHeader, SectionHeading } from '@/components/common/business-page';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { FieldMask } from '@/components/common/field-mask';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ApiEnvelope<T> = { success?: boolean; data?: T };
type IdValue = string | { value?: string } | undefined | null;

interface ErCase {
  id?: IdValue;
  caseNumber?: string;
  subjectWorkerId?: string;
  caseType?: string;
  severity?: string;
  description?: string;
  assignedTo?: string;
  status?: string;
}

interface ErInvestigation {
  id?: IdValue;
  erCaseId?: IdValue;
  leadInvestigatorId?: string;
  findings?: string;
  status?: string;
}

interface DisciplinaryAction {
  id?: IdValue;
  workerId?: string;
  erCaseId?: IdValue;
  actionType?: string;
  severity?: string;
  description?: string;
  effectiveDate?: string;
  status?: string;
}

interface AccommodationCase {
  id?: IdValue;
  workerId?: string;
  requestType?: string;
  description?: string;
  medicalDocumentation?: string;
  accommodationDetails?: string;
  status?: string;
}

interface CreateCaseForm {
  caseNumber: string;
  subjectWorkerId: string;
  caseType: string;
  severity: string;
  description: string;
  openedBy: string;
  assignedTo: string;
}

interface CreateInvestigationForm {
  erCaseId: string;
  leadInvestigatorId: string;
}

interface CreateDisciplinaryForm {
  workerId: string;
  erCaseId: string;
  actionType: string;
  severity: string;
  description: string;
  effectiveDate: string;
}

interface CreateAccommodationForm {
  workerId: string;
  requestType: string;
  description: string;
  medicalDocumentation: string;
  accommodationDetails: string;
}

function unwrap<T>(response: { data?: ApiEnvelope<T> | T }): T {
  const body = response.data as ApiEnvelope<T> | T;
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as ApiEnvelope<T>).data as T;
  }
  return body as T;
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function recordId(value: IdValue): string {
  if (!value) return '';
  return typeof value === 'string' ? value : value.value ?? '';
}

function mutationError(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed.';
}

function statusVariant(status?: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  const normalized = (status ?? '').toUpperCase();
  if (['RESOLVED', 'CLOSED', 'COMPLETED', 'APPROVED', 'EXECUTED', 'IMPLEMENTED'].includes(normalized)) return 'default';
  if (['OPEN', 'DRAFT', 'REQUESTED', 'IN_REVIEW', 'UNDER_INVESTIGATION'].includes(normalized)) return 'secondary';
  if (['REVOKED', 'REJECTED', 'APPEALED'].includes(normalized)) return 'destructive';
  return 'outline';
}

function statusBadge(status?: string) {
  return <Badge variant={statusVariant(status)}>{status ?? 'OPEN'}</Badge>;
}

function formatDate(value?: string) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function defaultCaseForm(actorId: string): CreateCaseForm {
  return {
    caseNumber: 'ER-2026-0001',
    subjectWorkerId: '',
    caseType: 'GRIEVANCE',
    severity: 'MEDIUM',
    description: 'Confidential employee relations concern',
    openedBy: actorId,
    assignedTo: '',
  };
}

function defaultInvestigationForm(actorId: string, caseId: string): CreateInvestigationForm {
  return { erCaseId: caseId, leadInvestigatorId: actorId };
}

function defaultDisciplinaryForm(workerId: string, caseId: string): CreateDisciplinaryForm {
  return {
    workerId,
    erCaseId: caseId,
    actionType: 'WRITTEN_WARNING',
    severity: 'HIGH',
    description: 'Disciplinary action details',
    effectiveDate: new Date().toISOString().slice(0, 10),
  };
}

function defaultAccommodationForm(workerId: string): CreateAccommodationForm {
  return {
    workerId,
    requestType: 'WORKSTATION_ADJUSTMENT',
    description: 'Accommodation request details',
    medicalDocumentation: '',
    accommodationDetails: '',
  };
}

function MaskedValue({ value }: { value?: string | number }) {
  return <FieldMask value={value} decision="MASKED" />;
}

export function AdminEmployeeRelations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const addNotification = useUIStore((state) => state.addNotification);
  const actorId = user?.id ?? '';
  const [caseDialogOpen, setCaseDialogOpen] = React.useState(false);
  const [investigationDialogOpen, setInvestigationDialogOpen] = React.useState(false);
  const [disciplinaryDialogOpen, setDisciplinaryDialogOpen] = React.useState(false);
  const [accommodationDialogOpen, setAccommodationDialogOpen] = React.useState(false);
  const [caseForm, setCaseForm] = React.useState<CreateCaseForm>(() => defaultCaseForm(actorId));
  const [investigationForm, setInvestigationForm] = React.useState<CreateInvestigationForm>(() => defaultInvestigationForm(actorId, ''));
  const [disciplinaryForm, setDisciplinaryForm] = React.useState<CreateDisciplinaryForm>(() => defaultDisciplinaryForm('', ''));
  const [accommodationForm, setAccommodationForm] = React.useState<CreateAccommodationForm>(() => defaultAccommodationForm(''));

  const casesQuery = useQuery({
    queryKey: ['employee-relations-cases', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => list<ErCase>(unwrap(await apiClient.get(`/employee-relations/cases/tenant/${tenantId}`))),
  });

  const investigationsQuery = useQuery({
    queryKey: ['employee-relations-investigations', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => list<ErInvestigation>(unwrap(await apiClient.get(`/employee-relations/investigations/tenant/${tenantId}`))),
  });

  const disciplinaryQuery = useQuery({
    queryKey: ['employee-relations-disciplinary', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => list<DisciplinaryAction>(unwrap(await apiClient.get(`/employee-relations/disciplinary-actions/tenant/${tenantId}`))),
  });

  const accommodationQuery = useQuery({
    queryKey: ['employee-relations-accommodations', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => list<AccommodationCase>(unwrap(await apiClient.get(`/employee-relations/accommodation-cases/tenant/${tenantId}`))),
  });

  const cases = casesQuery.data ?? [];
  const investigations = investigationsQuery.data ?? [];
  const disciplinaryActions = disciplinaryQuery.data ?? [];
  const accommodations = accommodationQuery.data ?? [];
  const firstCase = cases[0];
  const firstCaseId = recordId(firstCase?.id);
  const firstWorkerId = firstCase?.subjectWorkerId ?? '';

  React.useEffect(() => {
    setCaseForm((current) => ({ ...current, openedBy: current.openedBy || actorId }));
    setInvestigationForm((current) => ({ ...current, leadInvestigatorId: current.leadInvestigatorId || actorId, erCaseId: current.erCaseId || firstCaseId }));
    setDisciplinaryForm((current) => ({ ...current, erCaseId: current.erCaseId || firstCaseId, workerId: current.workerId || firstWorkerId }));
    setAccommodationForm((current) => ({ ...current, workerId: current.workerId || firstWorkerId }));
  }, [actorId, firstCaseId, firstWorkerId]);

  const invalidateEr = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['employee-relations-cases'] });
    void queryClient.invalidateQueries({ queryKey: ['employee-relations-investigations'] });
    void queryClient.invalidateQueries({ queryKey: ['employee-relations-disciplinary'] });
    void queryClient.invalidateQueries({ queryKey: ['employee-relations-accommodations'] });
  }, [queryClient]);

  const createCaseMutation = useMutation({
    mutationFn: async (payload: CreateCaseForm) => apiClient.post('/employee-relations/cases', {
      caseNumber: payload.caseNumber,
      subjectWorkerId: payload.subjectWorkerId,
      caseType: payload.caseType,
      severity: payload.severity,
      description: payload.description,
      openedBy: payload.openedBy || actorId,
      assignedTo: payload.assignedTo || undefined,
    }),
    onSuccess: () => {
      setCaseDialogOpen(false);
      setCaseForm(defaultCaseForm(actorId));
      addNotification({ title: 'Case opened', message: 'The employee relations case was created.', type: 'success', read: false });
      invalidateEr();
    },
    onError: (error) => addNotification({ title: 'Could not open case', message: mutationError(error), type: 'error', read: false }),
  });

  const createInvestigationMutation = useMutation({
    mutationFn: async (payload: CreateInvestigationForm) => apiClient.post('/employee-relations/investigations', payload),
    onSuccess: () => {
      setInvestigationDialogOpen(false);
      setInvestigationForm(defaultInvestigationForm(actorId, firstCaseId));
      addNotification({ title: 'Investigation opened', message: 'The investigation is ready for evidence review.', type: 'success', read: false });
      invalidateEr();
    },
    onError: (error) => addNotification({ title: 'Could not open investigation', message: mutationError(error), type: 'error', read: false }),
  });

  const createDisciplinaryMutation = useMutation({
    mutationFn: async (payload: CreateDisciplinaryForm) => apiClient.post('/employee-relations/disciplinary-actions', payload),
    onSuccess: () => {
      setDisciplinaryDialogOpen(false);
      setDisciplinaryForm(defaultDisciplinaryForm(firstWorkerId, firstCaseId));
      addNotification({ title: 'Disciplinary action drafted', message: 'The action is ready for approval.', type: 'success', read: false });
      invalidateEr();
    },
    onError: (error) => addNotification({ title: 'Could not draft action', message: mutationError(error), type: 'error', read: false }),
  });

  const createAccommodationMutation = useMutation({
    mutationFn: async (payload: CreateAccommodationForm) => apiClient.post('/employee-relations/accommodation-cases', {
      workerId: payload.workerId,
      requestType: payload.requestType,
      description: payload.description,
      medicalDocumentation: payload.medicalDocumentation || undefined,
      accommodationDetails: payload.accommodationDetails || undefined,
    }),
    onSuccess: () => {
      setAccommodationDialogOpen(false);
      setAccommodationForm(defaultAccommodationForm(firstWorkerId));
      addNotification({ title: 'Accommodation case created', message: 'The case is ready for review.', type: 'success', read: false });
      invalidateEr();
    },
    onError: (error) => addNotification({ title: 'Could not create accommodation', message: mutationError(error), type: 'error', read: false }),
  });

  const commandMutation = useMutation({
    mutationFn: async ({ path, body }: { path: string; body?: Record<string, unknown> }) => apiClient.post(path, body ?? {}),
    onSuccess: () => {
      addNotification({ title: 'Employee relations action completed', message: 'The record was updated.', type: 'success', read: false });
      invalidateEr();
    },
    onError: (error) => addNotification({ title: 'Action failed', message: mutationError(error), type: 'error', read: false }),
  });

  const caseColumns = React.useMemo<DataTableColumn<ErCase>[]>(() => [
    {
      key: 'case',
      header: 'Case',
      cell: (item) => (
        <div>
          <p className="font-semibold text-foreground">{item.caseNumber ?? 'ER case'}</p>
          <p className="text-xs text-muted-foreground">{item.caseType ?? 'Case'} · {item.severity ?? 'Severity not set'}</p>
        </div>
      ),
    },
    { key: 'subject', header: 'Subject', cell: (item) => <MaskedValue value={item.subjectWorkerId} /> },
    { key: 'description', header: 'Details', cell: (item) => <MaskedValue value={item.description} /> },
    { key: 'status', header: 'Status', cell: (item) => statusBadge(item.status) },
    {
      key: 'actions',
      header: 'Actions',
      cell: (item) => {
        const id = recordId(item.id);
        const label = item.caseNumber ?? 'case';
        const commands = [
          ['Review', 'review'],
          ['Start investigation', 'start-investigation'],
          ['Move to disciplinary', 'move-to-disciplinary'],
          ['Resolve', 'resolve'],
          ['Close', 'close'],
        ] as const;
        return (
          <div className="flex flex-wrap gap-2">
            {commands.map(([name, command]) => (
              <Button
                aria-label={`${name} ${label}`}
                disabled={!id || commandMutation.isPending}
                key={command}
                onClick={() => commandMutation.mutate({ path: `/employee-relations/cases/${id}/commands/${command}` })}
                size="sm"
                type="button"
                variant="outline"
              >
                {name}
              </Button>
            ))}
          </div>
        );
      },
    },
  ], [commandMutation]);

  const investigationColumns = React.useMemo<DataTableColumn<ErInvestigation>[]>(() => [
    { key: 'case', header: 'Case', cell: (item) => <MaskedValue value={recordId(item.erCaseId)} /> },
    { key: 'investigator', header: 'Lead investigator', cell: (item) => <MaskedValue value={item.leadInvestigatorId} /> },
    { key: 'findings', header: 'Findings', cell: (item) => <MaskedValue value={item.findings} /> },
    { key: 'status', header: 'Status', cell: (item) => statusBadge(item.status) },
    {
      key: 'actions',
      header: 'Actions',
      cell: (item) => {
        const id = recordId(item.id);
        return (
          <div className="flex flex-wrap gap-2">
            <Button aria-label="Start investigation" disabled={!id || commandMutation.isPending} onClick={() => commandMutation.mutate({ path: `/employee-relations/investigations/${id}/commands/start` })} size="sm" type="button" variant="outline">Start</Button>
            <Button aria-label="Review evidence" disabled={!id || commandMutation.isPending} onClick={() => commandMutation.mutate({ path: `/employee-relations/investigations/${id}/commands/review-evidence` })} size="sm" type="button" variant="outline">Review Evidence</Button>
            <Button aria-label="Complete investigation" disabled={!id || commandMutation.isPending} onClick={() => commandMutation.mutate({ path: `/employee-relations/investigations/${id}/commands/complete` })} size="sm" type="button" variant="outline">Complete</Button>
          </div>
        );
      },
    },
  ], [commandMutation]);

  const disciplinaryColumns = React.useMemo<DataTableColumn<DisciplinaryAction>[]>(() => [
    {
      key: 'action',
      header: 'Action',
      cell: (item) => (
        <div>
          <p className="font-semibold text-foreground">{item.actionType ?? 'Disciplinary action'}</p>
          <p className="text-xs text-muted-foreground">{item.severity ?? 'Severity'} · {formatDate(item.effectiveDate)}</p>
        </div>
      ),
    },
    { key: 'worker', header: 'Worker', cell: (item) => <MaskedValue value={item.workerId} /> },
    { key: 'details', header: 'Details', cell: (item) => <MaskedValue value={item.description} /> },
    { key: 'status', header: 'Status', cell: (item) => statusBadge(item.status) },
    {
      key: 'actions',
      header: 'Actions',
      cell: (item) => {
        const id = recordId(item.id);
        const commands = [
          ['Approve', 'approve', { approvedBy: actorId }],
          ['Execute', 'execute', {}],
          ['Appeal', 'appeal', {}],
          ['Uphold', 'uphold', {}],
          ['Revoke', 'revoke', {}],
        ] as const;
        return (
          <div className="flex flex-wrap gap-2">
            {commands.map(([name, command, body]) => (
              <Button
                aria-label={`${name} disciplinary action`}
                disabled={!id || commandMutation.isPending}
                key={command}
                onClick={() => commandMutation.mutate({ path: `/employee-relations/disciplinary-actions/${id}/commands/${command}`, body })}
                size="sm"
                type="button"
                variant="outline"
              >
                {name}
              </Button>
            ))}
          </div>
        );
      },
    },
  ], [actorId, commandMutation]);

  const accommodationColumns = React.useMemo<DataTableColumn<AccommodationCase>[]>(() => [
    {
      key: 'request',
      header: 'Request',
      cell: (item) => (
        <div>
          <p className="font-semibold text-foreground">{item.requestType ?? 'Accommodation'}</p>
          <p className="text-xs text-muted-foreground">Worker <MaskedValue value={item.workerId} /></p>
        </div>
      ),
    },
    { key: 'medical', header: 'Documentation', cell: (item) => <MaskedValue value={item.medicalDocumentation} /> },
    { key: 'status', header: 'Status', cell: (item) => statusBadge(item.status) },
    {
      key: 'actions',
      header: 'Actions',
      cell: (item) => {
        const id = recordId(item.id);
        const commands = [
          ['Review', 'review', {}],
          ['Approve', 'approve', { approvedBy: actorId }],
          ['Implement', 'implement', {}],
          ['Close', 'close', {}],
          ['Reject', 'reject', {}],
        ] as const;
        return (
          <div className="flex flex-wrap gap-2">
            {commands.map(([name, command, body]) => (
              <Button
                disabled={!id || commandMutation.isPending}
                key={command}
                onClick={() => commandMutation.mutate({ path: `/employee-relations/accommodation-cases/${id}/commands/${command}`, body })}
                size="sm"
                type="button"
                variant="outline"
              >
                {name}
              </Button>
            ))}
          </div>
        );
      },
    },
  ], [actorId, commandMutation]);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-6 lg:p-8">
      <BusinessPageHeader
        eyebrow="People Risk"
        icon={ShieldCheck}
        title="Employee Relations"
        subtitle="Manage confidential cases, investigations, disciplinary actions, and accommodation requests."
        actions={(
          <Dialog open={caseDialogOpen} onOpenChange={setCaseDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button">
                <Plus className="mr-2 h-4 w-4" />
                Open Case
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Open Case</DialogTitle>
                <DialogDescription>Create a confidential employee relations case for the selected tenant.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="er-case-number">Case number</Label>
                    <Input id="er-case-number" value={caseForm.caseNumber} onChange={(event) => setCaseForm((current) => ({ ...current, caseNumber: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="er-subject-worker">Subject worker ID</Label>
                    <Input id="er-subject-worker" value={caseForm.subjectWorkerId} onChange={(event) => setCaseForm((current) => ({ ...current, subjectWorkerId: event.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="er-case-type">Case type</Label>
                    <Input id="er-case-type" value={caseForm.caseType} onChange={(event) => setCaseForm((current) => ({ ...current, caseType: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="er-severity">Severity</Label>
                    <Input id="er-severity" value={caseForm.severity} onChange={(event) => setCaseForm((current) => ({ ...current, severity: event.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="er-description">Description</Label>
                  <textarea
                    className="min-h-24 w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                    id="er-description"
                    value={caseForm.description}
                    onChange={(event) => setCaseForm((current) => ({ ...current, description: event.target.value }))}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="er-opened-by">Opened by</Label>
                    <Input id="er-opened-by" value={caseForm.openedBy} onChange={(event) => setCaseForm((current) => ({ ...current, openedBy: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="er-assigned-to">Assigned to</Label>
                    <Input id="er-assigned-to" value={caseForm.assignedTo} onChange={(event) => setCaseForm((current) => ({ ...current, assignedTo: event.target.value }))} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCaseDialogOpen(false)}>Cancel</Button>
                <Button
                  disabled={createCaseMutation.isPending || !caseForm.caseNumber.trim() || !caseForm.subjectWorkerId.trim()}
                  onClick={() => createCaseMutation.mutate(caseForm)}
                  type="button"
                >
                  Save Case
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <BusinessMetric label="Open Cases" value={cases.filter((item) => !['CLOSED', 'RESOLVED'].includes((item.status ?? '').toUpperCase())).length} tone="warning" />
        <BusinessMetric label="Investigations" value={investigations.length} />
        <BusinessMetric label="Disciplinary" value={disciplinaryActions.length} />
        <BusinessMetric label="Accommodations" value={accommodations.length} />
      </div>

      <Tabs defaultValue="cases">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="investigations">Investigations</TabsTrigger>
          <TabsTrigger value="disciplinary">Disciplinary</TabsTrigger>
          <TabsTrigger value="accommodations">Accommodations</TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="mt-6">
          <Card>
            <CardHeader>
              <SectionHeading title="Case Queue" />
            </CardHeader>
            <CardContent>
              <DataTable columns={caseColumns} data={cases} emptyMessage="No employee relations cases are open." isLoading={casesQuery.isLoading} keyExtractor={(item) => recordId(item.id) || item.caseNumber || 'case'} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="investigations" className="mt-6">
          <Card>
            <CardHeader>
              <SectionHeading
                title="Investigations"
                actions={(
                  <Dialog open={investigationDialogOpen} onOpenChange={setInvestigationDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => setInvestigationForm(defaultInvestigationForm(actorId, firstCaseId))} type="button" variant="outline">
                        <Search className="mr-2 h-4 w-4" />
                        Open Investigation
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Open Investigation</DialogTitle>
                        <DialogDescription>Start an investigation linked to an ER case.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-2">
                        <div className="space-y-2">
                          <Label htmlFor="investigation-case">ER case ID</Label>
                          <Input id="investigation-case" value={investigationForm.erCaseId} onChange={(event) => setInvestigationForm((current) => ({ ...current, erCaseId: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lead-investigator">Lead investigator ID</Label>
                          <Input id="lead-investigator" value={investigationForm.leadInvestigatorId} onChange={(event) => setInvestigationForm((current) => ({ ...current, leadInvestigatorId: event.target.value }))} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setInvestigationDialogOpen(false)}>Cancel</Button>
                        <Button disabled={createInvestigationMutation.isPending || !investigationForm.erCaseId.trim()} onClick={() => createInvestigationMutation.mutate(investigationForm)} type="button">Save Investigation</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              />
            </CardHeader>
            <CardContent>
              <DataTable columns={investigationColumns} data={investigations} emptyMessage="No investigations are open." isLoading={investigationsQuery.isLoading} keyExtractor={(item) => recordId(item.id) || recordId(item.erCaseId)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disciplinary" className="mt-6">
          <Card>
            <CardHeader>
              <SectionHeading
                title="Disciplinary Actions"
                actions={(
                  <Dialog open={disciplinaryDialogOpen} onOpenChange={setDisciplinaryDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => setDisciplinaryForm(defaultDisciplinaryForm(firstWorkerId, firstCaseId))} type="button" variant="outline">
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        Draft Action
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Draft Disciplinary Action</DialogTitle>
                        <DialogDescription>Prepare an action for approval and execution.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-2">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="disciplinary-worker">Worker ID</Label>
                            <Input id="disciplinary-worker" value={disciplinaryForm.workerId} onChange={(event) => setDisciplinaryForm((current) => ({ ...current, workerId: event.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="disciplinary-case">ER case ID</Label>
                            <Input id="disciplinary-case" value={disciplinaryForm.erCaseId} onChange={(event) => setDisciplinaryForm((current) => ({ ...current, erCaseId: event.target.value }))} />
                          </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="space-y-2">
                            <Label htmlFor="disciplinary-type">Action type</Label>
                            <Input id="disciplinary-type" value={disciplinaryForm.actionType} onChange={(event) => setDisciplinaryForm((current) => ({ ...current, actionType: event.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="disciplinary-severity">Severity</Label>
                            <Input id="disciplinary-severity" value={disciplinaryForm.severity} onChange={(event) => setDisciplinaryForm((current) => ({ ...current, severity: event.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="disciplinary-effective-date">Effective date</Label>
                            <Input id="disciplinary-effective-date" type="date" value={disciplinaryForm.effectiveDate} onChange={(event) => setDisciplinaryForm((current) => ({ ...current, effectiveDate: event.target.value }))} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="disciplinary-description">Description</Label>
                          <textarea className="min-h-24 w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20" id="disciplinary-description" value={disciplinaryForm.description} onChange={(event) => setDisciplinaryForm((current) => ({ ...current, description: event.target.value }))} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDisciplinaryDialogOpen(false)}>Cancel</Button>
                        <Button disabled={createDisciplinaryMutation.isPending || !disciplinaryForm.workerId.trim() || !disciplinaryForm.erCaseId.trim()} onClick={() => createDisciplinaryMutation.mutate(disciplinaryForm)} type="button">Save Action</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              />
            </CardHeader>
            <CardContent>
              <DataTable columns={disciplinaryColumns} data={disciplinaryActions} emptyMessage="No disciplinary actions are drafted." isLoading={disciplinaryQuery.isLoading} keyExtractor={(item) => recordId(item.id) || `${item.workerId}-${item.actionType}`} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accommodations" className="mt-6">
          <Card>
            <CardHeader>
              <SectionHeading
                title="Accommodation Cases"
                actions={(
                  <Dialog open={accommodationDialogOpen} onOpenChange={setAccommodationDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => setAccommodationForm(defaultAccommodationForm(firstWorkerId))} type="button" variant="outline">
                        <HeartHandshake className="mr-2 h-4 w-4" />
                        Create Accommodation
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Accommodation</DialogTitle>
                        <DialogDescription>Record a confidential accommodation request.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-2">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="accommodation-worker">Worker ID</Label>
                            <Input id="accommodation-worker" value={accommodationForm.workerId} onChange={(event) => setAccommodationForm((current) => ({ ...current, workerId: event.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="accommodation-type">Request type</Label>
                            <Input id="accommodation-type" value={accommodationForm.requestType} onChange={(event) => setAccommodationForm((current) => ({ ...current, requestType: event.target.value }))} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="accommodation-description">Description</Label>
                          <textarea className="min-h-20 w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20" id="accommodation-description" value={accommodationForm.description} onChange={(event) => setAccommodationForm((current) => ({ ...current, description: event.target.value }))} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="accommodation-medical">Medical documentation</Label>
                            <Input id="accommodation-medical" value={accommodationForm.medicalDocumentation} onChange={(event) => setAccommodationForm((current) => ({ ...current, medicalDocumentation: event.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="accommodation-details">Accommodation details</Label>
                            <Input id="accommodation-details" value={accommodationForm.accommodationDetails} onChange={(event) => setAccommodationForm((current) => ({ ...current, accommodationDetails: event.target.value }))} />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setAccommodationDialogOpen(false)}>Cancel</Button>
                        <Button disabled={createAccommodationMutation.isPending || !accommodationForm.workerId.trim()} onClick={() => createAccommodationMutation.mutate(accommodationForm)} type="button">Save Accommodation</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              />
            </CardHeader>
            <CardContent>
              <DataTable columns={accommodationColumns} data={accommodations} emptyMessage="No accommodation cases are open." isLoading={accommodationQuery.isLoading} keyExtractor={(item) => recordId(item.id) || `${item.workerId}-${item.requestType}`} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Confidentiality Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-muted-foreground">
          Case subjects, medical references, findings, and disciplinary details are masked in the workspace and should only be unmasked for authorized review.
        </CardContent>
      </Card>
    </div>
  );
}
