import * as React from 'react';
import { Link } from 'react-router-dom';
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
import { Calendar, Clock, Landmark, Plus } from 'lucide-react';
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

function unitLabel(unit: string, amount?: number) {
  const normalized = unit.toLowerCase();
  if (amount === 1) return normalized.replace(/s$/, '');
  return normalized.endsWith('s') ? normalized : `${normalized}s`;
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

export function EmployeeTimeOff() {
  const emptyForm: LeaveRequestForm = {
    type: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    reason: '',
  };
  const [showForm, setShowForm] = React.useState(false);
  const [formData, setFormData] = React.useState<LeaveRequestForm>(emptyForm);

  const { data: requests, isLoading: requestsLoading } = useApiQuery<AbsenceRequest[]>(
    ['employee-absences'],
    '/employee/absences',
  );

  const { data: balances, isLoading: balancesLoading } = useApiQuery<AbsenceBalance[]>(
    ['employee-absence-balance'],
    '/employee/absences/balance',
  );

  const { data: leavePolicyResponse } = useApiQuery<LeavePolicyResponse>(
    ['employee-absence-policies'],
    '/employee/absences/policies',
  );

  const createMutation = useApiMutation<AbsenceRequest, LeaveRequestForm>(
    '/employee/absences',
    'post',
    [['employee-absences'], ['employee-absence-balance']],
  );

  const selectedPolicy = leavePolicyResponse?.policies.find((policy) => policy.code === formData.type);
  const estimatedDuration = estimateDuration(formData, selectedPolicy, leavePolicyResponse);
  const upcomingHolidays = (leavePolicyResponse?.publicHolidays ?? [])
    .filter((holiday) => holiday.date >= new Date().toISOString().slice(0, 10))
    .slice(0, 5);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: LeaveRequestForm = selectedPolicy?.unit === 'HOURS'
      ? { ...formData, endDate: formData.startDate }
      : formData;
    await createMutation.mutateAsync(payload);
    setShowForm(false);
    setFormData(emptyForm);
  };

  const columns = [
    { key: 'type', header: 'Type', cell: (row: AbsenceRequest) => row.type },
    {
      key: 'dates',
      header: 'Dates',
      cell: (row: AbsenceRequest) => (
        <span>
          {formatDate(row.startDate)} - {formatDate(row.endDate)}
          {row.startTime && row.endTime ? `, ${row.startTime}-${row.endTime}` : ''}
        </span>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      cell: (row: AbsenceRequest) => row.durationAmount
        ? `${row.durationAmount} ${unitLabel(row.durationUnit ?? 'days', row.durationAmount)}`
        : '-',
    },
    {
      key: 'payroll',
      header: 'Payroll',
      cell: (row: AbsenceRequest) => (
        <Badge variant={row.payrollImpact === 'UNPAID_LEAVE' ? 'destructive' : 'outline'}>
          {row.payrollImpact?.replace(/_/g, ' ') ?? (row.paid === false ? 'UNPAID LEAVE' : 'PAID LEAVE')}
        </Badge>
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
      <div className="flex flex-col gap-4 border-b bg-white px-5 py-4 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Calendar className="h-6 w-6 text-[#0b8cff]" />
            Leave
          </h2>
          <p className="text-sm text-muted-foreground">Day-based leave, hourly permission, manager approval, and payroll impact.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/employee/payslip">
              <Landmark className="mr-2 h-4 w-4" />
              Payroll
            </Link>
          </Button>
          <AllowedActions aggregateType="ABSENCE" onAction={() => setShowForm(true)} />
        </div>
      </div>

      <div className="grid gap-4 px-5 sm:grid-cols-2 lg:grid-cols-4">
        {balancesLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : balances && balances.length > 0 ? (
          balances.map((bal) => (
            <Card key={bal.type} className="rounded-md">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{bal.label ?? bal.type}</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{bal.remaining}</span>
                  <span className="text-xs text-muted-foreground">{unitLabel(bal.unit, bal.remaining)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {bal.used} used / {bal.total} total
                </p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="rounded-md">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">No balance data available</p>
            </CardContent>
          </Card>
        )}
      </div>

      {showForm && (
        <div className="px-5">
          <Card className="rounded-md">
            <CardHeader>
              <CardTitle className="text-lg">Submit Leave Request</CardTitle>
              <CardDescription>Only permission is calculated by hours. Other active leave policies are calculated by working days.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Leave Type</Label>
                    <select
                      id="type"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      required
                    >
                      <option value="">Select type</option>
                      {(leavePolicyResponse?.policies ?? []).map((policy) => (
                        <option key={policy.code} value={policy.code}>
                          {policy.label} ({policy.unit.toLowerCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value, endDate: selectedPolicy?.unit === 'HOURS' ? e.target.value : formData.endDate })}
                      required
                    />
                  </div>
                  {selectedPolicy?.unit === 'HOURS' ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="startTime">Start Time</Label>
                        <Input
                          id="startTime"
                          type="time"
                          value={formData.startTime}
                          onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endTime">End Time</Label>
                        <Input
                          id="endTime"
                          type="time"
                          value={formData.endTime}
                          onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                          required
                        />
                      </div>
                    </>
                  ) : (
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
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason</Label>
                    <Input
                      id="reason"
                      placeholder="Optional reason for leave"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    />
                  </div>
                  <div className="rounded-md border bg-slate-50 p-3 text-sm">
                    <p className="font-medium">Policy result</p>
                    <p className="text-muted-foreground">
                      {selectedPolicy
                        ? `${estimatedDuration ?? '-'} ${unitLabel(selectedPolicy.unit, estimatedDuration)} · ${selectedPolicy.payrollImpact.replace(/_/g, ' ')}`
                        : 'Select a policy'}
                    </p>
                  </div>
                </div>
                {createMutation.error ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    Leave request was rejected by policy validation.
                  </div>
                ) : null}
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
        </div>
      )}

      <div className="grid gap-4 px-5 lg:grid-cols-[1fr_22rem]">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-lg">Request History</CardTitle>
            <CardDescription>Approved leave feeds attendance ledgers and payroll readiness.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={requests ?? []}
              keyExtractor={(row) => row.id}
              isLoading={requestsLoading}
              emptyMessage="No leave requests found"
            />
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-lg">Public Holidays</CardTitle>
            <CardDescription>Managed by system admins from setup and excluded from day-based leave calculations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingHolidays.length > 0 ? upcomingHolidays.map((holiday) => (
              <div key={`${holiday.date}-${holiday.name}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{holiday.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(holiday.date)}</p>
                </div>
                <Badge variant="outline">{holiday.countryCode ?? 'Global'}</Badge>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">No upcoming holidays configured.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
