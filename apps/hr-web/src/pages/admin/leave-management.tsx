import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { useUIStore } from '@/stores/ui-store';
import { AlertCircle, CalendarCheck, CalendarDays, CheckCircle2, ClipboardList, History, Plus, Save, Scale, Trash2, Umbrella, XCircle } from 'lucide-react';
import type { AbsenceRequest, AttendanceHolidayRule, HcmSetupConfig, LeavePolicy } from '@/types';

type Worker = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId?: string;
};

type LeavePolicyResponse = {
  policies: LeavePolicy[];
  publicHolidays: AttendanceHolidayRule[];
  standardDailyMinutes: number;
  workDays: number[];
};

type LeaveRequestForm = {
  workerId: string;
  absenceType: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  reason: string;
};

type BalanceForm = {
  workerId: string;
  leaveType: string;
  accruedHours: string;
  usedHours: string;
  carriedOverHours: string;
  balanceHours: string;
};

type AuditEntry = {
  id: string;
  actorId: string;
  actorName?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
  details?: Record<string, unknown>;
};

const emptyWorkers: Worker[] = [];
const emptyPolicies: LeavePolicy[] = [];
const emptyRequests: AbsenceRequest[] = [];
const emptyHolidays: AttendanceHolidayRule[] = [];
const emptyAuditEntries: AuditEntry[] = [];

const emptyRequest: LeaveRequestForm = {
  workerId: '',
  absenceType: '',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  reason: '',
};

const emptyBalance: BalanceForm = {
  workerId: '',
  leaveType: '',
  accruedHours: '',
  usedHours: '0',
  carriedOverHours: '0',
  balanceHours: '',
};

function apiData<T>(payload: unknown): T {
  const response = payload as { data?: T; success?: boolean };
  if (response.success === true && response.data !== undefined) return response.data;
  return payload as T;
}

function unwrap<T>(response: { data: unknown }) {
  return apiData<T>(response.data);
}

function workerName(worker: Worker) {
  return `${worker.firstName} ${worker.lastName}`.trim();
}

function displayDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

function unitLabel(unit: string) {
  return unit.toLowerCase();
}

function formatEnum(value?: string) {
  return value ? value.replace(/_/g, ' ') : '-';
}

function errorMessage(error: unknown) {
  const response = (error as { response?: { data?: { message?: unknown; error?: unknown } } }).response;
  const message = response?.data?.message ?? response?.data?.error ?? (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : 'The leave service could not be reached.';
}

export function AdminLeaveManagement() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);
  const [requestForm, setRequestForm] = React.useState<LeaveRequestForm>(emptyRequest);
  const [balanceForm, setBalanceForm] = React.useState<BalanceForm>(emptyBalance);
  const [rejectReasons, setRejectReasons] = React.useState<Record<string, string>>({});
  const [selectedAuditRequestId, setSelectedAuditRequestId] = React.useState<string>('');

  const workersQuery = useQuery({
    queryKey: ['admin-leave-workers'],
    queryFn: async () => unwrap<Worker[]>(await apiClient.get('/hr/core/workers?pageSize=250')),
  });

  const requestsQuery = useQuery({
    queryKey: ['admin-leave-requests'],
    queryFn: async () => unwrap<AbsenceRequest[]>(await apiClient.get('/manager/leave/requests')),
  });

  const policyQuery = useQuery({
    queryKey: ['admin-leave-policies'],
    queryFn: async () => unwrap<LeavePolicyResponse>(await apiClient.get('/employee/absences/policies')),
  });

  // Full leave policy editor (including inactive/system-managed policies), moved here
  // from admin/settings.tsx so leave policy configuration lives on the leave admin page.
  const setupQuery = useApiQuery<HcmSetupConfig>(['hcm-setup'], '/admin/hcm-setup');
  const [policyDrafts, setPolicyDrafts] = React.useState<LeavePolicy[]>([]);

  React.useEffect(() => {
    if (setupQuery.data) setPolicyDrafts(JSON.parse(JSON.stringify(setupQuery.data.leavePolicies)) as LeavePolicy[]);
  }, [setupQuery.data]);

  const savePoliciesMutation = useApiMutation<HcmSetupConfig, Partial<HcmSetupConfig>>(
    '/admin/hcm-setup',
    'patch',
    [['hcm-setup'], ['admin-leave-policies']],
    {
      onSuccess: (result) => {
        setPolicyDrafts(JSON.parse(JSON.stringify(result.leavePolicies)) as LeavePolicy[]);
        addNotification({ title: 'Leave policies saved', message: 'The leave policy changes are now live.', type: 'success', read: false });
      },
      onError: (mutationError) => {
        const message = mutationError instanceof Error ? mutationError.message : 'Unable to save leave policies.';
        addNotification({ title: 'Something went wrong', message, type: 'error', read: false });
      },
    },
  );

  const updatePolicyDraft = (index: number, patch: Partial<LeavePolicy>) => {
    setPolicyDrafts((current) => current.map((policy, rowIndex) => (rowIndex === index ? { ...policy, ...patch } : policy)));
  };

  const addPolicyDraft = () => {
    setPolicyDrafts((current) => [...current, {
      code: `LEAVE_${Date.now().toString().slice(-5)}`,
      label: '',
      active: true,
      unit: 'DAYS',
      paid: true,
      deductFromBalance: true,
      requestableByEmployee: true,
      payrollImpact: 'PAID_LEAVE',
      approvalWorkflow: 'MANAGER',
    }]);
  };

  const removePolicyDraft = (index: number) => {
    setPolicyDrafts((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  const savePolicyDrafts = () => savePoliciesMutation.mutate({ leavePolicies: policyDrafts });

  const selectedPolicy = policyQuery.data?.policies.find((policy) => policy.code === requestForm.absenceType);
  const workers = workersQuery.data ?? emptyWorkers;
  const policies = policyQuery.data?.policies ?? emptyPolicies;
  const requests = requestsQuery.data ?? emptyRequests;
  const holidays = policyQuery.data?.publicHolidays ?? emptyHolidays;
  const pendingRequests = React.useMemo(
    () => requests.filter((request) => request.status === 'PENDING'),
    [requests],
  );
  const selectedAuditRequest = requests.find((request) => request.id === selectedAuditRequestId);

  React.useEffect(() => {
    if (!selectedAuditRequestId && requests.length > 0) {
      setSelectedAuditRequestId((pendingRequests[0] ?? requests[0]).id);
    }
  }, [pendingRequests, requests, selectedAuditRequestId]);

  const auditQuery = useQuery({
    queryKey: ['admin-leave-audit', selectedAuditRequestId],
    enabled: Boolean(selectedAuditRequestId),
    queryFn: async () => {
      if (!selectedAuditRequestId) return emptyAuditEntries;
      const params = new URLSearchParams({ resourceType: 'AbsenceRequest', resourceId: selectedAuditRequestId });
      return unwrap<AuditEntry[]>(await apiClient.get(`/audit?${params.toString()}`));
    },
  });
  const auditEntries = auditQuery.data ?? emptyAuditEntries;

  const invalidateLeave = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-leave-requests'] });
  };

  const createRequest = useMutation({
    mutationFn: async (form: LeaveRequestForm) => {
      const createResponse = unwrap<{ absenceRequestId?: string; data?: { absenceRequestId?: string } }>(await apiClient.post('/absence/leave/absence-requests', {
        workerId: form.workerId,
        absenceType: form.absenceType,
        startDate: form.startDate,
        endDate: selectedPolicy?.unit === 'HOURS' ? form.startDate : form.endDate,
        startTime: selectedPolicy?.unit === 'HOURS' ? form.startTime : undefined,
        endTime: selectedPolicy?.unit === 'HOURS' ? form.endTime : undefined,
        reason: form.reason || undefined,
      }));
      const requestId = createResponse.absenceRequestId ?? createResponse.data?.absenceRequestId;
      if (requestId) {
        await apiClient.post(`/absence/leave/absence-requests/${requestId}/commands/submit`);
      }
    },
    onSuccess: () => {
      setRequestForm(emptyRequest);
      invalidateLeave();
      addNotification({ title: 'Leave request submitted', message: 'The request was created and sent for approval.', type: 'success', read: false });
    },
    onError: (error) => {
      addNotification({ title: 'Something went wrong', message: errorMessage(error), type: 'error', read: false });
    },
  });

  const approveRequest = useMutation({
    mutationFn: async (requestId: string) => apiClient.post(`/manager/leave/requests/${requestId}/approve`),
    onSuccess: (_data, requestId) => {
      invalidateLeave();
      queryClient.invalidateQueries({ queryKey: ['admin-leave-audit', requestId] });
      addNotification({ title: 'Request approved', message: 'The leave request has been approved.', type: 'success', read: false });
    },
    onError: (error) => {
      addNotification({ title: 'Something went wrong', message: errorMessage(error), type: 'error', read: false });
    },
  });

  const rejectRequest = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => (
      apiClient.post(`/manager/leave/requests/${requestId}/reject`, { reason })
    ),
    onSuccess: (_data, variables) => {
      setRejectReasons((current) => {
        const next = { ...current };
        delete next[variables.requestId];
        return next;
      });
      invalidateLeave();
      queryClient.invalidateQueries({ queryKey: ['admin-leave-audit', variables.requestId] });
      addNotification({ title: 'Request rejected', message: 'The leave request has been rejected.', type: 'success', read: false });
    },
    onError: (error) => {
      addNotification({ title: 'Something went wrong', message: errorMessage(error), type: 'error', read: false });
    },
  });

  const createBalance = useMutation({
    mutationFn: async (form: BalanceForm) => apiClient.post('/absence/leave/accrual-balances', {
      workerId: form.workerId,
      leaveType: form.leaveType,
      accruedHours: Number(form.accruedHours),
      usedHours: Number(form.usedHours || 0),
      carriedOverHours: Number(form.carriedOverHours || 0),
      balanceHours: Number(form.balanceHours || form.accruedHours),
      effectiveDate: new Date().toISOString(),
    }),
    onSuccess: () => {
      setBalanceForm(emptyBalance);
      addNotification({ title: 'Balance saved', message: 'The accrual balance was saved.', type: 'success', read: false });
    },
    onError: (error) => {
      addNotification({ title: 'Something went wrong', message: errorMessage(error), type: 'error', read: false });
    },
  });

  const requestColumns = [
    { key: 'employee', header: 'Employee', cell: (row: AbsenceRequest) => row.employeeName ?? workers.find((worker) => worker.id === row.workerId)?.firstName ?? row.workerId },
    { key: 'type', header: 'Type', cell: (row: AbsenceRequest) => row.absenceType ?? row.type },
    {
      key: 'dates',
      header: 'Dates',
      cell: (row: AbsenceRequest) => (
        <span>
          {displayDate(row.startDate)} - {displayDate(row.endDate)}
          {row.startTime && row.endTime ? `, ${row.startTime}-${row.endTime}` : ''}
        </span>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      cell: (row: AbsenceRequest) => row.durationAmount ? `${row.durationAmount} ${unitLabel(row.durationUnit ?? 'days')}` : '-',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: AbsenceRequest) => {
        const variant = row.status === 'APPROVED' ? 'default' : row.status === 'REJECTED' ? 'destructive' : row.status === 'CANCELLED' ? 'outline' : 'secondary';
        return <Badge variant={variant}>{row.status}</Badge>;
      },
    },
    {
      key: 'payroll',
      header: 'Payroll',
      cell: (row: AbsenceRequest) => <Badge variant="outline">{formatEnum(row.payrollImpact) || 'Policy driven'}</Badge>,
    },
    {
      key: 'balance',
      header: 'Balance Impact',
      cell: (row: AbsenceRequest) => row.deductFromBalance ? (
        <span>{row.durationAmount ?? '-'} {unitLabel(row.durationUnit ?? 'days')} deducted on approval</span>
      ) : (
        <span className="text-muted-foreground">No balance deduction</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row: AbsenceRequest) => row.status === 'PENDING' ? (
        <div className="min-w-[18rem] space-y-2">
          <div className="flex gap-2">
            <Button size="sm" onClick={() => approveRequest.mutate(row.id)} disabled={approveRequest.isPending}>
              <CheckCircle2 className="mr-1 h-4 w-4" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => rejectRequest.mutate({ requestId: row.id, reason: rejectReasons[row.id] ?? '' })}
              disabled={rejectRequest.isPending || !(rejectReasons[row.id] ?? '').trim()}
            >
              <XCircle className="mr-1 h-4 w-4" />
              Reject
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedAuditRequestId(row.id)}>
              <History className="mr-1 h-4 w-4" />
              Audit
            </Button>
          </div>
          <Input
            aria-label={`Rejection reason for ${row.employeeName ?? row.workerId}`}
            placeholder="Reason required to reject"
            value={rejectReasons[row.id] ?? ''}
            onChange={(event) => setRejectReasons((current) => ({ ...current, [row.id]: event.target.value }))}
          />
        </div>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setSelectedAuditRequestId(row.id)}>
          <History className="mr-1 h-4 w-4" />
          Audit
        </Button>
      ),
    },
  ];

  const policyColumns = [
    { key: 'code', header: 'Code', cell: (row: LeavePolicy) => row.code },
    { key: 'label', header: 'Policy', cell: (row: LeavePolicy) => <span className="font-medium">{row.label}</span> },
    { key: 'unit', header: 'Unit', cell: (row: LeavePolicy) => row.unit },
    { key: 'entitlement', header: 'Annual Entitlement', cell: (row: LeavePolicy) => row.annualEntitlement ?? '-' },
    { key: 'workflow', header: 'Approval', cell: (row: LeavePolicy) => row.approvalWorkflow.replace(/_/g, ' ') },
    { key: 'payroll', header: 'Payroll Impact', cell: (row: LeavePolicy) => <Badge variant={row.paid ? 'default' : 'outline'}>{row.payrollImpact.replace(/_/g, ' ')}</Badge> },
    { key: 'active', header: 'Employee Requestable', cell: (row: LeavePolicy) => row.active && row.requestableByEmployee ? 'Yes' : 'No' },
  ];

  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/60 py-1 pl-2 pr-3 text-xs font-bold text-slate-600 backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="fusion-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Leave service connected
          </div>
          <h2 className="flex items-center gap-2 font-headline text-3xl font-extrabold tracking-tight">
            <Umbrella className="h-7 w-7 text-primary" />
            <span className="fusion-gradient-text">Leave Management</span>
          </h2>
          <p className="mt-2 text-sm text-slate-500">Admin leave requests, approvals, balances, policies, holidays, and payroll impact.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/system-console/policies">Policy Center</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="fusion-hover rounded-[2rem] bg-gradient-to-br from-indigo-500 to-violet-500 p-5 text-white">
          <p className="text-sm font-medium text-white/85">Open Requests</p>
          <p className="mt-2 text-4xl font-extrabold">{requests.filter((request) => request.status === 'PENDING').length}</p>
        </div>
        <div className="fusion-hover rounded-[2rem] bg-gradient-to-br from-violet-500 to-purple-500 p-5 text-white">
          <p className="text-sm font-medium text-white/85">Approved</p>
          <p className="mt-2 text-4xl font-extrabold">{requests.filter((request) => request.status === 'APPROVED').length}</p>
        </div>
        <div className="fusion-hover rounded-[2rem] bg-gradient-to-br from-teal-500 to-emerald-500 p-5 text-white">
          <p className="text-sm font-medium text-white/85">Leave Policies</p>
          <p className="mt-2 text-4xl font-extrabold">{policies.length}</p>
        </div>
        <div className="fusion-hover rounded-[2rem] bg-gradient-to-br from-amber-500 to-orange-500 p-5 text-white">
          <p className="text-sm font-medium text-white/85">Upcoming Holidays</p>
          <p className="mt-2 text-4xl font-extrabold">{holidays.filter((holiday) => holiday.date >= new Date().toISOString().slice(0, 10)).length}</p>
        </div>
      </div>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="grid gap-4 lg:grid-cols-[24rem_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarCheck className="h-5 w-5" />
                Create Leave Request
              </CardTitle>
              <CardDescription>HR-created requests are validated by the same policy engine and submitted for approval.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(event) => {
                event.preventDefault();
                createRequest.mutate(requestForm);
              }}>
                <div className="space-y-2">
                  <Label htmlFor="leave-worker">Employee</Label>
                  <select id="leave-worker" className="h-10 w-full rounded-lg bg-muted px-3 text-sm" value={requestForm.workerId} onChange={(event) => setRequestForm({ ...requestForm, workerId: event.target.value })} required>
                    <option value="">Select employee</option>
                    {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.employeeId} - {workerName(worker)}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leave-type">Leave Policy</Label>
                  <select id="leave-type" className="h-10 w-full rounded-lg bg-muted px-3 text-sm" value={requestForm.absenceType} onChange={(event) => setRequestForm({ ...requestForm, absenceType: event.target.value })} required>
                    <option value="">Select policy</option>
                    {policies.map((policy) => <option key={policy.code} value={policy.code}>{policy.label} ({policy.unit.toLowerCase()})</option>)}
                  </select>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                  <div className="space-y-2">
                    <Label htmlFor="leave-start">Start Date</Label>
                    <Input id="leave-start" type="date" value={requestForm.startDate} onChange={(event) => setRequestForm({ ...requestForm, startDate: event.target.value })} required />
                  </div>
                  {selectedPolicy?.unit === 'HOURS' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="leave-start-time">Start</Label>
                        <Input id="leave-start-time" type="time" value={requestForm.startTime} onChange={(event) => setRequestForm({ ...requestForm, startTime: event.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="leave-end-time">End</Label>
                        <Input id="leave-end-time" type="time" value={requestForm.endTime} onChange={(event) => setRequestForm({ ...requestForm, endTime: event.target.value })} required />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="leave-end">End Date</Label>
                      <Input id="leave-end" type="date" value={requestForm.endDate} onChange={(event) => setRequestForm({ ...requestForm, endDate: event.target.value })} required />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leave-reason">Reason</Label>
                  <Input id="leave-reason" value={requestForm.reason} onChange={(event) => setRequestForm({ ...requestForm, reason: event.target.value })} />
                </div>
                <div className="grid gap-3 text-sm">
                  <div className="rounded-md border p-3">
                    <p className="font-medium">Policy Result</p>
                    {selectedPolicy ? (
                      <div className="mt-2 space-y-1 text-muted-foreground">
                        <p>{selectedPolicy.label} uses {selectedPolicy.unit.toLowerCase()} and {formatEnum(selectedPolicy.approvalWorkflow)} approval.</p>
                        <p>{selectedPolicy.maxPerRequest !== undefined ? `Max per request: ${selectedPolicy.maxPerRequest} ${unitLabel(selectedPolicy.unit)}` : 'No per-request maximum configured'}.</p>
                        <p>{selectedPolicy.deductFromBalance ? 'Approval deducts from balance.' : 'Approval does not deduct from balance.'}</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-muted-foreground">Select a policy to preview validation.</p>
                    )}
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="font-medium">Payroll Impact</p>
                    <p className="mt-2 text-muted-foreground">{selectedPolicy ? formatEnum(selectedPolicy.payrollImpact) : 'Select a policy to preview payroll treatment.'}</p>
                  </div>
                </div>
                {createRequest.error ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    Policy validation rejected this request: {errorMessage(createRequest.error)}
                  </p>
                ) : null}
                <Button type="submit" disabled={createRequest.isPending}>
                  Submit Request
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ClipboardList className="h-5 w-5" />
                  Pending Queue
                </CardTitle>
                <CardDescription>Requests waiting for manager or HR review.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {requestsQuery.error ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="mr-2 inline h-4 w-4" />
                    Could not load pending requests: {errorMessage(requestsQuery.error)}
                  </div>
                ) : pendingRequests.length > 0 ? pendingRequests.map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50"
                    onClick={() => setSelectedAuditRequestId(request.id)}
                  >
                    <span>
                      <span className="block font-medium">{request.employeeName ?? request.workerId}</span>
                      <span className="text-muted-foreground">{request.absenceType ?? request.type} - {request.durationAmount ?? '-'} {unitLabel(request.durationUnit ?? 'days')}</span>
                    </span>
                    <Badge variant="secondary">{formatEnum(request.payrollImpact)}</Badge>
                  </button>
                )) : (
                  <EmptyState
                    icon={ClipboardList}
                    title="No pending requests"
                    description="Leave requests awaiting review will appear here."
                    className="py-8"
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Leave Requests</CardTitle>
                <CardDescription>Pending requests can be approved or rejected here.</CardDescription>
              </CardHeader>
              <CardContent>
                {requestsQuery.error ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    Could not load leave requests: {errorMessage(requestsQuery.error)}
                  </div>
                ) : (
                  <DataTable columns={requestColumns} data={requests} keyExtractor={(row) => row.id} isLoading={requestsQuery.isLoading} emptyMessage="No leave requests found" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5" />
                  Audit Trail
                </CardTitle>
                <CardDescription>{selectedAuditRequest ? `${selectedAuditRequest.employeeName ?? selectedAuditRequest.workerId} - ${selectedAuditRequest.absenceType ?? selectedAuditRequest.type}` : 'Select a request to view events.'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {auditQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading audit trail...</p>
                ) : auditQuery.error ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    Could not load audit trail: {errorMessage(auditQuery.error)}
                  </div>
                ) : auditEntries.length > 0 ? (
                  auditEntries.map((entry) => (
                    <div key={entry.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{formatEnum(entry.action)}</p>
                        <span className="text-xs text-muted-foreground">{displayDate(entry.timestamp)}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">Actor: {entry.actorName ?? entry.actorId}</p>
                      {entry.details?.rejectionReason ? (
                        <p className="mt-1 text-muted-foreground">Reason: {String(entry.details.rejectionReason)}</p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No audit entries found for this request.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="balances" className="grid gap-4 lg:grid-cols-[24rem_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Create Accrual Balance</CardTitle>
              <CardDescription>Seed or adjust employee leave balances in hours.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(event) => {
                event.preventDefault();
                createBalance.mutate(balanceForm);
              }}>
                <div className="space-y-2">
                  <Label htmlFor="balance-worker">Employee</Label>
                  <select id="balance-worker" className="h-10 w-full rounded-lg bg-muted px-3 text-sm" value={balanceForm.workerId} onChange={(event) => setBalanceForm({ ...balanceForm, workerId: event.target.value })} required>
                    <option value="">Select employee</option>
                    {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.employeeId} - {workerName(worker)}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="balance-policy">Leave Type</Label>
                  <select id="balance-policy" className="h-10 w-full rounded-lg bg-muted px-3 text-sm" value={balanceForm.leaveType} onChange={(event) => setBalanceForm({ ...balanceForm, leaveType: event.target.value })} required>
                    <option value="">Select policy</option>
                    {policies.map((policy) => <option key={policy.code} value={policy.code}>{policy.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="accrued">Accrued Hours</Label>
                    <Input id="accrued" type="number" min="0" value={balanceForm.accruedHours} onChange={(event) => setBalanceForm({ ...balanceForm, accruedHours: event.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="used">Used Hours</Label>
                    <Input id="used" type="number" min="0" value={balanceForm.usedHours} onChange={(event) => setBalanceForm({ ...balanceForm, usedHours: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carried">Carry Over</Label>
                    <Input id="carried" type="number" min="0" value={balanceForm.carriedOverHours} onChange={(event) => setBalanceForm({ ...balanceForm, carriedOverHours: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="balance">Balance Hours</Label>
                    <Input id="balance" type="number" min="0" value={balanceForm.balanceHours} onChange={(event) => setBalanceForm({ ...balanceForm, balanceHours: event.target.value })} />
                  </div>
                </div>
                <Button type="submit" disabled={createBalance.isPending}>Save Balance</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Scale className="h-5 w-5" />
                Balance Operations
              </CardTitle>
              <CardDescription>Use this area to seed balances. Employee balance review is available from the employee leave screen.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Approved deductible leave reduces the employee balance and increases used hours. Seed balances here before approving balance-sensitive requests.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Request Policies</CardTitle>
              <CardDescription>Policies currently requestable by employees, applied during request validation.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={policyColumns} data={policies} keyExtractor={(row) => row.code} isLoading={policyQuery.isLoading} emptyMessage="No leave policies configured" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Leave Policy Editor</CardTitle>
                <CardDescription>
                  Controls whether a leave type is day-based or hour-based, paid or unpaid, requestable, and payroll-impacting.
                  Includes inactive and system-managed policies.
                </CardDescription>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addPolicyDraft}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={savePolicyDrafts}
                  disabled={setupQuery.isLoading || savePoliciesMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {savePoliciesMutation.isPending ? 'Saving...' : 'Save Leave Policies'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {setupQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading leave policy editor...</p>
              ) : (
                <div className="divide-y border-y">
                  {policyDrafts.map((policy, index) => (
                    <div key={`${policy.code}-${index}`} className="grid gap-3 py-3 md:grid-cols-[1fr_1.4fr_.75fr_.75fr_.75fr_.75fr_.9fr_.8fr_3rem]">
                      <Input
                        aria-label="Policy code"
                        value={policy.code}
                        onChange={(event) => updatePolicyDraft(index, { code: event.target.value.toUpperCase().replace(/\s+/g, '_') })}
                      />
                      <Input
                        aria-label="Policy name"
                        value={policy.label}
                        placeholder="Policy name"
                        onChange={(event) => updatePolicyDraft(index, { label: event.target.value })}
                      />
                      <Select value={policy.unit} onValueChange={(value) => updatePolicyDraft(index, { unit: value as LeavePolicy['unit'] })}>
                        <SelectTrigger aria-label="Unit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DAYS">Days</SelectItem>
                          <SelectItem value="HOURS">Hours</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        aria-label="Annual entitlement"
                        type="number"
                        value={policy.annualEntitlement ?? ''}
                        placeholder="Entitlement"
                        onChange={(event) => updatePolicyDraft(index, { annualEntitlement: event.target.value ? Number(event.target.value) : undefined })}
                      />
                      <Input
                        aria-label="Max per request"
                        type="number"
                        value={policy.maxPerRequest ?? ''}
                        placeholder="Max/request"
                        onChange={(event) => updatePolicyDraft(index, { maxPerRequest: event.target.value ? Number(event.target.value) : undefined })}
                      />
                      <Select
                        value={policy.paid ? 'PAID' : 'UNPAID'}
                        onValueChange={(value) => updatePolicyDraft(index, {
                          paid: value === 'PAID',
                          payrollImpact: value === 'PAID' ? (policy.payrollImpact === 'UNPAID_LEAVE' ? 'PAID_LEAVE' : policy.payrollImpact) : 'UNPAID_LEAVE',
                        })}
                      >
                        <SelectTrigger aria-label="Paid or unpaid">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PAID">Paid</SelectItem>
                          <SelectItem value="UNPAID">Unpaid</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={policy.requestableByEmployee ? 'REQUESTABLE' : 'SYSTEM'}
                        onValueChange={(value) => updatePolicyDraft(index, { requestableByEmployee: value === 'REQUESTABLE', systemManaged: value === 'SYSTEM' })}
                      >
                        <SelectTrigger aria-label="Requestable by employee">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="REQUESTABLE">Requestable</SelectItem>
                          <SelectItem value="SYSTEM">System</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={policy.active ? 'ACTIVE' : 'INACTIVE'} onValueChange={(value) => updatePolicyDraft(index, { active: value === 'ACTIVE' })}>
                        <SelectTrigger aria-label="Active status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="INACTIVE">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${policy.label || policy.code}`} onClick={() => removePolicyDraft(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {policyDrafts.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No leave policies configured yet. Use Add to create one.</p>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holidays">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Holiday Calendar</CardTitle>
              <CardDescription>Public holidays are excluded from day-based leave calculations.</CardDescription>
            </CardHeader>
            <CardContent>
              {holidays.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No holidays configured"
                  description="Public holidays from HCM setup will appear here once configured."
                />
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {holidays.map((holiday) => (
                    <div key={`${holiday.date}-${holiday.name}`} className="fusion-glass rounded-2xl p-3">
                      <p className="font-medium">{holiday.name}</p>
                      <p className="text-sm text-muted-foreground">{displayDate(holiday.date)}</p>
                      <Badge variant="outline" className="mt-2">{holiday.countryCode ?? 'Global'}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
