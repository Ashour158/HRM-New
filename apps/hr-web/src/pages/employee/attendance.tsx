import * as React from 'react';
import { Link } from 'react-router-dom';
import { useApiQuery } from '@/hooks/use-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { DEFAULT_HCM_SETUP } from '@/lib/hcm-setup-defaults';
import { cn } from '@/lib/utils';
import { EvidenceMetric, FeedRow, KpiTile } from './dashboard/dashboard-widgets';
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  History,
  LogIn,
  LogOut,
  TrendingUp,
} from 'lucide-react';
import type { HcmSetupConfig, Worker } from '@/types';

type AttendancePeriodRange = 'DAILY' | 'MONTHLY' | 'NINETY_DAYS' | 'WEEKLY';

interface AttendancePeriodMetrics {
  employeeDays: number;
  present: number;
  absent: number;
  onLeave: number;
  exceptions: number;
  payableHours: number;
  deductionHours: number;
  overtimeHours: number;
  geofenceViolations: number;
  lateMinutes: number;
  missingCheckout: number;
  payrollReady: number;
  undertimeMinutes: number;
}

interface AttendancePeriodView {
  periodStart: string;
  periodEnd: string;
  range: AttendancePeriodRange;
  scope: 'SELF' | 'TEAM' | 'TENANT';
  totals: AttendancePeriodMetrics;
  series: Array<AttendancePeriodMetrics & { workDate: string }>;
  policyEvidence: {
    flexibleRuleCodes: string[];
    leavePolicyTypes: string[];
    scheduleSources: string[];
  };
}

type AttendanceClockStatus = 'YET_TO_CHECK_IN' | 'IN' | 'OUT' | 'MISSING_CHECKOUT' | 'OUTSIDE_GEOFENCE';
type AttendanceLocationStatus = 'INSIDE_GEOFENCE' | 'NO_GEOLOCATION' | 'OUTSIDE_GEOFENCE' | 'UNKNOWN_WORKPLACE';

interface AttendanceTodayState {
  workerId: string;
  workDate: string;
  status: AttendanceClockStatus;
  canCheckIn: boolean;
  canCheckOut: boolean;
  firstCheckInAt?: string;
  latestCheckOutAt?: string;
  activeCheckInAt?: string;
  elapsedMinutes: number;
  totalWorkedMinutes: number;
  locationStatus: AttendanceLocationStatus;
  events: Array<{
    id: string;
    eventType: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';
    timestamp: string;
    deviceId?: string;
    locationStatus: AttendanceLocationStatus;
  }>;
}

interface AttendanceCorrectionRequest {
  id: string;
  workDate: string;
  correctionType: 'ADD_CLOCK_EVENT' | 'EDIT_CLOCK_EVENT' | 'DELETE_CLOCK_EVENT';
  requestedEventType?: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';
  reason: string;
  status: 'PENDING_MANAGER_REVIEW' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'CANCELLED';
  requestedAt: string;
}

interface WorkScheduleEntry {
  scheduleType: string;
  startDate: string;
  endDate?: string;
  daysOfWeek: string[];
  hoursPerDay: number;
  timezone: string;
  status: 'DRAFT' | 'ACTIVE' | 'EXPIRED';
}

const attendanceRangeOptions: Array<{ value: AttendancePeriodRange; label: string }> = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'NINETY_DAYS', label: '90 days' },
];

const statusCopy: Record<AttendanceClockStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  YET_TO_CHECK_IN: { label: 'Yet to check-in', variant: 'outline' },
  IN: { label: 'Checked in', variant: 'default' },
  OUT: { label: 'Checked out', variant: 'secondary' },
  MISSING_CHECKOUT: { label: 'Missing check-out', variant: 'destructive' },
  OUTSIDE_GEOFENCE: { label: 'In - outside geofence', variant: 'destructive' },
};

const correctionStatusVariant: Record<AttendanceCorrectionRequest['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING_MANAGER_REVIEW: 'secondary',
  APPROVED: 'default',
  APPLIED: 'default',
  REJECTED: 'destructive',
  CANCELLED: 'outline',
};

function rangeLabel(range: AttendancePeriodRange) {
  return attendanceRangeOptions.find((option) => option.value === range)?.label ?? 'Weekly';
}

function dateKey(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function formatTime(value?: string) {
  if (!value) return '--';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatMinutes(minutes: number | undefined) {
  const total = Math.max(minutes ?? 0, 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

function formatHours(value?: number) {
  const hours = Math.max(value ?? 0, 0);
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: '2-digit' }).format(new Date(`${value}T00:00:00.000Z`));
}

function dayStatusLabel(day: AttendancePeriodMetrics): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (day.onLeave > 0) return { label: 'On leave', variant: 'outline' };
  if (day.absent > 0) return { label: 'Absent', variant: 'destructive' };
  if (day.missingCheckout > 0) return { label: 'Missing check-out', variant: 'destructive' };
  if (day.exceptions > 0) return { label: 'Exception flagged', variant: 'secondary' };
  if (day.present > 0) return { label: 'Present', variant: 'default' };
  return { label: 'No activity', variant: 'outline' };
}

function enumerateDateKeys(periodStart: string, periodEnd: string): string[] {
  const start = new Date(`${periodStart}T00:00:00.000Z`);
  const end = new Date(`${periodEnd}T00:00:00.000Z`);
  const days: string[] = [];
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = new Date(cursor.getTime() + 86400000)) {
    days.push(cursor.toISOString().slice(0, 10));
    if (days.length > 120) break;
  }
  return days;
}

/**
 * Dedicated "My Attendance" self-service page: check-in/check-out history, hours-worked
 * summary, and shift schedule for the current period. Backed by the scope=SELF period-view
 * endpoint and the same check-in/check-out commands used by the Home dashboard.
 */
export function EmployeeAttendance() {
  const [attendanceRange, setAttendanceRange] = React.useState<AttendancePeriodRange>('WEEKLY');
  const today = React.useMemo(() => new Date(), []);
  const todayDateKey = React.useMemo(() => dateKey(today), [today]);

  const { data: setup = DEFAULT_HCM_SETUP } = useApiQuery<HcmSetupConfig>(
    ['employee-attendance-page-setup'],
    '/employee/attendance-setup',
  );
  const { data: activeWorker } = useApiQuery<Worker>(['employee-attendance-page-profile'], '/employee/profile');
  const workerId = activeWorker?.id ?? '';

  const {
    data: todayState,
    isLoading: todayStateLoading,
  } = useApiQuery<AttendanceTodayState>(
    ['employee-attendance-page-today-state', workerId],
    `/time/attendance/workers/${workerId}/today-state`,
    { enabled: Boolean(workerId), refetchInterval: 60000 },
  );

  const {
    data: periodView,
    isLoading: periodViewLoading,
    isError: periodViewError,
    error: periodViewErrorObject,
    refetch: refetchPeriodView,
  } = useApiQuery<AttendancePeriodView>(
    ['employee-attendance-page-period-view', workerId, attendanceRange, todayDateKey],
    `/time/attendance/reports/period-view?scope=SELF&range=${attendanceRange}&date=${todayDateKey}&workerId=${workerId}`,
    { enabled: Boolean(workerId) },
  );

  const { data: correctionRequests = [] } = useApiQuery<AttendanceCorrectionRequest[]>(
    ['employee-attendance-page-corrections', workerId],
    `/time/attendance/correction-requests?workerId=${workerId}`,
    { enabled: Boolean(workerId) },
  );

  const { data: workSchedules = [] } = useApiQuery<WorkScheduleEntry[]>(
    ['employee-attendance-page-work-schedules', workerId],
    `/time/attendance/work-schedules/worker/${workerId}`,
    { enabled: Boolean(workerId) },
  );

  const status = todayState?.status ?? 'YET_TO_CHECK_IN';
  const statusMeta = statusCopy[status];

  const historyRows = React.useMemo(
    () => [...(periodView?.series ?? [])].sort((left, right) => right.workDate.localeCompare(left.workDate)),
    [periodView?.series],
  );

  const activeSchedules = React.useMemo(
    () => workSchedules.filter((schedule) => schedule.status === 'ACTIVE'),
    [workSchedules],
  );

  const POLICY_SCHEDULE_DAY_LIMIT = 14;
  const policyScheduleDaysAll = React.useMemo(() => {
    if (!periodView) return [];
    const days = enumerateDateKeys(periodView.periodStart, periodView.periodEnd);
    const holidayNames = new Map((setup.attendancePolicy.holidays ?? []).map((holiday) => [holiday.date, holiday.name]));
    const workDays = setup.attendancePolicy.workDays ?? [0, 1, 2, 3, 4];
    return days.map((day) => {
      const dow = new Date(`${day}T00:00:00.000Z`).getUTCDay();
      const holidayName = holidayNames.get(day);
      const isWorkDay = workDays.includes(dow);
      return {
        day,
        holidayName,
        isWeekend: !isWorkDay,
        isToday: day === todayDateKey,
      };
    });
  }, [periodView, setup.attendancePolicy.holidays, setup.attendancePolicy.workDays, todayDateKey]);
  const policyScheduleDays = policyScheduleDaysAll.slice(0, POLICY_SCHEDULE_DAY_LIMIT);
  const policyScheduleDaysHidden = Math.max(policyScheduleDaysAll.length - policyScheduleDays.length, 0);

  const recentCorrections = React.useMemo(
    () => [...correctionRequests].sort((left, right) => right.requestedAt.localeCompare(left.requestedAt)).slice(0, 5),
    [correctionRequests],
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_8px_28px_rgba(0,0,0,0.06)]">
        <div className="grid gap-5 border-b border-border/70 bg-muted p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/30 bg-secondary/10 text-primary">Self-service</Badge>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Scope: My attendance</Badge>
            </div>
            <h2 className="mt-3 flex items-center gap-3 text-2xl font-bold text-foreground sm:text-3xl">
              <Clock3 className="h-7 w-7 text-primary" />
              My Attendance
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Check-in and check-out history, hours-worked summary, and your shift schedule for the current period.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
            <Select value={attendanceRange} onValueChange={(value) => setAttendanceRange(value as AttendancePeriodRange)}>
              <SelectTrigger aria-label="Attendance period" className="h-10 w-full bg-white/80 sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {attendanceRangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild variant="outline">
              <Link to="/employee/dashboard#attendance">
                <History className="mr-2 h-4 w-4" />
                Attendance terminal
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile icon={CalendarDays} value={periodViewLoading ? '-' : formatHours(periodView?.totals.payableHours)} label={`Payable - ${rangeLabel(attendanceRange)}`} gradient="from-violet-400 to-purple-500" shadow="shadow-violet-500/15" />
          <KpiTile icon={TrendingUp} value={periodViewLoading ? '-' : formatHours(periodView?.totals.overtimeHours)} label={`Overtime - ${rangeLabel(attendanceRange)}`} gradient="from-teal-400 to-emerald-500" shadow="shadow-emerald-500/15" />
          <KpiTile icon={AlertTriangle} value={periodViewLoading ? '-' : `${periodView?.totals.lateMinutes ?? 0} min`} label={`Late - ${rangeLabel(attendanceRange)}`} gradient="from-amber-400 to-orange-500" shadow="shadow-orange-500/15" />
          <KpiTile icon={CheckCircle2} value={periodViewLoading ? '-' : `${periodView?.totals.exceptions ?? 0}`} label={`Exceptions - ${rangeLabel(attendanceRange)}`} gradient="from-indigo-400 to-violet-500" shadow="shadow-indigo-500/15" />
        </div>
      </section>

      {periodViewError ? (
        <ErrorState error={periodViewErrorObject} onRetry={() => refetchPeriodView()} />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <FeedRow
            icon={status === 'IN' || status === 'OUTSIDE_GEOFENCE' ? <LogOut className="h-5 w-5 text-orange-500" /> : <LogIn className="h-5 w-5 text-orange-500" />}
            title={status === 'IN' || status === 'OUTSIDE_GEOFENCE' ? 'Active attendance session' : statusMeta.label}
            subtitle={status === 'IN' || status === 'OUTSIDE_GEOFENCE' ? `Started at ${formatTime(todayState?.activeCheckInAt)}` : 'Worked today'}
            rightTitle={formatMinutes(todayState?.totalWorkedMinutes)}
            rightSubtitle="today"
          />

          <div className="fusion-glass rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">Today</h3>
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <EvidenceMetric label="First check-in" value={formatTime(todayState?.firstCheckInAt)} />
              <EvidenceMetric label="Latest check-out" value={formatTime(todayState?.latestCheckOutAt)} />
              <EvidenceMetric label="Worked today" value={formatMinutes(todayState?.totalWorkedMinutes)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant={todayState?.canCheckIn ? 'default' : 'outline'}>
                <Link
                  to="/employee/attendance/in"
                  aria-disabled={!todayState?.canCheckIn}
                  className={cn(!todayState?.canCheckIn && 'pointer-events-none opacity-50')}
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Check in
                </Link>
              </Button>
              <Button asChild variant={todayState?.canCheckOut ? 'default' : 'outline'}>
                <Link
                  to="/employee/attendance/out"
                  aria-disabled={!todayState?.canCheckOut}
                  className={cn(!todayState?.canCheckOut && 'pointer-events-none opacity-50')}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Check out
                </Link>
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {todayStateLoading ? <Skeleton className="h-16 w-full" /> : null}
              {(todayState?.events ?? []).map((event) => (
                <div key={event.id} className="grid gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs md:grid-cols-[130px_1fr_150px]">
                  <p className="font-semibold">{event.eventType.replace('_', ' ')}</p>
                  <p className="text-slate-600">{new Date(event.timestamp).toLocaleString()} - {event.deviceId ?? 'unknown device'}</p>
                  <p className={cn('font-medium', event.locationStatus === 'OUTSIDE_GEOFENCE' ? 'text-amber-600' : 'text-emerald-600')}>
                    {event.locationStatus.replace(/_/g, ' ')}
                  </p>
                </div>
              ))}
              {!todayStateLoading && (todayState?.events ?? []).length === 0 ? (
                <p className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No attendance events recorded today.</p>
              ) : null}
            </div>
          </div>

          <div className="fusion-glass rounded-2xl p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Check-in / check-out history</h3>
                <p className="text-sm text-slate-600">{periodView ? `${formatDateLabel(periodView.periodStart)} - ${formatDateLabel(periodView.periodEnd)}` : 'Loading period...'}</p>
              </div>
              <Badge variant="secondary">{rangeLabel(attendanceRange)}</Badge>
            </div>
            {periodViewLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
              </div>
            ) : historyRows.length > 0 ? (
              <div className="space-y-2">
                {historyRows.map((day) => {
                  const dayStatus = dayStatusLabel(day);
                  return (
                    <div key={day.workDate} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs md:grid-cols-[150px_140px_repeat(3,1fr)] md:items-center">
                      <p className="font-semibold text-slate-800">{formatDateLabel(day.workDate)}</p>
                      <Badge variant={dayStatus.variant} className="w-fit">{dayStatus.label}</Badge>
                      <p className="text-slate-700">Payable {formatHours(day.payableHours)}</p>
                      <p className="text-slate-700">Late {day.lateMinutes}m - OT {formatHours(day.overtimeHours)}</p>
                      <p className={cn('font-medium', day.exceptions > 0 ? 'text-amber-700' : 'text-emerald-700')}>
                        {day.exceptions > 0 ? `${day.exceptions} exception${day.exceptions === 1 ? '' : 's'}` : 'No exceptions'}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={History}
                title="No attendance activity in this period"
                description="Check-in and check-out records will appear here once ledger activity is available for the selected range."
              />
            )}
          </div>

          <div className="fusion-glass rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Recent correction requests</h3>
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <Link to="/employee/dashboard#attendance">Request a correction</Link>
              </Button>
            </div>
            {recentCorrections.length > 0 ? (
              <div className="space-y-2">
                {recentCorrections.map((request) => (
                  <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-slate-800">{request.requestedEventType?.replace('_', ' ') ?? request.correctionType} - {request.workDate}</p>
                      <p className="text-xs text-slate-500">{request.reason}</p>
                    </div>
                    <Badge variant={correctionStatusVariant[request.status]}>{request.status.replace(/_/g, ' ')}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No correction requests submitted yet.</p>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="fusion-glass rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold">
                <CalendarClock className="h-5 w-5 text-indigo-500" />
                Shift Schedule
              </h3>
              <Badge variant="outline">{setup.attendancePolicy.flexibleHoursEnabled ? 'Flexible policy' : 'Fixed shift'}</Badge>
            </div>

            {activeSchedules.length > 0 ? (
              <div className="space-y-3">
                {activeSchedules.map((schedule, index) => (
                  <div key={`${schedule.scheduleType}-${schedule.startDate}-${index}`} className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-sm">
                    <p className="font-semibold text-slate-800">{schedule.scheduleType.replace(/_/g, ' ')}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {schedule.daysOfWeek.map((day) => day.slice(0, 3)).join(', ')} - {schedule.hoursPerDay}h/day
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      From {schedule.startDate}{schedule.endDate ? ` to ${schedule.endDate}` : ' (ongoing)'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  No custom shift override is assigned. Showing the tenant default policy schedule.
                </div>
                <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm">
                  <p className="font-medium">Daily shift</p>
                  <p>{setup.attendancePolicy.standardStartTime ?? setup.attendancePolicy.flexibleWindowStart ?? '09:00'} - {setup.attendancePolicy.standardEndTime ?? setup.attendancePolicy.coreEndTime ?? '17:00'}</p>
                  <p className="text-xs text-muted-foreground">{setup.attendancePolicy.standardDailyMinutes / 60} working hours</p>
                </div>
                <div className="space-y-1.5">
                  {policyScheduleDays.map((entry) => (
                    <div
                      key={entry.day}
                      className={cn(
                        'flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs',
                        entry.isToday ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-slate-200 bg-slate-50 text-slate-600',
                      )}
                    >
                      <span>{formatDateLabel(entry.day)}</span>
                      <span>{entry.holidayName ?? (entry.isWeekend ? 'Weekend' : entry.isToday ? 'Today' : 'Scheduled')}</span>
                    </div>
                  ))}
                  {policyScheduleDays.length === 0 ? <Skeleton className="h-24 w-full" /> : null}
                  {policyScheduleDaysHidden > 0 ? (
                    <p className="px-1 text-xs text-slate-500">+{policyScheduleDaysHidden} more day{policyScheduleDaysHidden === 1 ? '' : 's'} in this period follow the same weekly pattern.</p>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {(periodView?.policyEvidence.scheduleSources.length ?? 0) > 0 ||
          (periodView?.policyEvidence.flexibleRuleCodes.length ?? 0) > 0 ||
          (periodView?.policyEvidence.leavePolicyTypes.length ?? 0) > 0 ? (
            <div className="fusion-glass rounded-2xl p-5">
              <h3 className="mb-3 font-semibold">Policy signals</h3>
              <div className="space-y-3 text-xs">
                {periodView?.policyEvidence.scheduleSources.length ? (
                  <div>
                    <p className="font-semibold text-slate-700">Schedules</p>
                    <p className="text-slate-500">{periodView.policyEvidence.scheduleSources.join(', ')}</p>
                  </div>
                ) : null}
                {periodView?.policyEvidence.flexibleRuleCodes.length ? (
                  <div>
                    <p className="font-semibold text-slate-700">Flex rules</p>
                    <p className="text-slate-500">{periodView.policyEvidence.flexibleRuleCodes.join(', ')}</p>
                  </div>
                ) : null}
                {periodView?.policyEvidence.leavePolicyTypes.length ? (
                  <div>
                    <p className="font-semibold text-slate-700">Leave bridge</p>
                    <p className="text-slate-500">{periodView.policyEvidence.leavePolicyTypes.join(', ')}</p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
