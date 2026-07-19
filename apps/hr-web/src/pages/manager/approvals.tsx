import * as React from 'react';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { NextActions } from '@/components/common/next-actions';
import { WorkerPicker } from '@/components/common/worker-picker';
import { useUIStore } from '@/stores/ui-store';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, FileText, RefreshCw, Users, Workflow, XCircle } from 'lucide-react';
import type { AbsenceRequest } from '@/types';

interface AttendanceExceptionQueueItem {
  code: string;
  description: string;
  severity: 'HIGH' | 'LOW' | 'MEDIUM';
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'ESCALATED';
  payrollImpactMinutes: number;
  exceptionId?: string;
  workerId: string;
  employeeId: string;
  workerName: string;
  workDate: string;
  firstCheckInAt?: string;
  latestCheckOutAt?: string;
  locationStatus: string;
  policyEvidence?: {
    schedule?: {
      source?: string;
      scheduleId?: string;
      scheduleLabel?: string;
      shiftCode?: string;
      shiftLabel?: string;
    };
    holiday?: {
      name: string;
      scope?: string;
    };
    trust?: {
      minClockTrustScore: number;
      lowTrustBlocksPayroll: boolean;
    };
    flexibleRuleCode?: string;
  };
}

interface AttendanceExceptionQueue {
  workDate: string;
  summary: {
    exceptions: number;
    missingCheckout: number;
    payrollReady: number;
    totalEmployees: number;
  };
  items: AttendanceExceptionQueueItem[];
}

interface AttendanceCorrectionRequest {
  id: string;
  workerId: string;
  workDate: string;
  correctionType: 'ADD_CLOCK_EVENT' | 'EDIT_CLOCK_EVENT' | 'DELETE_CLOCK_EVENT';
  requestedEventType?: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';
  requestedTimestamp?: string;
  reason: string;
  status: 'PENDING_MANAGER_REVIEW' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'CANCELLED';
  requestedAt: string;
}

interface ApprovalWorkflowStep {
  id: string;
  code: string;
  label: string;
  order: number;
  approverRole?: string | null;
  approverWorkerId?: string | null;
  delegatedToWorkerId?: string | null;
  state: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELEGATED' | 'ESCALATED' | 'EXPIRED';
  slaDueAt?: string | null;
  reason?: string | null;
}

interface ApprovalWorkflowChain {
  id: string;
  commandName: string;
  aggregateType: string;
  aggregateId?: string | null;
  status: 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  currentStepOrder?: number | null;
  createdAt: string;
  steps: ApprovalWorkflowStep[];
}

interface ApprovalWorkflowQueue {
  tenantId: string;
  chains: ApprovalWorkflowChain[];
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function hours(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function timeStamp(value?: string) {
  return value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
}

function severityVariant(severity: AttendanceExceptionQueueItem['severity']) {
  if (severity === 'HIGH') return 'destructive' as const;
  if (severity === 'MEDIUM') return 'secondary' as const;
  return 'outline' as const;
}

function errMessage(err: unknown, fallback: string): string {
  const maybe = err as { response?: { data?: { message?: unknown } }; message?: unknown };
  const apiMsg = maybe?.response?.data?.message;
  if (typeof apiMsg === 'string') return apiMsg;
  if (typeof maybe?.message === 'string') return maybe.message;
  return fallback;
}

export function ManagerApprovals() {
  const [date, setDate] = React.useState(todayKey);
  const [delegateTargets, setDelegateTargets] = React.useState<Record<string, string>>({});
  const addNotification = useUIStore((s) => s.addNotification);
  const { data: queue, isLoading, isError, error, refetch } = useApiQuery<AttendanceExceptionQueue>(
    ['manager-attendance-exceptions', date],
    `/time/attendance/exception-queue?date=${encodeURIComponent(date)}`,
  );
  const {
    data: corrections = [],
    isLoading: correctionsLoading,
    isError: correctionsError,
    error: correctionsErr,
    refetch: refetchCorrections,
  } = useApiQuery<AttendanceCorrectionRequest[]>(
    ['manager-attendance-corrections', date],
    `/time/attendance/correction-requests?status=PENDING_MANAGER_REVIEW&date=${encodeURIComponent(date)}`,
  );
  const {
    data: leaveRequests = [],
    isLoading: leaveLoading,
    isError: leaveIsError,
    error: leaveErr,
    refetch: refetchLeave,
  } = useApiQuery<AbsenceRequest[]>(
    ['manager-leave-requests'],
    '/manager/leave/requests?status=PENDING_APPROVAL',
  );
  const {
    data: workflowQueue,
    isLoading: workflowLoading,
    isError: workflowIsError,
    error: workflowErr,
    refetch: refetchWorkflow,
  } = useApiQuery<ApprovalWorkflowQueue>(
    ['manager-workflow-approvals'],
    '/platform/workflow/approval-chains/pending',
  );
  const exceptionMutation = useApiMutation<unknown, { id: string; action: 'review' | 'resolve' | 'escalate' }>(
    (variables) => `/time/attendance/attendance-exceptions/${variables.id}/commands/${variables.action}`,
    'post',
    [['manager-attendance-exceptions', date]],
  );
  const reviewCorrectionMutation = useApiMutation<AttendanceCorrectionRequest, { id: string; decision: 'APPROVE' | 'REJECT'; note?: string }>(
    (variables) => `/time/attendance/correction-requests/${variables.id}/commands/review`,
    'post',
    [['manager-attendance-corrections', date], ['manager-attendance-exceptions', date]],
  );
  const approveLeaveMutation = useApiMutation<AbsenceRequest, { id: string }>(
    (variables) => `/manager/leave/requests/${variables.id}/approve`,
    'post',
    [['manager-leave-requests'], ['manager-dashboard']],
  );
  const rejectLeaveMutation = useApiMutation<AbsenceRequest, { id: string }>(
    (variables) => `/manager/leave/requests/${variables.id}/reject`,
    'post',
    [['manager-leave-requests'], ['manager-dashboard']],
  );
  const approveWorkflowMutation = useApiMutation<unknown, { chainId: string; stepId: string; reason?: string }>(
    (variables) => `/platform/workflow/approval-chains/${variables.chainId}/steps/${variables.stepId}/commands/approve`,
    'post',
    [['manager-workflow-approvals']],
  );
  const rejectWorkflowMutation = useApiMutation<unknown, { chainId: string; stepId: string; reason?: string }>(
    (variables) => `/platform/workflow/approval-chains/${variables.chainId}/steps/${variables.stepId}/commands/reject`,
    'post',
    [['manager-workflow-approvals']],
  );
  const delegateWorkflowMutation = useApiMutation<unknown, { chainId: string; stepId: string; delegateToWorkerId: string; reason?: string }>(
    (variables) => `/platform/workflow/approval-chains/${variables.chainId}/steps/${variables.stepId}/commands/delegate`,
    'post',
    [['manager-workflow-approvals']],
  );
  const escalateWorkflowMutation = useApiMutation<unknown, { chainId: string }>(
    (variables) => `/platform/workflow/approval-chains/${variables.chainId}/commands/escalate-overdue`,
    'post',
    [['manager-workflow-approvals']],
  );

  const items = queue?.items ?? [];
  const workflowChains = React.useMemo(() => workflowQueue?.chains ?? [], [workflowQueue?.chains]);

  const notifyError = (err: unknown, fallback: string) =>
    addNotification({ title: 'Something went wrong', message: errMessage(err, fallback), type: 'error', read: false });

  const handleException = (id: string, action: 'review' | 'resolve' | 'escalate') => {
    exceptionMutation.mutate(
      { id, action },
      {
        onSuccess: () =>
          addNotification({
            title: 'Exception updated',
            message: `The attendance exception was sent to ${action}.`,
            type: 'success',
            read: false,
          }),
        onError: (err) => notifyError(err, 'Unable to update the attendance exception.'),
      },
    );
  };

  const handleCorrection = (id: string, decision: 'APPROVE' | 'REJECT', note: string) => {
    reviewCorrectionMutation.mutate(
      { id, decision, note },
      {
        onSuccess: () =>
          addNotification({
            title: decision === 'APPROVE' ? 'Correction approved' : 'Correction rejected',
            message: 'The attendance correction request was reviewed.',
            type: 'success',
            read: false,
          }),
        onError: (err) => notifyError(err, 'Unable to review the correction request.'),
      },
    );
  };

  const handleApproveLeave = (id: string) => {
    approveLeaveMutation.mutate(
      { id },
      {
        onSuccess: () =>
          addNotification({ title: 'Leave approved', message: 'The leave request was approved.', type: 'success', read: false }),
        onError: (err) => notifyError(err, 'Unable to approve the leave request.'),
      },
    );
  };

  const handleRejectLeave = (id: string) => {
    rejectLeaveMutation.mutate(
      { id },
      {
        onSuccess: () =>
          addNotification({ title: 'Leave rejected', message: 'The leave request was rejected.', type: 'success', read: false }),
        onError: (err) => notifyError(err, 'Unable to reject the leave request.'),
      },
    );
  };

  const handleWorkflowDecision = (chainId: string, stepId: string, action: 'approve' | 'reject') => {
    const mutation = action === 'approve' ? approveWorkflowMutation : rejectWorkflowMutation;
    mutation.mutate(
      { chainId, stepId, reason: action === 'approve' ? 'Approved from manager workspace' : 'Rejected from manager workspace' },
      {
        onSuccess: () => addNotification({ title: action === 'approve' ? 'Approval recorded' : 'Approval rejected', message: 'The workflow queue was updated.', type: 'success', read: false }),
        onError: (err) => notifyError(err, 'Unable to update the workflow approval.'),
      },
    );
  };

  const handleWorkflowDelegate = (chainId: string, stepId: string) => {
    const key = `${chainId}:${stepId}`;
    const delegateToWorkerId = delegateTargets[key]?.trim();
    if (!delegateToWorkerId) {
      addNotification({ title: 'Delegate worker required', message: 'Search for and select a worker to delegate this approval step.', type: 'error', read: false });
      return;
    }
    delegateWorkflowMutation.mutate(
      { chainId, stepId, delegateToWorkerId, reason: 'Delegated from manager workspace' },
      {
        onSuccess: () => {
          setDelegateTargets((current) => {
            const next = { ...current };
            delete next[key];
            return next;
          });
          addNotification({ title: 'Approval delegated', message: 'The approval step was delegated.', type: 'success', read: false });
        },
        onError: (err) => notifyError(err, 'Unable to delegate this workflow approval.'),
      },
    );
  };

  const handleWorkflowEscalate = (chainId: string) => {
    escalateWorkflowMutation.mutate(
      { chainId },
      {
        onSuccess: () => addNotification({ title: 'Approval escalated', message: 'Overdue steps were checked and escalated when due.', type: 'success', read: false }),
        onError: (err) => notifyError(err, 'Unable to escalate this workflow approval.'),
      },
    );
  };

  return (
    <div className="space-y-6">
      <NextActions storageKey="manager-approvals" />

      <div className="flex flex-col gap-4 border-b border-white/40 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/60 py-1 pl-2 pr-3 text-xs font-bold text-slate-600 backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="fusion-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Approvals · live
          </div>
          <h1 className="flex items-center gap-3 font-headline text-3xl font-extrabold tracking-tight md:text-4xl">
            <Clock3 className="h-7 w-7 text-indigo-500" />
            <span className="fusion-gradient-text">Team Attendance Approvals</span>
          </h1>
          <p className="mt-1 text-slate-500">Review on-duty requests and attendance exceptions before they affect payroll.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="manager-approval-date">Work date</Label>
            <Input id="manager-approval-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <section className="grid gap-6 md:grid-cols-4">
        <div className="group relative flex h-[150px] flex-col justify-between overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-400 to-violet-500 p-5 text-white shadow-lg shadow-indigo-500/15 fusion-hover">
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15 blur-2xl transition-transform duration-500 group-hover:scale-150" />
          <div className="relative z-10 rounded-2xl bg-white/20 p-2.5 backdrop-blur-sm w-fit">
            <Users className="h-5 w-5" />
          </div>
          <div className="relative z-10">
            <div className="font-headline text-4xl font-extrabold leading-none">{queue?.summary.totalEmployees ?? 0}</div>
            <div className="mt-1 text-sm font-medium text-white/90">Team Employees</div>
          </div>
        </div>
        <div className="group relative flex h-[150px] flex-col justify-between overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-400 to-purple-500 p-5 text-white shadow-lg shadow-violet-500/15 fusion-hover">
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15 blur-2xl transition-transform duration-500 group-hover:scale-150" />
          <div className="relative z-10 rounded-2xl bg-white/20 p-2.5 backdrop-blur-sm w-fit">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="relative z-10">
            <div className="font-headline text-4xl font-extrabold leading-none">{queue?.summary.exceptions ?? 0}</div>
            <div className="mt-1 text-sm font-medium text-white/90">Open Exceptions</div>
          </div>
        </div>
        <div className="group relative flex h-[150px] flex-col justify-between overflow-hidden rounded-[2rem] bg-gradient-to-br from-teal-400 to-emerald-500 p-5 text-white shadow-lg shadow-emerald-500/15 fusion-hover">
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15 blur-2xl transition-transform duration-500 group-hover:scale-150" />
          <div className="relative z-10 rounded-2xl bg-white/20 p-2.5 backdrop-blur-sm w-fit">
            <Clock3 className="h-5 w-5" />
          </div>
          <div className="relative z-10">
            <div className="font-headline text-4xl font-extrabold leading-none">{queue?.summary.missingCheckout ?? 0}</div>
            <div className="mt-1 text-sm font-medium text-white/90">Missing Checkout</div>
          </div>
        </div>
        <div className="group relative flex h-[150px] flex-col justify-between overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-400 to-orange-500 p-5 text-white shadow-lg shadow-orange-500/15 fusion-hover">
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15 blur-2xl transition-transform duration-500 group-hover:scale-150" />
          <div className="relative z-10 rounded-2xl bg-white/20 p-2.5 backdrop-blur-sm w-fit">
            <FileText className="h-5 w-5" />
          </div>
          <div className="relative z-10">
            <div className="font-headline text-4xl font-extrabold leading-none">{corrections.length}</div>
            <div className="mt-1 text-sm font-medium text-white/90">Corrections</div>
          </div>
        </div>
      </section>

      <div className="fusion-glass rounded-[2rem] p-6">
        <div className="mb-1 flex items-center gap-2 text-lg font-bold">
          <Workflow className="h-5 w-5 text-indigo-500" />
          Workflow Approvals
        </div>
        <p className="text-sm text-slate-500">Multi-step approval chains for policy-controlled business changes.</p>
        <div className="mt-4 space-y-3">
          {workflowLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ) : workflowIsError ? (
            <ErrorState error={workflowErr} onRetry={() => refetchWorkflow()} />
          ) : workflowChains.length === 0 ? (
            <EmptyState
              icon={Workflow}
              title="No workflow approvals"
              description="Approval chains assigned to your role or delegated to you will appear here."
            />
          ) : workflowChains.map((chain) => {
            const pendingStep = chain.steps.find((step) => ['PENDING', 'DELEGATED', 'ESCALATED'].includes(step.state));
            const delegateKey = pendingStep ? `${chain.id}:${pendingStep.id}` : chain.id;
            return (
              <div key={chain.id} className="grid gap-4 fusion-glass rounded-2xl p-4 lg:grid-cols-[1fr_auto]">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{chain.commandName.replace(/([a-z])([A-Z])/g, '$1 $2')}</p>
                    <Badge variant="outline">{chain.aggregateType}</Badge>
                    <Badge variant={chain.status === 'IN_PROGRESS' ? 'secondary' : 'outline'}>{chain.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="grid gap-2 text-sm text-slate-500 md:grid-cols-2">
                    {chain.steps.map((step) => (
                      <div key={step.id} className="rounded-xl border border-slate-200 bg-white/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-700">{step.order}. {step.label}</span>
                          <Badge variant={step.state === 'APPROVED' ? 'outline' : 'secondary'}>{step.state}</Badge>
                        </div>
                        <p className="mt-1 text-xs">Approver: {step.delegatedToWorkerId ?? step.approverRole ?? step.approverWorkerId ?? 'Configured approver'}</p>
                        {step.slaDueAt ? <p className="mt-1 text-xs">Due: {new Date(step.slaDueAt).toLocaleString()}</p> : null}
                      </div>
                    ))}
                  </div>
                  {pendingStep ? (
                    <div className="flex flex-col gap-2 rounded-xl bg-white/60 p-3 sm:flex-row sm:items-end">
                      <div className="grid flex-1 gap-2">
                        <Label htmlFor={`delegate-${pendingStep.id}`}>Delegate to worker</Label>
                        <WorkerPicker
                          id={`delegate-${pendingStep.id}`}
                          value={delegateTargets[delegateKey] ?? ''}
                          onChange={(workerId) => setDelegateTargets((current) => {
                            const next = { ...current };
                            if (workerId) next[delegateKey] = workerId;
                            else delete next[delegateKey];
                            return next;
                          })}
                        />
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => handleWorkflowDelegate(chain.id, pendingStep.id)}
                        disabled={delegateWorkflowMutation.isPending || !delegateTargets[delegateKey]}
                      >
                        Delegate
                      </Button>
                    </div>
                  ) : null}
                </div>
                {pendingStep ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => handleWorkflowDecision(chain.id, pendingStep.id, 'approve')} disabled={approveWorkflowMutation.isPending}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleWorkflowDecision(chain.id, pendingStep.id, 'reject')} disabled={rejectWorkflowMutation.isPending}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleWorkflowEscalate(chain.id)} disabled={escalateWorkflowMutation.isPending}>
                      Escalate
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="fusion-glass rounded-[2rem] p-6">
        <div className="mb-1 flex items-center gap-2 text-lg font-bold">
          <CalendarDays className="h-5 w-5 text-indigo-500" />
          Leave Requests
        </div>
        <p className="text-sm text-slate-500">Approved leave is fed into attendance ledgers, timesheets, and payroll readiness.</p>
        <div className="mt-4 space-y-3">
          {leaveLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ) : leaveIsError ? (
            <ErrorState error={leaveErr} onRetry={() => refetchLeave()} />
          ) : leaveRequests.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No leave requests pending"
              description="Leave requests awaiting your approval will appear here."
            />
          ) : leaveRequests.map((request) => (
            <div key={request.id} className="grid gap-4 fusion-glass rounded-2xl p-4 lg:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{request.employeeName ?? request.workerId}</p>
                  <Badge variant="secondary">{request.type}</Badge>
                  <Badge variant="outline">{request.status}</Badge>
                </div>
                <p className="text-sm text-slate-500">
                  {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                  {request.reason ? ` - ${request.reason}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleApproveLeave(request.id)}
                  disabled={approveLeaveMutation.isPending || rejectLeaveMutation.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRejectLeave(request.id)}
                  disabled={approveLeaveMutation.isPending || rejectLeaveMutation.isPending}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fusion-glass rounded-[2rem] p-6">
        <div className="text-lg font-bold">Attendance Correction Requests</div>
        <p className="text-sm text-slate-500">Manager approval controls whether missing or corrected punches can reach the official ledger.</p>
        <div className="mt-4 space-y-3">
          {correctionsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ) : correctionsError ? (
            <ErrorState error={correctionsErr} onRetry={() => refetchCorrections()} />
          ) : corrections.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No correction requests"
              description="There are no attendance correction requests waiting for this date."
            />
          ) : corrections.map((request) => (
            <div key={request.id} className="grid gap-4 fusion-glass rounded-2xl p-4 lg:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{request.correctionType.replace(/_/g, ' ')}</Badge>
                  <Badge variant="outline">{request.requestedEventType?.replace(/_/g, ' ') ?? 'Event correction'}</Badge>
                  <span className="text-xs text-slate-500">
                    {request.requestedTimestamp ? new Date(request.requestedTimestamp).toLocaleString() : request.workDate}
                  </span>
                </div>
                <p className="text-sm text-slate-500">{request.reason}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleCorrection(request.id, 'APPROVE', 'Approved by manager')}
                  disabled={reviewCorrectionMutation.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCorrection(request.id, 'REJECT', 'Rejected by manager')}
                  disabled={reviewCorrectionMutation.isPending}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fusion-glass rounded-[2rem] p-6">
        <div className="text-lg font-bold">Approval Queue</div>
        <p className="text-sm text-slate-500">Calculated exceptions are informational; request-backed items can be reviewed, resolved, or escalated.</p>
        <div className="mt-4 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          ) : isError ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No attendance approvals"
              description="There are no attendance approvals waiting for this date."
            />
          ) : items.map((item) => (
            <div key={`${item.workerId}-${item.code}-${item.exceptionId ?? item.status}`} className="grid gap-4 fusion-glass rounded-2xl p-4 lg:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.workerName}</p>
                  <Badge variant="outline">{item.employeeId}</Badge>
                  <Badge variant={severityVariant(item.severity)}>{item.code.replace(/_/g, ' ')}</Badge>
                </div>
                <p className="text-sm text-slate-500">{item.description}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{hours(item.payrollImpactMinutes)} payroll impact - {item.status.replace(/_/g, ' ')}</span>
                </div>
                <div className="grid gap-2 rounded-2xl bg-white/50 p-3 text-xs text-slate-500 md:grid-cols-4">
                  <span>Schedule: {item.policyEvidence?.schedule?.shiftLabel ?? item.policyEvidence?.schedule?.scheduleLabel ?? item.policyEvidence?.schedule?.source ?? 'Tenant default'}</span>
                  <span>First/last: {timeStamp(item.firstCheckInAt)} / {timeStamp(item.latestCheckOutAt)}</span>
                  <span>Location: {item.locationStatus.replace(/_/g, ' ')}</span>
                  <span>Trust threshold: {item.policyEvidence?.trust?.minClockTrustScore ?? '-'}</span>
                  {item.policyEvidence?.holiday ? <span>Holiday: {item.policyEvidence.holiday.name}</span> : null}
                  {item.policyEvidence?.flexibleRuleCode ? <span>Flex rule: {item.policyEvidence.flexibleRuleCode}</span> : null}
                </div>
              </div>
              {item.exceptionId ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleException(item.exceptionId as string, 'review')}>
                    Review
                  </Button>
                  <Button size="sm" onClick={() => handleException(item.exceptionId as string, 'resolve')}>
                    Resolve
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleException(item.exceptionId as string, 'escalate')}>
                    Escalate
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-slate-500 lg:text-right">Correct the attendance source event to clear.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
