import * as React from 'react';
import { Link } from 'react-router-dom';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/common/form-field';
import { Spinner } from '@/components/ui/loading-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable } from '@/components/common/data-table';
import { AllowedActions } from '@/components/common/allowed-actions';
import { useUIStore } from '@/stores/ui-store';
import { cn, formatDate } from '@/lib/utils';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  FileText,
  Landmark,
  Plus,
  ShieldCheck,
  Umbrella,
} from 'lucide-react';
import type { AbsenceRequest, AttendanceHolidayRule, LeavePolicy } from '@/types';

interface AbsenceBalance {
  type: string;
  label?: string;
  total: number;
  used: number;
  remaining: number;
  unit: string;
}

interface LeavePolicyResponse {
  policies: LeavePolicy[];
  publicHolidays: AttendanceHolidayRule[];
  standardDailyMinutes: number;
  workDays: number[];
}

interface LeaveRequestForm {
  type: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  reason: string;
}

interface LeaveRequestPayload {
  type: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
}

const EMPTY_FORM: LeaveRequestForm = {
  type: '',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  reason: '',
};

const leaveWizardSteps = [
  { id: 'policy', label: 'Policy' },
  { id: 'dates', label: 'Dates' },
  { id: 'review', label: 'Review' },
] as const;

function unitLabel(unit: string, amount?: number) {
  const normalized = unit.toLowerCase();
  if (amount === 1) return normalized.replace(/s$/, '');
  return normalized.endsWith('s') ? normalized : `${normalized}s`;
}

function formatEnum(value?: string) {
  return value ? value.replace(/_/g, ' ') : '-';
}

function errorMessage(error: unknown) {
  const payload = (error as { response?: { data?: unknown } }).response?.data ?? error;
  return extractErrorMessage(payload) ?? 'The leave service could not be reached.';
}

function extractErrorMessage(payload: unknown): string | undefined {
  if (!payload) return undefined;
  if (typeof payload === 'string') return payload;
  if (Array.isArray(payload)) {
    const messages = payload.map(extractErrorMessage).filter((message): message is string => Boolean(message));
    return messages.length > 0 ? messages.join(', ') : undefined;
  }
  if (typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;
  return (
    extractErrorMessage(record.errorMessage)
    ?? extractErrorMessage(record.message)
    ?? extractErrorMessage(record.error)
  );
}

function dateRange(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate) return [];
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const days: string[] = [];
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = new Date(cursor.getTime() + 86400000)) {
    days.push(cursor.toISOString().slice(0, 10));
  }
  return days;
}

function estimateDuration(form: LeaveRequestForm, policy: LeavePolicy | undefined, policyResponse: LeavePolicyResponse | undefined) {
  if (!policy || !form.startDate) return undefined;
  if (policy.unit === 'HOURS') {
    if (!form.startTime || !form.endTime) return undefined;
    const [startHour, startMinute] = form.startTime.split(':').map(Number);
    const [endHour, endMinute] = form.endTime.split(':').map(Number);
    const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
    return minutes > 0 ? Math.round((minutes / 60) * 100) / 100 : undefined;
  }
  const holidays = new Set((policyResponse?.publicHolidays ?? []).map((holiday) => holiday.date));
  const workDays = policyResponse?.workDays ?? [0, 1, 2, 3, 4];
  return dateRange(form.startDate, form.endDate || form.startDate)
    .filter((day) => workDays.includes(new Date(`${day}T00:00:00.000Z`).getUTCDay()) && !holidays.has(day))
    .length;
}

function statusBadgeVariant(status: AbsenceRequest['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'APPROVED') return 'default';
  if (status === 'PENDING') return 'secondary';
  if (status === 'REJECTED') return 'destructive';
  return 'outline';
}

function balancePercent(balance: AbsenceBalance) {
  if (!balance.total || balance.total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((balance.remaining / balance.total) * 100)));
}

function requestDuration(row: AbsenceRequest) {
  if (!row.durationAmount) return '-';
  return `${row.durationAmount} ${unitLabel(row.durationUnit ?? 'days', row.durationAmount)}`;
}

function requestDateLabel(row: AbsenceRequest) {
  const timeLabel = row.startTime && row.endTime ? `, ${row.startTime}-${row.endTime}` : '';
  return `${formatDate(row.startDate)} - ${formatDate(row.endDate)}${timeLabel}`;
}

function dateKeyFromInput(value: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

function daysUntil(startDate: string) {
  const startKey = dateKeyFromInput(startDate);
  if (!startKey) return undefined;
  const today = new Date();
  const todayKey = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())).toISOString().slice(0, 10);
  return Math.floor((new Date(`${startKey}T00:00:00.000Z`).getTime() - new Date(`${todayKey}T00:00:00.000Z`).getTime()) / 86400000);
}

function rangesOverlap(leftStart?: string, leftEnd?: string, rightStart?: string, rightEnd?: string) {
  if (!leftStart || !leftEnd || !rightStart || !rightEnd) return false;
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function RequestCard({ request }: { request: AbsenceRequest }) {
  return (
    <div className="fusion-glass rounded-2xl p-4 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-wider text-[#94a3b8]">{request.type}</p>
          <p className="mt-1 text-sm font-semibold text-[#0f172a]">{requestDateLabel(request)}</p>
        </div>
        <Badge variant={statusBadgeVariant(request.status)} className="shrink-0">
          {request.status}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#94a3b8]">Duration</p>
          <p className="mt-1 text-[#0f172a]">{requestDuration(request)}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#94a3b8]">Payroll</p>
          <p className="mt-1 text-[#0f172a]">{formatEnum(request.payrollImpact ?? (request.paid === false ? 'UNPAID_LEAVE' : 'PAID_LEAVE'))}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-[#475569]">{request.reason || 'No reason provided'}</p>
      <p className="mt-3 text-xs text-[#94a3b8]">Requested {formatDate(request.requestedAt)}</p>
    </div>
  );
}

export function EmployeeTimeOff() {
  const [showForm, setShowForm] = React.useState(false);
  const [requestStep, setRequestStep] = React.useState(0);
  const [formData, setFormData] = React.useState<LeaveRequestForm>(EMPTY_FORM);
  const addNotification = useUIStore((s) => s.addNotification);

  const { data: requests, isLoading: requestsLoading, error: requestsError } = useApiQuery<AbsenceRequest[]>(
    ['employee-absences'],
    '/employee/absences',
  );

  const { data: balances, isLoading: balancesLoading, error: balancesError } = useApiQuery<AbsenceBalance[]>(
    ['employee-absence-balance'],
    '/employee/absences/balance',
  );

  const { data: leavePolicyResponse, isLoading: policiesLoading, error: policiesError } = useApiQuery<LeavePolicyResponse>(
    ['employee-absence-policies'],
    '/employee/absences/policies',
  );

  const createMutation = useApiMutation<AbsenceRequest, LeaveRequestPayload>(
    '/employee/absences',
    'post',
    [['employee-absences'], ['employee-absence-balance']],
  );

  const selectedPolicy = leavePolicyResponse?.policies.find((policy) => policy.code === formData.type);
  const selectedBalance = balances?.find((balance) => balance.type === selectedPolicy?.code || balance.type === formData.type);
  const estimatedDuration = estimateDuration(formData, selectedPolicy, leavePolicyResponse);
  const balanceImpact = selectedBalance && selectedPolicy && estimatedDuration !== undefined
    ? {
      before: selectedBalance.remaining,
      requested: estimatedDuration,
      after: Math.max(selectedBalance.remaining - estimatedDuration, 0),
      over: selectedBalance.remaining - estimatedDuration < 0,
    }
    : undefined;
  const balanceExceeded = Boolean(selectedPolicy?.deductFromBalance && balanceImpact?.over);
  const normalizedFormStart = dateKeyFromInput(formData.startDate);
  const normalizedFormEnd = selectedPolicy?.unit === 'HOURS'
    ? normalizedFormStart
    : dateKeyFromInput(formData.endDate || formData.startDate);
  const overlappingRequest = (requests ?? []).find((request) => (
    (request.status === 'PENDING' || request.status === 'APPROVED')
    && rangesOverlap(normalizedFormStart, normalizedFormEnd, request.startDate, request.endDate)
  ));
  const noticeDays = formData.startDate ? daysUntil(formData.startDate) : undefined;
  const noticeViolation = selectedPolicy?.minNoticeDays !== undefined
    && noticeDays !== undefined
    && noticeDays < selectedPolicy.minNoticeDays;
  const formValidationMessages = [
    balanceExceeded && selectedPolicy && balanceImpact
      ? `${selectedPolicy.label} exceeds your available balance of ${balanceImpact.before} ${unitLabel(selectedPolicy.unit, balanceImpact.before)}.`
      : undefined,
    noticeViolation && selectedPolicy
      ? `${selectedPolicy.label} requires at least ${selectedPolicy.minNoticeDays} days notice. Choose a later start date.`
      : undefined,
    overlappingRequest
      ? `This overlaps an existing ${overlappingRequest.status.toLowerCase()} request from ${formatDate(overlappingRequest.startDate)} to ${formatDate(overlappingRequest.endDate)}.`
      : undefined,
  ].filter((message): message is string => Boolean(message));
  const submitBlocked = createMutation.isPending || formValidationMessages.length > 0;
  const isHourlyRequest = selectedPolicy?.unit === 'HOURS';
  const canContinueFromPolicy = Boolean(formData.type);
  const canContinueFromDates = Boolean(
    selectedPolicy
    && formData.startDate
    && (isHourlyRequest ? formData.startTime && formData.endTime : formData.endDate)
    && formValidationMessages.length === 0
  );
  const upcomingHolidays = (leavePolicyResponse?.publicHolidays ?? [])
    .filter((holiday) => holiday.date >= new Date().toISOString().slice(0, 10))
    .slice(0, 5);
  const pendingRequests = (requests ?? []).filter((request) => request.status === 'PENDING').length;
  const approvedRequests = (requests ?? []).filter((request) => request.status === 'APPROVED').length;
  const totalRemaining = (balances ?? []).reduce((total, balance) => total + Number(balance.remaining || 0), 0);
  const serviceErrors = [
    requestsError ? `Requests: ${errorMessage(requestsError)}` : undefined,
    balancesError ? `Balances: ${errorMessage(balancesError)}` : undefined,
    policiesError ? `Policies: ${errorMessage(policiesError)}` : undefined,
  ].filter(Boolean);
  const isReady = !requestsLoading && !balancesLoading && !policiesLoading && serviceErrors.length === 0;
  const policyDetails = selectedPolicy
    ? [
      `Approval: ${formatEnum(selectedPolicy.approvalWorkflow)}`,
      selectedPolicy.maxPerRequest !== undefined ? `Max per request: ${selectedPolicy.maxPerRequest} ${unitLabel(selectedPolicy.unit, selectedPolicy.maxPerRequest)}` : 'No per-request maximum configured',
      selectedPolicy.minNoticeDays !== undefined ? `Minimum notice: ${selectedPolicy.minNoticeDays} days` : 'No minimum notice configured',
      selectedPolicy.requiresDocumentAfter !== undefined ? `Document required after ${selectedPolicy.requiresDocumentAfter} ${unitLabel(selectedPolicy.unit, selectedPolicy.requiresDocumentAfter)}` : 'No document threshold configured',
      selectedPolicy.deductFromBalance ? 'Deducts from balance' : 'Does not deduct from balance',
    ]
    : [];

  const resetForm = React.useCallback(() => {
    setFormData(EMPTY_FORM);
    setRequestStep(0);
    createMutation.reset();
  }, [createMutation]);

  const handleDialogChange = React.useCallback((open: boolean) => {
    setShowForm(open);
    if (!open) resetForm();
  }, [resetForm]);

  const handlePolicyChange = (policyCode: string) => {
    const policy = leavePolicyResponse?.policies.find((item) => item.code === policyCode);
    setFormData((current) => ({
      ...current,
      type: policyCode,
      endDate: policy?.unit === 'HOURS' ? current.startDate : current.endDate,
      startTime: policy?.unit === 'HOURS' ? current.startTime : '',
      endTime: policy?.unit === 'HOURS' ? current.endTime : '',
    }));
  };

  const updateStartDate = (value: string) => {
    setFormData((current) => {
      const currentPolicy = leavePolicyResponse?.policies.find((policy) => policy.code === current.type);
      return {
        ...current,
        startDate: value,
        endDate: currentPolicy?.unit === 'HOURS' ? value : current.endDate,
      };
    });
  };

  const updateFormField = (field: keyof LeaveRequestForm, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requestStep < leaveWizardSteps.length - 1) {
      if (requestStep === 0 && canContinueFromPolicy) setRequestStep(1);
      if (requestStep === 1 && canContinueFromDates) setRequestStep(2);
      return;
    }
    if (formValidationMessages.length > 0) return;
    const isHourly = isHourlyRequest;
    const payload: LeaveRequestPayload = {
      type: formData.type,
      startDate: formData.startDate,
      endDate: isHourly ? formData.startDate : formData.endDate,
      ...(isHourly ? { startTime: formData.startTime, endTime: formData.endTime } : {}),
      ...(formData.reason.trim() ? { reason: formData.reason.trim() } : {}),
    };
    try {
      const created = await createMutation.mutateAsync(payload);
      const approvalRoute = formatEnum(created.approvalWorkflow ?? selectedPolicy?.approvalWorkflow);
      const evidenceLabel = created.requiresDocument && created.requiredDocumentCodes?.length
        ? ` Evidence required: ${created.requiredDocumentCodes.map(formatEnum).join(', ')}.`
        : '';
      addNotification({
        title: 'Leave request submitted',
        message: `Your request was sent for ${approvalRoute.toLowerCase()} approval.${evidenceLabel}`,
        type: 'success',
        read: false,
      });
      setShowForm(false);
      resetForm();
    } catch (err) {
      addNotification({
        title: 'Could not submit leave request',
        message: errorMessage(err),
        type: 'error',
        read: false,
      });
    }
  };

  const columns = [
    { key: 'type', header: 'Type', cell: (row: AbsenceRequest) => row.type, className: 'whitespace-nowrap' },
    {
      key: 'dates',
      header: 'Dates',
      cell: (row: AbsenceRequest) => <span className="whitespace-nowrap">{requestDateLabel(row)}</span>,
    },
    {
      key: 'duration',
      header: 'Duration',
      cell: (row: AbsenceRequest) => requestDuration(row),
      className: 'whitespace-nowrap',
    },
    {
      key: 'payroll',
      header: 'Payroll',
      cell: (row: AbsenceRequest) => (
        <Badge variant={row.payrollImpact === 'UNPAID_LEAVE' ? 'destructive' : 'outline'} className="whitespace-nowrap">
          {formatEnum(row.payrollImpact ?? (row.paid === false ? 'UNPAID_LEAVE' : 'PAID_LEAVE'))}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: AbsenceRequest) => <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'reason',
      header: 'Reason',
      cell: (row: AbsenceRequest) => <span className="line-clamp-2 min-w-48 text-[#475569]">{row.reason || '-'}</span>,
    },
    {
      key: 'requested',
      header: 'Requested',
      cell: (row: AbsenceRequest) => <span className="whitespace-nowrap">{formatDate(row.requestedAt)}</span>,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_8px_28px_rgba(0,0,0,0.06)]">
        <div className="grid gap-5 border-b border-[#e2e8f0]/70 bg-[#f6f7fb] p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-[#4f46e5]/30 bg-[#8b5cf6]/10 text-[#4f46e5]">Self-service</Badge>
              <Badge variant="outline" className="border-[#6366f1]/30 bg-[#6366f1]/10 text-[#6366f1]">Policy-driven</Badge>
            </div>
            <h2 className="mt-3 flex items-center gap-3 text-2xl font-bold text-[#0f172a] sm:text-3xl">
              <Umbrella className="h-7 w-7 text-[#4f46e5]" />
              Time Off
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#475569]">
              Review balances, plan around public holidays, and submit day-based leave or hourly permission requests with manager approval and payroll impact.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to="/employee/payslip">
                <Landmark className="mr-2 h-4 w-4" />
                Payslips
              </Link>
            </Button>
            <AllowedActions
              aggregateType="ABSENCE"
              className="w-full sm:w-auto [&>button]:w-full sm:[&>button]:w-auto"
              onAction={() => setShowForm(true)}
            />
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="fusion-glass rounded-2xl p-4">
            <p className="font-mono text-xs uppercase tracking-wider text-[#94a3b8]">Available balance</p>
            <p className="mt-2 text-2xl font-semibold text-[#0f172a]">{totalRemaining}</p>
            <p className="mt-1 text-sm text-[#475569]">Across active balances</p>
          </div>
          <div className="fusion-glass rounded-2xl p-4">
            <p className="font-mono text-xs uppercase tracking-wider text-[#94a3b8]">Pending approval</p>
            <p className="mt-2 text-2xl font-semibold text-[#0f172a]">{pendingRequests}</p>
            <p className="mt-1 text-sm text-[#475569]">Requests waiting for review</p>
          </div>
          <div className="fusion-glass rounded-2xl p-4">
            <p className="font-mono text-xs uppercase tracking-wider text-[#94a3b8]">Approved</p>
            <p className="mt-2 text-2xl font-semibold text-[#0f172a]">{approvedRequests}</p>
            <p className="mt-1 text-sm text-[#475569]">Confirmed requests in history</p>
          </div>
          <div className="fusion-glass rounded-2xl p-4">
            <p className="font-mono text-xs uppercase tracking-wider text-[#94a3b8]">Next holiday</p>
            <p className="mt-2 truncate text-lg font-semibold text-[#0f172a]">{upcomingHolidays[0]?.name ?? 'None configured'}</p>
            <p className="mt-1 text-sm text-[#475569]">{upcomingHolidays[0] ? formatDate(upcomingHolidays[0].date) : 'Setup controls holiday calendars'}</p>
          </div>
        </div>
      </section>

      {serviceErrors.length > 0 ? (
        <div className="rounded-lg border border-[#e11d48]/30 bg-[#e11d48]/5 p-4 text-sm text-[#9f1239]">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Leave service needs attention</p>
              {serviceErrors.map((message) => <p key={message}>{message}</p>)}
            </div>
          </div>
        </div>
      ) : isReady ? (
        <div className="rounded-lg border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 p-3 text-sm text-[#4f46e5]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Balances, policy rules, holidays, and request history are connected.
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {balancesLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)
        ) : balances && balances.length > 0 ? (
          balances.map((balance) => {
            const percent = balancePercent(balance);
            return (
              <Card key={balance.type} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#0f172a]">{balance.label ?? balance.type}</p>
                      <p className="mt-1 font-mono text-xs uppercase tracking-wider text-[#94a3b8]">{balance.type}</p>
                    </div>
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#8b5cf6]/10 text-[#4f46e5]">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-5 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-3xl font-semibold text-[#0f172a]">{balance.remaining}</p>
                      <p className="text-sm text-[#475569]">{unitLabel(balance.unit, balance.remaining)} available</p>
                    </div>
                    <p className="text-right text-sm text-[#475569]">{balance.used} used<br />{balance.total} total</p>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e0e7ff]">
                    <div className="h-full rounded-full bg-[#4f46e5]" style={{ width: `${percent}%` }} />
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="sm:col-span-2 xl:col-span-4">
            <CardContent className="p-5">
              <p className="font-semibold text-[#0f172a]">No leave balances found</p>
              <p className="mt-1 text-sm text-[#475569]">Requestable policies can still be submitted. Balance deductions will appear after balances are configured.</p>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-[#e2e8f0]/70 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-xl">Request History</CardTitle>
                <CardDescription>Approved leave feeds attendance ledgers and payroll readiness.</CardDescription>
              </div>
              <Badge variant="outline" className="w-fit border-[#e2e8f0] bg-[#eef2ff] text-[#475569]">
                {(requests ?? []).length} records
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {requestsError ? (
              <div className="rounded-lg border border-[#e11d48]/30 bg-[#e11d48]/5 p-4 text-sm text-[#9f1239]">
                Could not load leave requests: {errorMessage(requestsError)}
              </div>
            ) : (
              <>
                <div className="hidden md:block">
                  <DataTable
                    columns={columns}
                    data={requests ?? []}
                    keyExtractor={(row) => row.id}
                    isLoading={requestsLoading}
                    emptyMessage="No leave requests yet. Submitted requests will appear here with policy, balance, and payroll impact."
                  />
                </div>
                <div className="space-y-3 md:hidden">
                  {requestsLoading ? (
                    Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-lg" />)
                  ) : requests && requests.length > 0 ? (
                    requests.map((request) => <RequestCard key={request.id} request={request} />)
                  ) : (
                    <div className="rounded-lg border border-[#e2e8f0] bg-[#f6f7fb] p-4 text-sm text-[#475569]">
                      No leave requests yet. Submitted requests will appear here with policy, balance, and payroll impact.
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader className="p-5">
              <CardTitle className="text-xl">Policy Snapshot</CardTitle>
              <CardDescription>Rules applied before a request reaches the manager queue.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              {(leavePolicyResponse?.policies ?? []).slice(0, 4).map((policy) => (
                <div key={policy.code} className="rounded-lg border border-[#e2e8f0] p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[#0f172a]">{policy.label}</p>
                    <Badge variant="outline" className="shrink-0">{policy.unit}</Badge>
                  </div>
                  <p className="mt-1 text-[#475569]">{formatEnum(policy.approvalWorkflow)} approval</p>
                </div>
              ))}
              {policiesLoading ? <Skeleton className="h-20 rounded-lg" /> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-5">
              <CardTitle className="text-xl">Public Holidays</CardTitle>
              <CardDescription>Excluded from day-based leave calculations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              {upcomingHolidays.length > 0 ? upcomingHolidays.map((holiday) => (
                <div key={`${holiday.date}-${holiday.name}`} className="flex items-center justify-between gap-3 rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#0f172a]">{holiday.name}</p>
                    <p className="text-xs text-[#94a3b8]">{formatDate(holiday.date)}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">{holiday.countryCode ?? 'Global'}</Badge>
                </div>
              )) : (
                <p className="text-sm text-[#475569]">No upcoming holidays configured.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <Dialog open={showForm} onOpenChange={handleDialogChange}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-xl border-[#e2e8f0] bg-white p-0">
          <DialogHeader className="border-b border-[#e2e8f0]/70 bg-[#f6f7fb] px-6 py-5 text-left">
            <DialogTitle className="flex items-center gap-2 text-xl text-[#0f172a]">
              <FileText className="h-5 w-5 text-[#4f46e5]" />
              Submit Leave Request
            </DialogTitle>
            <DialogDescription>
              The request is validated against policy, balance, manager approval, and payroll impact before submission.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
            <div className="grid gap-2 sm:grid-cols-3" aria-label="Leave request steps">
              {leaveWizardSteps.map((step, index) => {
                const isActive = index === requestStep;
                const isComplete = index < requestStep;
                return (
                  <button
                    key={step.id}
                    type="button"
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors',
                      isActive && 'border-primary bg-primary/10 text-primary',
                      isComplete && 'border-primary/40 bg-primary/5 text-foreground',
                      !isActive && !isComplete && 'border-border bg-muted/40 text-muted-foreground',
                    )}
                    onClick={() => {
                      if (index === 0 || (index === 1 && canContinueFromPolicy) || (index === 2 && canContinueFromDates)) {
                        setRequestStep(index);
                      }
                    }}
                  >
                    <span className="block text-xs uppercase tracking-wide">Step {index + 1}</span>
                    {step.label}
                  </button>
                );
              })}
            </div>

            {requestStep === 0 ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <FormField id="type" label="Leave Type" required>
                  <Select value={formData.type} onValueChange={handlePolicyChange}>
                    <SelectTrigger aria-label="Leave Type">
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {(leavePolicyResponse?.policies ?? []).map((policy) => (
                        <SelectItem key={policy.code} value={policy.code}>
                          {policy.label} ({policy.unit.toLowerCase()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="font-semibold text-foreground">Policy result</p>
                  <p className="mt-1 text-muted-foreground">
                    {selectedPolicy
                      ? `${estimatedDuration ?? '-'} ${unitLabel(selectedPolicy.unit, estimatedDuration)} - ${formatEnum(selectedPolicy.payrollImpact)}`
                      : 'Select a policy'}
                  </p>
                </div>
                {selectedPolicy ? (
                  <div className="rounded-lg border p-4 text-sm lg:col-span-2">
                    <p className="flex items-center gap-2 font-semibold text-foreground">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Validation
                    </p>
                    <ul className="mt-3 grid gap-1 text-muted-foreground sm:grid-cols-2">
                      {policyDetails.map((detail) => <li key={detail}>{detail}</li>)}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {requestStep === 1 ? (
              <div className="grid gap-4 lg:grid-cols-4">
                <FormField id="startDate" label="Start Date" required>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => updateStartDate(e.target.value)}
                    onInput={(e) => updateStartDate(e.currentTarget.value)}
                  />
                </FormField>
                {isHourlyRequest ? (
                  <>
                    <FormField id="startTime" label="Start" required>
                      <Input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => updateFormField('startTime', e.target.value)}
                        onInput={(e) => updateFormField('startTime', e.currentTarget.value)}
                      />
                    </FormField>
                    <FormField id="endTime" label="End" required>
                      <Input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => updateFormField('endTime', e.target.value)}
                        onInput={(e) => updateFormField('endTime', e.currentTarget.value)}
                      />
                    </FormField>
                  </>
                ) : (
                  <FormField id="endDate" label="End Date" required>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => updateFormField('endDate', e.target.value)}
                      onInput={(e) => updateFormField('endDate', e.currentTarget.value)}
                    />
                  </FormField>
                )}
                <FormField id="reason" label="Reason" className="lg:col-span-4">
                  <Input
                    placeholder="Optional reason for leave"
                    value={formData.reason}
                    onChange={(e) => updateFormField('reason', e.target.value)}
                    onInput={(e) => updateFormField('reason', e.currentTarget.value)}
                  />
                </FormField>
                {selectedPolicy ? (
                  <div className="rounded-lg border p-4 text-sm lg:col-span-4">
                    <p className="font-semibold text-foreground">Balance Impact</p>
                    {selectedPolicy.deductFromBalance ? (
                      balanceImpact ? (
                        <div className="mt-3 grid gap-1 text-muted-foreground sm:grid-cols-3">
                          <p>Current: {balanceImpact.before} {unitLabel(selectedPolicy.unit, balanceImpact.before)}</p>
                          <p>Requested: {balanceImpact.requested} {unitLabel(selectedPolicy.unit, balanceImpact.requested)}</p>
                          <p className={cn(balanceImpact.over && 'font-semibold text-destructive')}>
                            After approval: {balanceImpact.after} {unitLabel(selectedPolicy.unit, balanceImpact.after)}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-3 text-muted-foreground">Select dates to preview balance deduction.</p>
                      )
                    ) : (
                      <p className="mt-3 text-muted-foreground">This policy does not deduct from leave balance.</p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {requestStep === 2 ? (
              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-lg border p-4 text-sm">
                  <p className="font-semibold text-foreground">Request Summary</p>
                  <div className="mt-3 space-y-1 text-muted-foreground">
                    <p>Type: {selectedPolicy?.label ?? '-'}</p>
                    <p>Dates: {formData.startDate || '-'} to {isHourlyRequest ? formData.startDate || '-' : formData.endDate || '-'}</p>
                    <p>Duration: {estimatedDuration ?? '-'} {selectedPolicy ? unitLabel(selectedPolicy.unit, estimatedDuration) : ''}</p>
                  </div>
                </div>
                <div className="rounded-lg border p-4 text-sm">
                  <p className="font-semibold text-foreground">Balance Impact</p>
                  <div className="mt-3 space-y-1 text-muted-foreground">
                    <p>Current: {balanceImpact?.before ?? '-'}</p>
                    <p>Requested: {balanceImpact?.requested ?? '-'}</p>
                    <p>After approval: {balanceImpact?.after ?? '-'}</p>
                  </div>
                </div>
                <div className="rounded-lg border p-4 text-sm">
                  <p className="font-semibold text-foreground">Payroll Impact</p>
                  <p className="mt-3 text-muted-foreground">{formatEnum(selectedPolicy?.payrollImpact)}</p>
                  <p className="text-muted-foreground">{selectedPolicy?.paid ? 'Paid absence' : 'Unpaid absence'}</p>
                </div>
              </div>
            ) : null}

            {formValidationMessages.length > 0 ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <p className="font-semibold">This request needs adjustment before it can be submitted.</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {formValidationMessages.map((message) => <li key={message}>{message}</li>)}
                </ul>
              </div>
            ) : null}

            {createMutation.error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <p className="font-semibold">Leave request was rejected by policy validation.</p>
                <p className="mt-1">{errorMessage(createMutation.error)}</p>
              </div>
            ) : null}

            <DialogFooter className="gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => handleDialogChange(false)}>
                Cancel
              </Button>
              {requestStep > 0 ? (
                <Button type="button" variant="outline" onClick={() => setRequestStep((current) => Math.max(0, current - 1))}>
                  Back
                </Button>
              ) : null}
              <Button
                type="submit"
                disabled={
                  createMutation.isPending
                  || (requestStep === 0 && !canContinueFromPolicy)
                  || (requestStep === 1 && !canContinueFromDates)
                  || (requestStep === 2 && submitBlocked)
                }
              >
                {createMutation.isPending ? (
                  <Spinner className="mr-2" />
                ) : requestStep === leaveWizardSteps.length - 1 ? (
                  <Plus className="mr-2 h-4 w-4" />
                ) : null}
                {requestStep === leaveWizardSteps.length - 1 ? 'Submit Request' : 'Continue'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
