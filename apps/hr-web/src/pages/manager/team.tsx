import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { useTenant } from '@/hooks/use-tenant';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChartPanel, type ChartDatum } from '@/components/ui/charts';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
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
import { useUIStore } from '@/stores/ui-store';

import { AllowedActions } from '@/components/common/allowed-actions';
import { TeamActivityCard } from '@/components/manager/team-activity-card';
import { computeUpcomingTeamEvents } from '@/lib/team-activity';
import { formatDate } from '@/lib/utils';
import {
  ArrowLeft,
  Users,
  Star,
  DollarSign,
  MessageSquare,
  Target,
  TrendingUp,
  BrainCircuit,
  ShieldAlert,
  Clock3,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Goal,
  Gauge,
} from 'lucide-react';
import type { Worker } from '@/types';

interface TeamMemberPerformanceImpact {
  actionPlan?: {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    checkInCadence?: string;
    recommendedActions?: string[];
    currentPerformance?: {
      latestRating: number | null;
      averageGoalProgress: number;
      peerAverageRating: number | null;
      activeGoalCount: number;
      openDevelopmentPlan: boolean;
    };
  };
  feedbackSummary?: {
    averageRating: number | null;
    responseCount: number;
    anonymousResponseCount: number;
    conciseFeedback: string;
  };
  nineBox?: {
    performanceScore: number;
    potentialScore: number;
    box: string;
  };
}

interface TeamMemberDetail extends Worker {
  performanceRating?: number;
  compensationBand?: string;
  lastReviewDate?: string;
  goals: Array<{ id: string; title: string; status: string; progress: number }>;
  performanceImpact?: TeamMemberPerformanceImpact;
}

interface ManagerTeamData {
  directReports: Worker[];
  selectedMember?: TeamMemberDetail;
}

interface TeamAttritionRiskSnapshot {
  id: string;
  workerId: string;
  periodKey: string;
  score: number;
  band: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: Array<{ factor: string; weight: number; detail: string }>;
}

type TeamAttritionRiskResponse =
  | TeamAttritionRiskSnapshot[]
  | { data?: TeamAttritionRiskSnapshot[] };

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
  workers: Array<AttendancePeriodMetrics & {
    workerId: string;
    employeeId: string;
    name: string;
    departmentName?: string;
  }>;
}

type AttendanceLedgerStatus =
  | 'ABSENT'
  | 'GEOFENCE_VIOLATION'
  | 'HOLIDAY'
  | 'IN_PROGRESS'
  | 'LATE'
  | 'LEAVE_CLOCK_EVENT_CONFLICT'
  | 'LOW_TRUST'
  | 'MISSING_CHECKOUT'
  | 'ON_DUTY'
  | 'ON_LEAVE'
  | 'OUT'
  | 'OVERTIME'
  | 'PRESENT'
  | 'UNDERTIME'
  | 'WEEKEND';

interface AttendanceLedgerRow {
  worker: {
    workerId: string;
    employeeId: string;
    name: string;
    departmentName?: string;
  };
  status: AttendanceLedgerStatus;
  firstCheckInAt?: string;
  latestCheckOutAt?: string;
  exceptions: Array<{ code: string; description: string; severity: 'HIGH' | 'LOW' | 'MEDIUM' }>;
}

interface AttendanceExceptionQueueItem {
  workerId: string;
  workerName: string;
  description: string;
  severity: 'HIGH' | 'LOW' | 'MEDIUM';
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'ESCALATED';
}

interface AttendanceDailyLedgerSummary {
  workDate: string;
  rows: AttendanceLedgerRow[];
  summary: {
    totalEmployees: number;
    present: number;
    absent: number;
    onLeave: number;
    late: number;
    missingCheckout: number;
    exceptions: number;
    payrollReady: number;
  };
  exceptionQueue: AttendanceExceptionQueueItem[];
}

interface ManagerPerformanceDashboard {
  managerId: string;
  managerName: string;
  reportCount: number;
  analytics: {
    ratingDistribution?: Array<{ rating: number; count: number }>;
    goalMetrics?: { total: number; active: number; achieved: number; atRisk: number; averageProgress: number };
    nineBox?: Array<{ workerId: string; employeeName: string; performanceScore: number; potentialScore: number; box: string }>;
    recognitions?: Array<{ workerId: string; employeeName: string; score: number; reason: string }>;
    actionPlans?: Array<{
      workerId: string;
      employeeName: string;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
      progressTrend: string;
      recommendedActions: string[];
    }>;
  };
}

const attendanceRangeOptions: Array<{ value: AttendancePeriodRange; label: string }> = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'NINETY_DAYS', label: '90 days' },
];

function rangeLabel(range: AttendancePeriodRange) {
  return attendanceRangeOptions.find((option) => option.value === range)?.label ?? 'Weekly';
}

function dateKey(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function formatHours(value?: number) {
  const hours = Math.max(value ?? 0, 0);
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
}

function formatTime(value?: string) {
  if (!value) return '--';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function attendanceStatusVariant(status: AttendanceLedgerStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (['ABSENT', 'GEOFENCE_VIOLATION', 'MISSING_CHECKOUT'].includes(status)) return 'destructive';
  if (['LATE', 'UNDERTIME', 'OVERTIME', 'ON_DUTY', 'LOW_TRUST', 'LEAVE_CLOCK_EVENT_CONFLICT'].includes(status)) return 'secondary';
  if (status === 'ON_LEAVE') return 'outline';
  return status === 'OUT' || status === 'PRESENT' ? 'default' : 'outline';
}

function severityVariant(severity: 'HIGH' | 'LOW' | 'MEDIUM'): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (severity === 'HIGH') return 'destructive';
  if (severity === 'MEDIUM') return 'secondary';
  return 'outline';
}

function StatTile({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <div className="fusion-glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function formatLabel(value?: string) {
  if (!value) return 'Not assigned';
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatScore(
  value: number | null | undefined,
  suffix = '',
  emptyLabel = 'Not available',
) {
  return value === null || value === undefined || Number.isNaN(value)
    ? emptyLabel
    : `${Math.round(value * 10) / 10}${suffix}`;
}

function isOpenGoal(status: string) {
  return ['OPEN', 'DRAFT', 'ACTIVE', 'IN_PROGRESS'].includes(status);
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function performanceRiskVariant(
  riskLevel?: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (riskLevel === 'HIGH') return 'destructive';
  if (riskLevel === 'MEDIUM') return 'secondary';
  if (riskLevel === 'LOW') return 'default';
  return 'outline';
}

function performanceRiskLabel(riskLevel?: string) {
  if (riskLevel === 'HIGH') return 'High attention';
  if (riskLevel === 'MEDIUM') return 'Medium attention';
  if (riskLevel === 'LOW') return 'On track';
  return 'No attention flag';
}

function workerStatusVariant(
  status?: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'ACTIVE') return 'default';
  if (status === 'TERMINATED' || status === 'INACTIVE') return 'destructive';
  if (status) return 'secondary';
  return 'outline';
}

function insightTone(band: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (band === 'HIGH') return 'destructive';
  if (band === 'MEDIUM') return 'secondary';
  if (band === 'LOW') return 'default';
  return 'outline';
}

function teamRiskDistribution(rows: TeamAttritionRiskSnapshot[]): ChartDatum[] {
  const counts = rows.reduce<Record<'LOW' | 'MEDIUM' | 'HIGH', number>>((acc, row) => {
    acc[row.band] += 1;
    return acc;
  }, { LOW: 0, MEDIUM: 0, HIGH: 0 });
  return [
    { label: 'Low', value: counts.LOW },
    { label: 'Medium', value: counts.MEDIUM },
    { label: 'High', value: counts.HIGH },
  ];
}

function attritionRiskRowsFromResponse(
  response: TeamAttritionRiskResponse | undefined,
): TeamAttritionRiskSnapshot[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function readApiError(error: unknown): string {
  const responseData = (error as { response?: { data?: { message?: unknown; error?: unknown } } }).response?.data;
  if (typeof responseData?.message === 'string') return responseData.message;
  if (Array.isArray(responseData?.message)) return responseData.message.join(', ');
  if (typeof responseData?.error === 'string') return responseData.error;
  return error instanceof Error ? error.message : 'Request failed';
}

const SMART_CRITERIA_FIELDS = [
  ['specific', 'Specific'],
  ['measurable', 'Measurable'],
  ['achievable', 'Achievable'],
  ['relevant', 'Relevant'],
  ['timeBound', 'Time-bound'],
] as const;

type SmartCriteriaKey = (typeof SMART_CRITERIA_FIELDS)[number][0];

interface AssignGoalFormState {
  title: string;
  metricName: string;
  targetValue: string;
  startDate: string;
  dueDate: string;
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  timeBound: string;
}

const EMPTY_GOAL_FORM: AssignGoalFormState = {
  title: '',
  metricName: '',
  targetValue: '',
  startDate: '',
  dueDate: '',
  specific: '',
  measurable: '',
  achievable: '',
  relevant: '',
  timeBound: '',
};

/**
 * Assigns a new SMART goal to a direct report.
 * Backed by POST /performance/goals (CreateGoal), which the RBAC + manager
 * self-service allowlist genuinely permits for the MANAGER role.
 */
function AssignGoalDialog({ workerId, workerName, onCreated }: { workerId: string; workerName: string; onCreated: () => void }) {
  const addNotification = useUIStore((s) => s.addNotification);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<AssignGoalFormState>(EMPTY_GOAL_FORM);

  const createGoal = useApiMutation<unknown, Record<string, unknown>>(
    '/performance/goals',
    'post',
    undefined,
    {
      onSuccess: () => {
        addNotification({
          title: 'Goal assigned',
          message: `A new goal was assigned to ${workerName}.`,
          type: 'success',
          read: false,
        });
        setForm(EMPTY_GOAL_FORM);
        setOpen(false);
        onCreated();
      },
      onError: (err) => addNotification({
        title: 'Could not assign goal',
        message: readApiError(err) || 'Unable to create the goal.',
        type: 'error',
        read: false,
      }),
    },
  );

  const isComplete = Object.values(form).every((value) => value.trim().length > 0);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isComplete) return;
    createGoal.mutate({
      workerId,
      title: form.title,
      metricName: form.metricName,
      targetValue: Number(form.targetValue),
      startDate: form.startDate,
      dueDate: form.dueDate,
      smartCriteria: {
        specific: form.specific,
        measurable: form.measurable,
        achievable: form.achievable,
        relevant: form.relevant,
        timeBound: form.timeBound,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          <Target className="mr-2 h-4 w-4" />
          Assign Goal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign a goal to {workerName}</DialogTitle>
          <DialogDescription>Goals must meet SMART criteria before they can be created.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="goal-title">Title</Label>
            <Input id="goal-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="goal-metric">Metric name</Label>
              <Input id="goal-metric" value={form.metricName} onChange={(event) => setForm((current) => ({ ...current, metricName: event.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-target">Target value</Label>
              <Input id="goal-target" type="number" value={form.targetValue} onChange={(event) => setForm((current) => ({ ...current, targetValue: event.target.value }))} required />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="goal-start">Start date</Label>
              <Input id="goal-start" type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-due">Due date</Label>
              <Input id="goal-due" type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} required />
            </div>
          </div>
          {SMART_CRITERIA_FIELDS.map(([key, label]) => (
            <div className="space-y-2" key={key}>
              <Label htmlFor={`goal-${key}`}>{label}</Label>
              <Input
                id={`goal-${key}`}
                value={form[key as SmartCriteriaKey]}
                onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                required
              />
            </div>
          ))}
          <DialogFooter>
            <Button type="submit" disabled={!isComplete || createGoal.isPending}>
              {createGoal.isPending ? 'Assigning...' : 'Assign goal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Starts a draft Performance Improvement Plan for a direct report.
 * Backed by POST /performance/improvement-plans (CreatePerformanceImprovementPlan),
 * which the RBAC + manager self-service allowlist genuinely permits for the MANAGER role.
 *
 * PIP lifecycle transitions beyond the initial draft (activate, enter-review, record a
 * checkpoint, extend, complete, close, terminate) are NOT wired here: RBAC denies every one
 * of those commands for a bare MANAGER role today (ActivatePerformanceImprovementPlan,
 * EnterReviewPerformanceImprovementPlan, CompletePerformanceImprovementPlan,
 * ClosePerformanceImprovementPlan, ExtendPerformanceImprovementPlan,
 * TerminatePerformanceImprovementPlan are all RBAC- and allowlist-denied; even
 * RecordPerformanceImprovementPlanCheckpoint, which IS on the manager self-service
 * allowlist, is still RBAC-denied because the MANAGER role has no PERFORMANCE_WRITE
 * permission). Wiring those buttons would just 403, so they stay deferred to HR
 * performance admin scope.
 */
function StartImprovementPlanDialog({
  workerId,
  managerId,
  workerName,
  onCreated,
}: {
  workerId: string;
  managerId?: string;
  workerName: string;
  onCreated: () => void;
}) {
  const addNotification = useUIStore((s) => s.addNotification);
  const [open, setOpen] = React.useState(false);
  const [checkInCadence, setCheckInCadence] = React.useState('');
  const [objectivesText, setObjectivesText] = React.useState('');

  const createPip = useApiMutation<unknown, Record<string, unknown>>(
    '/performance/improvement-plans',
    'post',
    undefined,
    {
      onSuccess: () => {
        addNotification({
          title: 'Improvement plan started',
          message: `A draft performance improvement plan was started for ${workerName}.`,
          type: 'success',
          read: false,
        });
        setCheckInCadence('');
        setObjectivesText('');
        setOpen(false);
        onCreated();
      },
      onError: (err) => addNotification({
        title: 'Could not start improvement plan',
        message: readApiError(err) || 'Unable to create the improvement plan.',
        type: 'error',
        read: false,
      }),
    },
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!managerId) return;
    const objectives = objectivesText.split('\n').map((line) => line.trim()).filter(Boolean);
    createPip.mutate({
      workerId,
      managerId,
      checkInCadence: checkInCadence.trim() || undefined,
      objectives: objectives.length > 0 ? objectives : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={!managerId}>
          <ShieldAlert className="mr-2 h-4 w-4" />
          Start Improvement Plan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a performance improvement plan for {workerName}</DialogTitle>
          <DialogDescription>
            This creates the draft plan. Activation, checkpoints, and closure require HR performance
            admin scope and happen outside this manager view.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="pip-cadence">Check-in cadence</Label>
            <Input
              id="pip-cadence"
              placeholder="e.g. Weekly"
              value={checkInCadence}
              onChange={(event) => setCheckInCadence(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pip-objectives">Objectives (one per line)</Label>
            <textarea
              id="pip-objectives"
              rows={3}
              value={objectivesText}
              onChange={(event) => setObjectivesText(event.target.value)}
              className="min-h-[76px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createPip.isPending || !managerId}>
              {createPip.isPending ? 'Starting...' : 'Start plan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Team management page with direct reports list and individual profile view.
 */
export function ManagerTeam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedWorkerId = searchParams.get('worker');
  const { tenantId } = useTenant();

  const { data, isLoading, isError, error, refetch } =
    useApiQuery<ManagerTeamData>(
      ['manager-team', selectedWorkerId],
      `/manager/team${selectedWorkerId ? `?workerId=${selectedWorkerId}` : ''}`,
    );
  const { data: attritionRiskRaw } = useApiQuery<TeamAttritionRiskResponse>(
    ['manager-team-attrition-risk', tenantId],
    `/intelligence/attrition-risk/tenant/${tenantId}`,
    { enabled: Boolean(tenantId) },
  );
  const directReports = React.useMemo(() => data?.directReports ?? [], [data?.directReports]);
  const attritionRiskRows = React.useMemo(
    () => attritionRiskRowsFromResponse(attritionRiskRaw),
    [attritionRiskRaw],
  );
  const teamRiskRows = React.useMemo(() => {
    const reportIds = new Set(directReports.map((worker) => worker.id));
    return attritionRiskRows.filter((row) => reportIds.has(row.workerId));
  }, [attritionRiskRows, directReports]);
  const riskChart = React.useMemo(() => teamRiskDistribution(teamRiskRows), [teamRiskRows]);
  const teamActivity = React.useMemo(
    () => computeUpcomingTeamEvents(directReports),
    [directReports],
  );

  const [attendanceRange, setAttendanceRange] = React.useState<AttendancePeriodRange>('WEEKLY');
  const todayDateKey = React.useMemo(() => dateKey(), []);

  const { data: managerProfile } = useApiQuery<Worker>(['manager-team-self-profile'], '/employee/profile');

  const { data: teamAttendance, isLoading: teamAttendanceLoading } = useApiQuery<AttendancePeriodView>(
    ['manager-team-attendance-period-view', attendanceRange, todayDateKey],
    `/time/attendance/reports/period-view?scope=TEAM&range=${attendanceRange}&date=${todayDateKey}`,
  );

  const { data: dailyLedger, isLoading: dailyLedgerLoading } = useApiQuery<AttendanceDailyLedgerSummary>(
    ['manager-team-daily-ledger', todayDateKey],
    `/time/attendance/daily-ledger?date=${todayDateKey}`,
  );

  const { data: performanceDashboard, isLoading: performanceDashboardLoading } = useApiQuery<ManagerPerformanceDashboard>(
    ['manager-team-performance-analytics', managerProfile?.id],
    `/performance/analytics/manager/${managerProfile?.id}`,
    { enabled: Boolean(managerProfile?.id) },
  );

  const ratingChart = React.useMemo<ChartDatum[]>(
    () => (performanceDashboard?.analytics?.ratingDistribution ?? []).map((entry) => ({ label: `${entry.rating}`, value: entry.count })),
    [performanceDashboard?.analytics?.ratingDistribution],
  );

  const todayLedgerColumns: DataTableColumn<AttendanceLedgerRow>[] = [
    { key: 'name', header: 'Name', cell: (row) => <span className="font-medium text-slate-900">{row.worker.name}</span> },
    { key: 'department', header: 'Department', cell: (row) => row.worker.departmentName || 'Not assigned' },
    { key: 'status', header: 'Status', cell: (row) => <Badge variant={attendanceStatusVariant(row.status)}>{row.status.replace(/_/g, ' ')}</Badge> },
    { key: 'firstCheckIn', header: 'First check-in', cell: (row) => formatTime(row.firstCheckInAt) },
    { key: 'latestCheckOut', header: 'Latest check-out', cell: (row) => formatTime(row.latestCheckOutAt) },
    {
      key: 'exceptions',
      header: 'Exceptions',
      cell: (row) => (row.exceptions.length > 0
        ? <Badge variant="secondary">{row.exceptions.length}</Badge>
        : <span className="text-emerald-600">-</span>),
    },
  ];

  const [rosterSort, setRosterSort] = React.useState<{ column: string; direction: 'asc' | 'desc' }>({ column: 'name', direction: 'asc' });
  type TeamRosterRow = AttendancePeriodView['workers'][number];
  const rosterSortValue = React.useCallback((row: TeamRosterRow): string | number => {
    if (rosterSort.column === 'payable') return row.payableHours;
    if (rosterSort.column === 'late') return row.lateMinutes;
    if (rosterSort.column === 'absences') return row.absent;
    return row.name.toLowerCase();
  }, [rosterSort.column]);
  const sortedTeamRoster = React.useMemo(() => {
    const rows = [...(teamAttendance?.workers ?? [])];
    rows.sort((left, right) => {
      const leftValue = rosterSortValue(left);
      const rightValue = rosterSortValue(right);
      const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue));
      return rosterSort.direction === 'asc' ? comparison : -comparison;
    });
    return rows;
  }, [rosterSort.direction, rosterSortValue, teamAttendance?.workers]);

  const teamRosterColumns: DataTableColumn<AttendancePeriodView['workers'][number]>[] = [
    { key: 'name', header: 'Name', cell: (row) => <span className="font-medium text-slate-900">{row.name}</span>, sortable: true },
    { key: 'department', header: 'Department', cell: (row) => row.departmentName || 'Not assigned' },
    { key: 'payable', header: 'Payable', cell: (row) => formatHours(row.payableHours), sortable: true },
    { key: 'late', header: 'Late (min)', cell: (row) => row.lateMinutes, sortable: true },
    { key: 'absences', header: 'Absences', cell: (row) => row.absent, sortable: true },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (row.exceptions > 0
        ? <Badge variant="secondary">{row.exceptions} exception{row.exceptions === 1 ? '' : 's'}</Badge>
        : row.payrollReady > 0
          ? <Badge>Payroll ready</Badge>
          : <Badge variant="outline">No activity</Badge>),
    },
  ];

  const reportColumns = [
    {
      key: 'name',
      header: 'Name',
      cell: (row: Worker) => (
        <button
          className="text-sm font-medium text-primary hover:underline text-left"
          onClick={() => setSearchParams({ worker: row.id })}
        >
          {row.firstName} {row.lastName}
        </button>
      ),
    },
    {
      key: 'jobTitle',
      header: 'Job Title',
      cell: (row: Worker) => row.jobTitle || 'Not assigned',
    },
    {
      key: 'department',
      header: 'Department',
      cell: (row: Worker) => row.departmentName || 'Not assigned',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: Worker) => (
        <Badge variant={workerStatusVariant(row.status)}>
          {formatLabel(row.status)}
        </Badge>
      ),
    },
    {
      key: 'hireDate',
      header: 'Hire Date',
      cell: (row: Worker) => formatDate(row.hireDate),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  // Show individual member detail if selected
  if (selectedWorkerId && data?.selectedMember) {
    const member = data.selectedMember;
    const performanceImpact = member.performanceImpact;
    const actionPlan = performanceImpact?.actionPlan;
    const feedbackSummary = performanceImpact?.feedbackSummary;
    const openGoalCount = member.goals.filter((goal) =>
      isOpenGoal(goal.status),
    ).length;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchParams({})}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to team
            </Button>
            <div>
              <h1 className="font-headline text-2xl font-extrabold tracking-tight md:text-3xl">
                <span className="fusion-gradient-text">
                  {member.firstName} {member.lastName}
                </span>
              </h1>
              <p className="text-slate-500">
                {member.jobTitle || 'Role not assigned'} -{' '}
                {member.departmentName || 'Department not assigned'}
              </p>
            </div>
          </div>
          <AllowedActions
            aggregateType="WORKER"
            aggregateId={member.id}
            context={{ managerView: true }}
            readOnlyReason="This team action is available when the request flow is connected for managers."
          />
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="compensation">Compensation</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="fusion-glass rounded-[2rem] p-6">
              <h2 className="mb-4 text-lg font-bold">Employment Details</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Employee ID</p>
                  <p className="text-sm font-medium">{member.employeeId}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Hire Date</p>
                  <p className="text-sm font-medium">
                    {formatDate(member.hireDate)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Status</p>
                  <Badge variant={workerStatusVariant(member.status)}>
                    {formatLabel(member.status)}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Department</p>
                  <p className="text-sm font-medium">
                    {member.departmentName || 'Not assigned'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Manager</p>
                  <p className="text-sm font-medium">
                    {member.managerName || 'Not assigned'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Legal Entity</p>
                  <p className="text-sm font-medium">
                    {member.legalEntityName || 'Not assigned'}
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="performance">
            <div className="fusion-glass rounded-[2rem] p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <Star className="h-5 w-5 text-amber-500" />
                Performance
              </h2>
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="fusion-glass rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <TrendingUp className="h-4 w-4" />
                      Latest Rating
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-2xl font-bold">
                        {formatScore(member.performanceRating, '', 'Not rated')}
                      </span>
                      {member.lastReviewDate && (
                        <span className="text-xs text-slate-500">
                          ({formatDate(member.lastReviewDate)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="fusion-glass rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Target className="h-4 w-4" />
                      Open Goals
                    </div>
                    <p className="mt-1 text-2xl font-bold">{openGoalCount}</p>
                  </div>
                  <div className="fusion-glass rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <MessageSquare className="h-4 w-4" />
                      360 feedback
                    </div>
                    <p className="mt-1 text-2xl font-bold">
                      {formatScore(
                        feedbackSummary?.averageRating ??
                          actionPlan?.currentPerformance?.peerAverageRating,
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {feedbackSummary?.responseCount ?? 0} responses
                    </p>
                  </div>
                  <div className="fusion-glass rounded-2xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">Support plan</p>
                      <Badge
                        variant={performanceRiskVariant(actionPlan?.riskLevel)}
                      >
                        {performanceRiskLabel(actionPlan?.riskLevel)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-800">
                      {actionPlan?.checkInCadence ??
                        'No check-in rhythm set yet.'}
                    </p>
                  </div>
                </div>

                {performanceImpact && (
                  <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
                    <div className="fusion-glass rounded-2xl p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        360 feedback summary
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {feedbackSummary?.conciseFeedback ??
                          'No submitted 360 feedback summary yet.'}
                      </p>
                    </div>
                    <div className="fusion-glass rounded-2xl p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {performanceImpact.nineBox?.box ??
                          'Talent grid pending'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {performanceImpact.nineBox?.performanceScore ===
                        undefined
                          ? 'No performance score yet'
                          : `${formatScore(performanceImpact.nineBox.performanceScore, '%')} performance`}
                      </p>
                      <p className="mt-4 text-xs font-medium uppercase text-slate-500">
                        Next focus
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {actionPlan?.recommendedActions?.[0] ??
                          'Keep regular check-ins on active goals.'}
                      </p>
                    </div>
                  </div>
                )}

                {!performanceImpact && (
                  <EmptyState
                    icon={Star}
                    title="No performance summary yet"
                    description="Reviews, 360 feedback, and talent grid context will appear after the active cycle has data."
                  />
                )}

                {member.goals.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">Goals</h3>
                    {member.goals.map((goal) => (
                      <div
                        key={goal.id}
                        className="fusion-glass rounded-2xl p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {goal.title}
                          </span>
                          <Badge variant="outline">
                            {formatLabel(goal.status)}
                          </Badge>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-accent">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${clampPercent(goal.progress)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {clampPercent(goal.progress)}% complete
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Target}
                    title="No goals on this profile yet"
                    description="Assigned goals and progress will appear here when the current cycle is ready."
                  />
                )}

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <AssignGoalDialog
                      workerId={member.id}
                      workerName={`${member.firstName} ${member.lastName}`}
                      onCreated={() => refetch()}
                    />
                    <StartImprovementPlanDialog
                      workerId={member.id}
                      managerId={member.managerId}
                      workerName={`${member.firstName} ${member.lastName}`}
                      onCreated={() => refetch()}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Rating calibration, manager-review submission, and PIP lifecycle transitions
                    (activation, checkpoints, closure) require HR performance admin scope and are
                    not available from this manager view.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="compensation">
            <div className="fusion-glass rounded-[2rem] p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                Compensation
              </h2>
              <p className="text-sm text-slate-500">
                Compensation band and recommendations
              </p>
              <div className="mt-4 space-y-4">
                <div className="fusion-glass rounded-2xl p-4">
                  <p className="text-xs text-slate-500">Compensation Band</p>
                  <p className="text-lg font-medium">
                    {member.compensationBand || 'Not assigned yet'}
                  </p>
                </div>
                <div className="fusion-glass rounded-2xl p-4 text-sm text-slate-600">
                  Compensation actions - recommending or approving pay changes, and viewing
                  compensation change history - require HR, HRBP, Payroll, or Compensation Admin
                  access. The MANAGER role does not hold any compensation command permission
                  today, so no compensation actions are available from this manager view.
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Show team list
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 font-headline text-3xl font-extrabold tracking-tight md:text-4xl">
            <Users className="h-7 w-7 text-indigo-500" />
            <span className="fusion-gradient-text">Team</span>
          </h1>
          <p className="mt-1 text-slate-500">
            Review direct reports, performance context, and next actions.
          </p>
        </div>
        <AllowedActions
          aggregateType="TEAM"
          readOnlyReason="Team actions will appear when a manager request flow is available."
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card className="bg-white/70">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              {/* Rendered as h2 (not CardTitle's default h3) to keep heading levels sequential directly under the page h1. */}
              <h2 className="flex items-center gap-2 font-headline text-2xl font-semibold leading-tight text-card-foreground">
                <Clock3 className="h-5 w-5 text-indigo-500" />
                Team Attendance
              </h2>
              <CardDescription>Who is in today, exceptions, and hours across your direct reports.</CardDescription>
            </div>
            <Select value={attendanceRange} onValueChange={(value) => setAttendanceRange(value as AttendancePeriodRange)}>
              <SelectTrigger aria-label="Attendance period" className="h-9 w-[132px] bg-white/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {attendanceRangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile icon={Users} label="Team size" value={teamAttendance?.workers?.length ?? directReports.length} />
              <StatTile icon={Clock3} label="Payable" value={teamAttendanceLoading ? '-' : formatHours(teamAttendance?.totals?.payableHours)} />
              <StatTile icon={AlertTriangle} label="Absences" value={teamAttendanceLoading ? '-' : teamAttendance?.totals?.absent ?? 0} />
              <StatTile icon={CheckCircle2} label="Exceptions" value={teamAttendanceLoading ? '-' : teamAttendance?.totals?.exceptions ?? 0} />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-bold text-slate-900">Who's in today</h3>
              <DataTable
                columns={todayLedgerColumns}
                data={dailyLedger?.rows ?? []}
                keyExtractor={(row) => row.worker.workerId}
                isLoading={dailyLedgerLoading}
                emptyMessage="No attendance ledger activity yet today."
              />
            </div>

            {(dailyLedger?.exceptionQueue ?? []).length > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-900">Needs attention</h3>
                <div className="space-y-2">
                  {(dailyLedger?.exceptionQueue ?? []).slice(0, 5).map((item, index) => (
                    <div key={`${item.workerId}-${item.description}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/55 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{item.workerName}</p>
                        <p className="truncate text-xs text-slate-500">{item.description}</p>
                      </div>
                      <Badge variant={severityVariant(item.severity)}>{item.severity}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <h3 className="mb-2 text-sm font-bold text-slate-900">Team roster - {rangeLabel(attendanceRange)}</h3>
              <DataTable
                columns={teamRosterColumns}
                data={sortedTeamRoster}
                keyExtractor={(row) => row.workerId}
                isLoading={teamAttendanceLoading}
                sortColumn={rosterSort.column}
                sortDirection={rosterSort.direction}
                onSort={(column, direction) => setRosterSort({ column, direction })}
                emptyMessage="Team attendance rows will appear when direct reports have ledger activity in this range."
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70">
          <CardHeader>
            {/* Rendered as h2 (not CardTitle's default h3) to keep heading levels sequential directly under the page h1. */}
            <h2 className="flex items-center gap-2 font-headline text-2xl font-semibold leading-tight text-card-foreground">
              <Sparkles className="h-5 w-5 text-violet-500" />
              Team Performance
            </h2>
            <CardDescription>Rating distribution, goal health, and talent grid across your direct reports.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <StatTile icon={Users} label="Direct reports" value={performanceDashboardLoading ? '-' : performanceDashboard?.reportCount ?? 0} />
              <StatTile icon={Goal} label="Avg goal progress" value={performanceDashboardLoading ? '-' : `${Math.round(performanceDashboard?.analytics?.goalMetrics?.averageProgress ?? 0)}%`} />
              <StatTile icon={Sparkles} label="Recognitions" value={performanceDashboardLoading ? '-' : performanceDashboard?.analytics?.recognitions?.length ?? 0} />
              <StatTile icon={Gauge} label="At-risk goals" value={performanceDashboardLoading ? '-' : performanceDashboard?.analytics?.goalMetrics?.atRisk ?? 0} />
            </div>

            {ratingChart.length > 0 ? (
              <BarChartPanel title="Rating distribution" data={ratingChart} height={180} />
            ) : (
              <p className="rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">No submitted ratings yet for this cycle.</p>
            )}

            <div>
              <h3 className="mb-2 text-sm font-bold text-slate-900">Talent grid</h3>
              <div className="space-y-2">
                {(performanceDashboard?.analytics?.nineBox ?? []).length > 0 ? (performanceDashboard?.analytics?.nineBox ?? []).slice(0, 5).map((item) => (
                  <div key={item.workerId} className="flex items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/55 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{item.employeeName}</p>
                      <p className="text-xs text-slate-500">Performance {Math.round(item.performanceScore)}% - Potential {Math.round(item.potentialScore)}%</p>
                    </div>
                    <Badge variant="outline">{item.box}</Badge>
                  </div>
                )) : (
                  <p className="rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">No direct-report analytics available yet.</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-bold text-slate-900">Action plans</h3>
              <div className="space-y-2">
                {(performanceDashboard?.analytics?.actionPlans ?? []).length > 0 ? (performanceDashboard?.analytics?.actionPlans ?? [])
                  .slice()
                  .sort((left, right) => (right.riskLevel === 'HIGH' ? 1 : 0) - (left.riskLevel === 'HIGH' ? 1 : 0))
                  .slice(0, 3)
                  .map((plan) => (
                    <div key={plan.workerId} className="rounded-xl border border-white/60 bg-white/55 p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">{plan.employeeName}</p>
                        <Badge variant={plan.riskLevel === 'HIGH' ? 'destructive' : plan.riskLevel === 'MEDIUM' ? 'secondary' : 'outline'}>{plan.riskLevel}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{plan.recommendedActions[0] ?? `Trend: ${plan.progressTrend}`}</p>
                    </div>
                  )) : (
                  <p className="rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">No action plans generated yet.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="fusion-glass rounded-[2rem] p-6">
        <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_24rem]">
          <Card className="bg-white/70">
            <CardHeader>
              {/* Rendered as h2 (not CardTitle's default h3) to keep heading levels sequential directly under the page h1. */}
              <h2 className="flex items-center gap-2 font-headline text-2xl font-semibold leading-tight text-card-foreground">
                <BrainCircuit className="h-5 w-5 text-indigo-500" />
                Team attrition signals
              </h2>
            </CardHeader>
            <CardContent>
              {teamRiskRows.length === 0 ? (
                <p className="text-sm text-slate-500">No scored team signals yet.</p>
              ) : (
                <div className="space-y-3">
                  {teamRiskRows.slice(0, 3).map((risk) => {
                    const worker = directReports.find((report) => report.id === risk.workerId);
                    const topFactor = [...risk.factors].sort((a, b) => b.weight - a.weight)[0];
                    return (
                      <div key={risk.id} className="rounded-2xl border border-white/60 bg-white/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {worker ? `${worker.firstName} ${worker.lastName}` : risk.workerId}
                            </p>
                            <p className="text-xs text-slate-500">{topFactor?.detail ?? risk.periodKey}</p>
                          </div>
                          <Badge variant={insightTone(risk.band)}>
                            {risk.band} {Math.round(risk.score * 100)}%
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          <BarChartPanel title="Team risk bands" data={riskChart} height={220} />
        </div>
        <div className="mb-6">
          <TeamActivityCard
            upcomingAnniversaries={teamActivity.upcomingAnniversaries}
            recentJoins={teamActivity.recentJoins}
            className="bg-white/70"
          />
        </div>
        <div className="mb-1 text-lg font-bold">Direct Reports</div>
        <p className="mb-4 text-sm text-slate-500">
          Select a team member to review profile, performance, and compensation
          context.
        </p>
        {(data?.directReports ?? []).length > 0 ? (
          <DataTable
            columns={reportColumns}
            data={directReports}
            keyExtractor={(row) => row.id}
            emptyMessage="No direct reports assigned"
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No direct reports assigned"
            description="When your reporting line is updated, team members will appear here."
          />
        )}
      </div>
    </div>
  );
}
