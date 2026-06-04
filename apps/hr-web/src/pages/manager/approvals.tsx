import * as React from 'react';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, RefreshCw, XCircle } from 'lucide-react';
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

export function ManagerApprovals() {
  const [date, setDate] = React.useState(todayKey);
  const { data: queue, isLoading, refetch } = useApiQuery<AttendanceExceptionQueue>(
    ['manager-attendance-exceptions', date],
    `/time/attendance/exception-queue?date=${encodeURIComponent(date)}`,
  );
  const { data: corrections = [], isLoading: correctionsLoading } = useApiQuery<AttendanceCorrectionRequest[]>(
    ['manager-attendance-corrections', date],
    `/time/attendance/correction-requests?status=PENDING_MANAGER_REVIEW&date=${encodeURIComponent(date)}`,
  );
  const { data: leaveRequests = [], isLoading: leaveLoading } = useApiQuery<AbsenceRequest[]>(
    ['manager-leave-requests'],
    '/manager/leave/requests?status=PENDING_APPROVAL',
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

  const items = queue?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Clock3 className="h-6 w-6" />
            Team Attendance Approvals
          </h2>
          <p className="text-muted-foreground">Review on-duty requests and attendance exceptions before they affect payroll.</p>
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

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Team Employees</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{queue?.summary.totalEmployees ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Open Exceptions</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{queue?.summary.exceptions ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Missing Checkout</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{queue?.summary.missingCheckout ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Corrections</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{corrections.length}</CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5" />
            Leave Requests
          </CardTitle>
          <CardDescription>Approved leave is fed into attendance ledgers, timesheets, and payroll readiness.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {leaveLoading ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading leave requests...</div>
          ) : leaveRequests.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              No leave requests waiting for approval.
            </div>
          ) : leaveRequests.map((request) => (
            <div key={request.id} className="grid gap-4 rounded-md border p-4 lg:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{request.employeeName ?? request.workerId}</p>
                  <Badge variant="secondary">{request.type}</Badge>
                  <Badge variant="outline">{request.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                  {request.reason ? ` - ${request.reason}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => approveLeaveMutation.mutate({ id: request.id })}
                  disabled={approveLeaveMutation.isPending || rejectLeaveMutation.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rejectLeaveMutation.mutate({ id: request.id })}
                  disabled={approveLeaveMutation.isPending || rejectLeaveMutation.isPending}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Attendance Correction Requests</CardTitle>
          <CardDescription>Manager approval controls whether missing or corrected punches can reach the official ledger.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {correctionsLoading ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading correction requests...</div>
          ) : corrections.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              No correction requests waiting for this date.
            </div>
          ) : corrections.map((request) => (
            <div key={request.id} className="grid gap-4 rounded-md border p-4 lg:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{request.correctionType.replace(/_/g, ' ')}</Badge>
                  <Badge variant="outline">{request.requestedEventType?.replace(/_/g, ' ') ?? 'Event correction'}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {request.requestedTimestamp ? new Date(request.requestedTimestamp).toLocaleString() : request.workDate}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{request.reason}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => reviewCorrectionMutation.mutate({ id: request.id, decision: 'APPROVE', note: 'Approved by manager' })}
                  disabled={reviewCorrectionMutation.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => reviewCorrectionMutation.mutate({ id: request.id, decision: 'REJECT', note: 'Rejected by manager' })}
                  disabled={reviewCorrectionMutation.isPending}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Approval Queue</CardTitle>
          <CardDescription>Calculated exceptions are informational; request-backed items can be reviewed, resolved, or escalated.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading attendance approvals...</div>
          ) : items.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              No attendance approvals waiting for this date.
            </div>
          ) : items.map((item) => (
            <div key={`${item.workerId}-${item.code}-${item.exceptionId ?? item.status}`} className="grid gap-4 rounded-md border p-4 lg:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.workerName}</p>
                  <Badge variant="outline">{item.employeeId}</Badge>
                  <Badge variant={severityVariant(item.severity)}>{item.code.replace(/_/g, ' ')}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{hours(item.payrollImpactMinutes)} payroll impact - {item.status.replace(/_/g, ' ')}</span>
                </div>
                <div className="grid gap-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground md:grid-cols-4">
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
                  <Button variant="outline" size="sm" onClick={() => exceptionMutation.mutate({ id: item.exceptionId as string, action: 'review' })}>
                    Review
                  </Button>
                  <Button size="sm" onClick={() => exceptionMutation.mutate({ id: item.exceptionId as string, action: 'resolve' })}>
                    Resolve
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => exceptionMutation.mutate({ id: item.exceptionId as string, action: 'escalate' })}>
                    Escalate
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground lg:text-right">Correct the attendance source event to clear.</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
