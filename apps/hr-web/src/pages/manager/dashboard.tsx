import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
} from 'recharts';
import { useApiQuery } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { DonutChartPanel } from '@/components/ui/charts';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatTile } from '@/components/ui/stat-tile';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { DataTable } from '@/components/common/data-table';
import { buildManagerJourneyItems, type ManagerJourneyTone } from '@/lib/manager-journey';
import { cn, formatDate } from '@/lib/utils';
import {
  Users,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  Target,
  ArrowRight,
  ChevronRight,
  Quote,
  Activity,
} from 'lucide-react';
import type { AbsenceRequest, Worker } from '@/types';

interface ManagerDashboardData {
  directReports: Worker[];
  pendingApprovals: {
    absences: AbsenceRequest[];
    timesheets: number;
    expenses: number;
  };
  teamMetrics: {
    headcount: number;
    averagePerformance: number;
    openGoals: number;
  };
}

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
  workers: Array<AttendancePeriodMetrics & {
    workerId: string;
    employeeId: string;
    name: string;
    departmentName?: string;
    managerId?: string;
  }>;
}

const attendanceRangeOptions: Array<{ value: AttendancePeriodRange; label: string }> = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'NINETY_DAYS', label: '90 days' },
];

const managerJourneyToneClasses: Record<ManagerJourneyTone, string> = {
  attention: 'border-red-200 bg-red-50 text-red-700',
  default: 'border-indigo-100 bg-indigo-50 text-indigo-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-orange-200 bg-orange-50 text-orange-700',
};

const teamPerformanceTrend = [
  { month: 'Jan', score: 78 },
  { month: 'Feb', score: 80 },
  { month: 'Mar', score: 82 },
  { month: 'Apr', score: 81 },
  { month: 'May', score: 85 },
  { month: 'Jun', score: 88 },
];

const dailyQuotes = [
  "Great teams aren't built in a day — they're built every day.",
  'Small steps, taken daily, move mountains.',
  'People don\u2019t work for companies, they work for people. Lead well.',
  'Progress beats perfection. Ship the next good thing.',
  'A calm leader builds a confident team.',
  'Recognition costs nothing and changes everything.',
  'Clarity is kindness — say the helpful thing.',
  'Momentum loves consistency. Keep showing up.',
];

function getDailyQuote(seedSource: string): string {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  let seed = 0;
  for (let i = 0; i < seedSource.length; i++) seed += seedSource.charCodeAt(i);
  return dailyQuotes[(dayOfYear + seed) % dailyQuotes.length];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function dateKey(value = new Date()): string {
  return value.toISOString().slice(0, 10);
}

function formatAttendanceDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit' }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatHours(value?: number): string {
  const hours = Math.max(value ?? 0, 0);
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
}

function rangeLabel(range: AttendancePeriodRange): string {
  return attendanceRangeOptions.find((option) => option.value === range)?.label ?? 'Weekly';
}

const alertDot: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-orange-500',
  low: 'bg-blue-500',
};
const alertBg: Record<string, string> = {
  high: 'bg-red-50/70 hover:bg-red-100/70',
  medium: 'bg-orange-50/70 hover:bg-orange-100/70',
  low: 'bg-blue-50/70 hover:bg-blue-100/70',
};

/**
 * Manager dashboard with team overview, pending approvals, and quick actions.
 */
export function ManagerDashboard() {
  const { user } = useAuth();
  const [attendanceRange, setAttendanceRange] = React.useState<AttendancePeriodRange>('WEEKLY');
  const { data, isLoading, isError, error, refetch } = useApiQuery<ManagerDashboardData>(
    ['manager-dashboard'],
    '/manager/dashboard'
  );
  const { data: managerProfile } = useApiQuery<Worker>(['manager-dashboard-self-profile'], '/employee/profile');
  const todayKey = React.useMemo(() => dateKey(), []);
  const { data: ownAttendance } = useApiQuery<AttendancePeriodView>(
    ['manager-own-attendance-period-view', managerProfile?.id, attendanceRange, todayKey],
    `/time/attendance/reports/period-view?scope=SELF&range=${attendanceRange}&date=${todayKey}&workerId=${managerProfile?.id ?? ''}`,
    { enabled: Boolean(managerProfile?.id) },
  );
  const { data: teamAttendance } = useApiQuery<AttendancePeriodView>(
    ['manager-team-attendance-period-view', attendanceRange, todayKey],
    `/time/attendance/reports/period-view?scope=TEAM&range=${attendanceRange}&date=${todayKey}`,
  );

  const firstName = user?.firstName || 'Manager';
  const dailyQuote = getDailyQuote(firstName);

  const absences = React.useMemo(
    () => data?.pendingApprovals.absences ?? [],
    [data?.pendingApprovals.absences],
  );
  const directReports = React.useMemo(
    () => data?.directReports ?? [],
    [data?.directReports],
  );

  const absenceColumns = [
    { key: 'employee', header: 'Employee', cell: (row: AbsenceRequest) => row.employeeName ?? row.workerId },
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
    { key: 'reason', header: 'Reason', cell: (row: AbsenceRequest) => row.reason || '-' },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row: AbsenceRequest) => (
        <Button variant="outline" size="sm" asChild>
          <Link to={`/manager/approvals?requestId=${row.id}`}>Review</Link>
        </Button>
      ),
    },
  ];

  const absenceCount = absences.length;
  const timesheetCount = data?.pendingApprovals.timesheets ?? 0;
  const expenseCount = data?.pendingApprovals.expenses ?? 0;
  const pendingTotal = absenceCount + timesheetCount + expenseCount;

  const approvalsBreakdown = React.useMemo(
    () =>
      [
        { name: 'Leave', value: absenceCount },
        { name: 'Timesheets', value: timesheetCount },
        { name: 'Expenses', value: expenseCount },
      ].filter((entry) => entry.value > 0),
    [absenceCount, timesheetCount, expenseCount],
  );
  const ownAttendanceSeries = React.useMemo(
    () => (ownAttendance?.series ?? []).map((day) => ({ day: formatAttendanceDate(day.workDate), hours: day.payableHours })),
    [ownAttendance?.series],
  );
  const teamAttendanceSeries = React.useMemo(
    () => (teamAttendance?.series ?? []).map((day) => ({ day: formatAttendanceDate(day.workDate), hours: day.payableHours })),
    [teamAttendance?.series],
  );
  const managerJourneyItems = React.useMemo(() => buildManagerJourneyItems({
    averagePerformance: data?.teamMetrics.averagePerformance,
    directReportCount: data?.teamMetrics.headcount ?? directReports.length,
    openGoals: data?.teamMetrics.openGoals,
    pendingExpenses: expenseCount,
    pendingLeaveApprovals: absenceCount,
    pendingTimesheets: timesheetCount,
    teamAttendanceExceptions: teamAttendance?.totals.exceptions,
  }), [
    absenceCount,
    data?.teamMetrics.averagePerformance,
    data?.teamMetrics.headcount,
    data?.teamMetrics.openGoals,
    directReports.length,
    expenseCount,
    teamAttendance?.totals.exceptions,
    timesheetCount,
  ]);

  const kpiTiles = [
    {
      label: 'Direct Reports',
      value: data?.teamMetrics.headcount ?? 0,
      helper: 'People reporting to you',
      icon: Users,
      gradient: 'from-indigo-400 to-violet-500',
      shadow: 'shadow-indigo-500/15',
    },
    {
      label: 'Pending Approvals',
      value: pendingTotal,
      helper: 'Awaiting your decision',
      icon: AlertCircle,
      gradient: 'from-violet-400 to-purple-500',
      shadow: 'shadow-violet-500/15',
    },
    {
      label: 'Avg Performance',
      value: `${data?.teamMetrics.averagePerformance ?? 0}%`,
      helper: 'Team scorecard average',
      icon: TrendingUp,
      gradient: 'from-teal-400 to-emerald-500',
      shadow: 'shadow-emerald-500/15',
    },
    {
      label: 'Open Goals',
      value: data?.teamMetrics.openGoals ?? 0,
      helper: 'Active objectives in flight',
      icon: Target,
      gradient: 'from-amber-400 to-orange-500',
      shadow: 'shadow-orange-500/15',
    },
  ];

  const attentionItems = [
    {
      severity: absenceCount > 0 ? 'high' : 'low',
      title:
        absenceCount > 0
          ? `${absenceCount} leave ${absenceCount === 1 ? 'request' : 'requests'} awaiting approval`
          : 'No leave requests pending',
      time: absenceCount > 0 ? 'Action needed' : 'All clear',
      to: '/manager/approvals',
    },
    {
      severity: timesheetCount > 0 ? 'medium' : 'low',
      title:
        timesheetCount > 0
          ? `${timesheetCount} timesheet ${timesheetCount === 1 ? 'submission' : 'submissions'} to review`
          : 'Timesheets up to date',
      time: timesheetCount > 0 ? 'Upcoming' : 'All clear',
      to: '/manager/approvals',
    },
    {
      severity: expenseCount > 0 ? 'medium' : 'low',
      title:
        expenseCount > 0
          ? `${expenseCount} expense ${expenseCount === 1 ? 'claim' : 'claims'} to approve`
          : 'No expense claims pending',
      time: expenseCount > 0 ? 'Upcoming' : 'All clear',
      to: '/manager/approvals',
    },
  ];

  if (isError) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mx-auto max-w-[1740px]">
          <ErrorState error={error} onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-[1740px] space-y-8">
        {/* Greeting header */}
        <div className="flex flex-col justify-center">
          <div className="mb-3 inline-flex items-center gap-2 self-start rounded-full border border-white/60 bg-white/60 py-1 pl-2 pr-3 text-xs font-bold text-slate-600 backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="fusion-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Team workspace · live
          </div>
          <h1 className="mb-3 font-headline text-4xl font-extrabold tracking-tight md:text-5xl">
            <span className="fusion-gradient-text">
              {getGreeting()}, {firstName}
            </span>
          </h1>
          <p className="flex max-w-2xl items-start gap-2.5 text-base font-medium leading-relaxed text-slate-600 md:text-lg">
            <Quote size={20} className="mt-1 -scale-x-100 shrink-0 text-amber-400" fill="currentColor" />
            <span className="italic">{dailyQuote}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {managerJourneyItems.map((item) => (
            <Link key={item.label} to={item.href} className="group">
              <div className="flex h-full min-h-[142px] flex-col justify-between rounded-[1.5rem] border border-white/70 bg-white/65 p-5 shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:bg-white/90 group-hover:shadow-md">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{item.category}</p>
                    <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-bold', managerJourneyToneClasses[item.tone])}>
                      {item.status}
                    </span>
                  </div>
                  <h2 className="mt-3 text-base font-extrabold text-slate-950">{item.label}</h2>
                </div>
                <div className="mt-5 flex items-center justify-between text-sm font-bold text-indigo-600">
                  <span>{item.actionLabel}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Vivid bento KPI tiles */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {kpiTiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <div
                key={tile.label}
                className={cn(
                  'group relative flex h-[180px] flex-col justify-between overflow-hidden rounded-[2rem] bg-gradient-to-br p-6 text-white shadow-lg fusion-hover',
                  tile.gradient,
                  tile.shadow,
                )}
              >
                <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/15 blur-2xl transition-transform duration-500 group-hover:scale-150" />
                <div className="relative z-10 flex items-start justify-between">
                  <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm">
                    <Icon className="h-6 w-6" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-white/70" />
                </div>
                <div className="relative z-10">
                  <div className="mb-1 font-headline text-4xl font-extrabold leading-none">
                    {isLoading ? '—' : tile.value}
                  </div>
                  <div className="text-sm font-medium text-white/90">{tile.helper}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="flex flex-col rounded-[2rem] p-6 fusion-glass lg:p-8">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold">
                  <Clock3 size={20} className="text-indigo-500" />
                  My Attendance
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {ownAttendance?.periodStart ?? todayKey} to {ownAttendance?.periodEnd ?? todayKey}
                </p>
              </div>
              <Select value={attendanceRange} onValueChange={(value) => setAttendanceRange(value as AttendancePeriodRange)}>
                <SelectTrigger aria-label="Attendance period" className="h-9 w-[132px] rounded-xl bg-white/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {attendanceRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatTile
                variant="plain"
                className="rounded-2xl border-white/60 bg-white/55 px-4 py-3"
                label="Payable"
                value={formatHours(ownAttendance?.totals.payableHours)}
                labelClassName="text-[11px] font-bold uppercase tracking-wider text-slate-500"
                valueClassName="text-lg font-extrabold text-slate-900"
              />
              <StatTile
                variant="plain"
                className="rounded-2xl border-white/60 bg-white/55 px-4 py-3"
                label="Late"
                value={`${ownAttendance?.totals.lateMinutes ?? 0}m`}
                labelClassName="text-[11px] font-bold uppercase tracking-wider text-slate-500"
                valueClassName="text-lg font-extrabold text-slate-900"
              />
              <StatTile
                variant="plain"
                className="rounded-2xl border-white/60 bg-white/55 px-4 py-3"
                label="Exceptions"
                value={`${ownAttendance?.totals.exceptions ?? 0}`}
                labelClassName="text-[11px] font-bold uppercase tracking-wider text-slate-500"
                valueClassName="text-lg font-extrabold text-slate-900"
              />
            </div>
            <div className="mt-5 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ownAttendanceSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
                  <ReTooltip contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', fontSize: 13 }} />
                  <Area type="monotone" dataKey="hours" stroke="#818cf8" strokeWidth={3} fill="#818cf833" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex flex-col rounded-[2rem] p-6 fusion-glass lg:p-8">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold">
                  <CalendarDays size={20} className="text-teal-500" />
                  Team Attendance
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Direct reports - {rangeLabel(attendanceRange)}
                </p>
              </div>
              <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-700">
                {teamAttendance?.workers?.length ?? directReports.length} people
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatTile
                variant="plain"
                className="rounded-2xl border-white/60 bg-white/55 px-4 py-3"
                label="Payable"
                value={formatHours(teamAttendance?.totals.payableHours)}
                labelClassName="text-[11px] font-bold uppercase tracking-wider text-slate-500"
                valueClassName="text-lg font-extrabold text-slate-900"
              />
              <StatTile
                variant="plain"
                className="rounded-2xl border-white/60 bg-white/55 px-4 py-3"
                label="Absences"
                value={`${teamAttendance?.totals.absent ?? 0}`}
                labelClassName="text-[11px] font-bold uppercase tracking-wider text-slate-500"
                valueClassName="text-lg font-extrabold text-slate-900"
              />
              <StatTile
                variant="plain"
                className="rounded-2xl border-white/60 bg-white/55 px-4 py-3"
                label="Exceptions"
                value={`${teamAttendance?.totals.exceptions ?? 0}`}
                labelClassName="text-[11px] font-bold uppercase tracking-wider text-slate-500"
                valueClassName="text-lg font-extrabold text-slate-900"
              />
            </div>
            <div className="mt-5 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={teamAttendanceSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
                  <ReTooltip contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', fontSize: 13 }} />
                  <Area type="monotone" dataKey="hours" stroke="#14b8a6" strokeWidth={3} fill="#14b8a633" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-5 border-t border-white/50 pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-900">Team ledger</h3>
                <span className="text-xs font-semibold text-slate-500">{rangeLabel(attendanceRange)}</span>
              </div>
              <div className="space-y-2">
                {(teamAttendance?.workers ?? []).slice(0, 5).map((worker) => (
                  <div key={worker.workerId} className="grid gap-2 rounded-xl border border-white/60 bg-white/55 px-3 py-2 text-xs md:grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(0,0.75fr))]">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{worker.name}</p>
                      <p className="truncate text-slate-500">{worker.employeeId}{worker.departmentName ? ` - ${worker.departmentName}` : ''}</p>
                    </div>
                    <p className="font-semibold text-slate-700">Payable {formatHours(worker.payableHours)}</p>
                    <p className="font-semibold text-slate-700">Late {worker.lateMinutes}m</p>
                    <p className={cn('font-semibold', worker.exceptions > 0 ? 'text-amber-700' : 'text-emerald-700')}>
                      {worker.payrollReady > 0 ? 'Payroll ready' : `${worker.exceptions} exceptions`}
                    </p>
                  </div>
                ))}
                {(teamAttendance?.workers ?? []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/70 bg-white/45 p-3 text-xs text-slate-500">
                    Team attendance rows will appear when direct reports have policy-ledger activity in this range.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Analytics */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Team performance trend — area, spans 2 */}
          <div className="flex flex-col rounded-[2rem] p-6 fusion-glass lg:col-span-2 lg:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <TrendingUp size={20} className="text-indigo-500" />
                Team Performance
              </h2>
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                Last 6 months
              </span>
            </div>
            <div className="-ml-2 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={teamPerformanceTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="managerPerf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#a5b4fc" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                    width={36}
                  />
                  <ReTooltip
                    contentStyle={{
                      borderRadius: 16,
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
                      fontSize: 13,
                    }}
                  />
                  <Area type="monotone" dataKey="score" stroke="#818cf8" strokeWidth={3} fill="url(#managerPerf)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {approvalsBreakdown.length > 0 ? (
            <DonutChartPanel
              title="Approvals Breakdown"
              data={approvalsBreakdown.map((entry) => ({ label: entry.name, value: entry.value }))}
              height={288}
            />
          ) : (
            <div className="flex flex-col rounded-[2rem] p-6 fusion-glass lg:p-8">
              <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">Approvals Breakdown</h2>
              <div className="flex h-72 flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                All approvals cleared
              </div>
            </div>
          )}
        </div>

        {/* Pending leave + attention */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Pending Leave — glass, spans 2 */}
          <div className="flex flex-col rounded-[2rem] p-6 fusion-glass lg:col-span-2 lg:p-8">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold">
                  <Activity size={20} className="text-indigo-500" />
                  Pending Leave
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">Leave requests awaiting your approval</p>
              </div>
              <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">
                {absenceCount}
              </span>
            </div>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : absences.length > 0 ? (
              <DataTable
                columns={absenceColumns}
                data={absences}
                keyExtractor={(row) => row.id}
                emptyMessage="No pending leave requests"
              />
            ) : (
              <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                All leave requests reviewed
              </div>
            )}
          </div>

          {/* Attention Required — glass */}
          <div className="flex flex-col rounded-[2rem] p-6 fusion-glass">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <AlertTriangle className="text-orange-500" size={20} />
                Attention Required
              </h2>
              <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">
                {pendingTotal}
              </span>
            </div>
            <div className="space-y-3">
              {attentionItems.map((item) => (
                <Link
                  key={item.title}
                  to={item.to}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border border-white/40 p-3 transition-colors',
                    alertBg[item.severity],
                  )}
                >
                  <div className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', alertDot[item.severity])} />
                  <div className="flex-1">
                    <p className="text-sm font-bold leading-snug">{item.title}</p>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {item.time}
                    </p>
                  </div>
                  <ChevronRight size={16} className="mt-1 shrink-0 text-slate-400" />
                </Link>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-2 border-t border-white/40 pt-5">
              <Button asChild variant="outline" className="w-full justify-start rounded-xl bg-white/55">
                <Link to="/manager/team">
                  <Users className="mr-2 h-4 w-4" />
                  View Team
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start rounded-xl bg-white/55">
                <Link to="/manager/approvals">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Review Approvals
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Team Overview — glass */}
        <div className="flex flex-col rounded-[2rem] p-6 fusion-glass lg:p-8">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <Users size={20} className="text-violet-500" />
                Team Overview
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">Your direct reports</p>
            </div>
            <Button asChild size="sm" variant="secondary" className="rounded-xl">
              <Link to="/manager/team">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : directReports.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {directReports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-2xl border border-white/60 bg-white/55 p-4 transition-all hover:bg-white/80 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-400 to-violet-400 text-sm font-bold text-white shadow-sm">
                      {report.firstName.charAt(0)}{report.lastName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">
                        {report.firstName} {report.lastName}
                      </p>
                      <p className="truncate text-xs font-medium text-slate-500">{report.jobTitle}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="ghost" size="sm" asChild className="rounded-lg">
                      <Link to={`/manager/team?worker=${report.id}`}>
                        <Eye className="mr-1 h-3 w-3" />
                        View
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="No direct reports yet"
              description="When team members are assigned to you, they'll appear here."
            />
          )}
        </div>
      </div>
    </div>
  );
}

