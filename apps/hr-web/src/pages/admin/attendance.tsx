import * as React from 'react';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { AlertTriangle, BellRing, CalendarDays, CheckCircle2, Clock3, Download, FileWarning, LockKeyhole, MapPin, PlayCircle, Plus, RefreshCw, ShieldCheck, Trash2, XCircle } from 'lucide-react';

type AttendanceStatus =
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

interface AttendanceLedgerException {
  code: string;
  description: string;
  severity: 'HIGH' | 'LOW' | 'MEDIUM';
  requiresApproval: boolean;
  source: 'CALCULATED' | 'REQUEST' | 'SYSTEM';
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'ESCALATED';
  payrollImpactMinutes: number;
  exceptionId?: string;
}

interface AttendanceLedgerRow {
  worker: {
    workerId: string;
    employeeId: string;
    name: string;
    email: string;
    departmentName?: string;
    managerId?: string;
    workLocationCode?: string;
  };
  workDate: string;
  status: AttendanceStatus;
  scheduled: boolean;
  holidayName?: string;
  firstCheckInAt?: string;
  latestCheckOutAt?: string;
  locationStatus: string;
  calculation: {
    workedMinutes: number;
    payableMinutes: number;
    lateMinutes: number;
    undertimeMinutes: number;
    overtimeMinutes: number;
    onDutyMinutes: number;
    absent: boolean;
    geofenceViolation: boolean;
  };
  exceptions: AttendanceLedgerException[];
  payrollInput: {
    workDate: string;
    workedMinutes: number;
    payableMinutes: number;
    deductionMinutes: number;
    overtimeMinutes: number;
    readyForPayroll: boolean;
    locked: boolean;
  };
  governance: {
    visibilityScope: string;
    locationDataClassification: string;
    payrollDataClassification: string;
  };
}

interface AttendanceExceptionQueueItem extends AttendanceLedgerException {
  workerId: string;
  employeeId: string;
  workerName: string;
  workDate: string;
  managerId?: string;
}

interface AttendanceLedger {
  workDate: string;
  rows: AttendanceLedgerRow[];
  locked?: boolean;
  lockedSnapshots?: AttendanceLedgerSnapshot[];
  summary: {
    absent: number;
    exceptions: number;
    geofenceViolations: number;
    inProgress: number;
    late: number;
    missingCheckout: number;
    onLeave?: number;
    payrollReady: number;
    present: number;
    totalEmployees: number;
    undertime: number;
  };
  exceptionQueue: AttendanceExceptionQueueItem[];
}

interface AttendanceLedgerSnapshot {
  id: string;
  workerId: string;
  employeeId: string;
  workerName: string;
  workDate: string;
  status: AttendanceStatus;
  payableMinutes: number;
  deductionMinutes: number;
  overtimeMinutes: number;
  readyForPayroll: boolean;
  locked: boolean;
  lockedAt: string;
  lockedBy: string;
  payrollCycleId?: string;
}

interface FinalizeDailyLedgerResponse {
  finalized: boolean;
  alreadyLocked?: boolean;
  workDate: string;
  lockedRows?: number;
  blockedRows?: Array<{
    workerId: string;
    employeeId: string;
    name: string;
    status: AttendanceStatus;
    exceptions: string[];
  }>;
  blockedCorrections?: Array<{
    id: string;
    workerId: string;
    correctionType: string;
    status: string;
    reason: string;
  }>;
  snapshots?: AttendanceLedgerSnapshot[];
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
  requestedBy: string;
  requestedAt: string;
  reviewedAt?: string;
  appliedAt?: string;
  appliedEventId?: string;
}

interface HcmSetupConfig {
  locations?: Array<{
    code: string;
    label: string;
    active?: boolean;
    currency?: string;
  }>;
  attendancePolicy?: {
    holidayCalendars?: AttendanceHolidayRule[];
    holidays?: Array<{ date: string; name: string }>;
  };
}

interface AttendanceHolidayRule {
  date: string;
  name: string;
  countryCode?: string;
  locationCodes?: string[];
  paid?: boolean;
}

interface AttendanceReminder {
  type: 'LATE_CHECK_IN' | 'MISSING_CHECK_OUT';
  workerId: string;
  employeeId: string;
  workerName: string;
  workDate: string;
  scheduledTime: string;
  minutesLate: number;
  severity: 'WARNING' | 'CRITICAL';
  message: string;
}

interface AttendanceReminderResponse {
  workDate: string;
  reminders: AttendanceReminder[];
}

interface AttendancePeriodReport {
  periodStart: string;
  periodEnd: string;
  totals: {
    employeeDays: number;
    present: number;
    absent: number;
    onLeave: number;
    exceptions: number;
    payableHours: number;
    deductionHours: number;
    overtimeHours: number;
  };
  departments: Array<AttendancePeriodReport['totals'] & { departmentName: string }>;
}

interface AttendanceCloseReadinessIssue {
  code: string;
  severity: 'ERROR' | 'WARNING';
  blocking: boolean;
  workerId: string;
  employeeId?: string;
  employeeName?: string;
  workDate: string;
  message: string;
  correctionRequestId?: string;
}

interface AttendanceCloseReadiness {
  canClose: boolean;
  periodStart: string;
  periodEnd: string;
  totalEmployees: number;
  totalDays: number;
  totalExpectedRows: number;
  lockedRows: number;
  readyRows: number;
  blockingIssueCount: number;
  warningIssueCount: number;
  issues: AttendanceCloseReadinessIssue[];
}

interface AttendancePeriodCloseReadinessResponse {
  periodStart: string;
  periodEnd: string;
  year: number;
  month: number;
  workplaceCode?: string;
  readiness: AttendanceCloseReadiness;
}

interface AttendancePeriodCloseResult extends AttendancePeriodCloseReadinessResponse {
  payrollCycleId?: string;
  finalized: boolean;
  status: 'CLOSED_TO_PAY' | 'PARTIALLY_CLOSED' | 'BLOCKED';
  preflightReadiness: AttendanceCloseReadiness;
  dailyResults: Array<{
    workDate: string;
    success: boolean;
    finalized: boolean;
    alreadyLocked: boolean;
    lockedRows: number;
    blockedRows: unknown[];
    blockedCorrections: unknown[];
    payrollInputCommandCount: number;
  }>;
  payrollInputCommandCount: number;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function hours(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function statusVariant(status: AttendanceStatus) {
  if (['ABSENT', 'GEOFENCE_VIOLATION', 'MISSING_CHECKOUT'].includes(status)) return 'destructive' as const;
  if (['LATE', 'UNDERTIME', 'OVERTIME', 'ON_DUTY', 'LOW_TRUST', 'LEAVE_CLOCK_EVENT_CONFLICT'].includes(status)) return 'secondary' as const;
  if (status === 'ON_LEAVE') return 'outline' as const;
  return status === 'OUT' || status === 'PRESENT' ? 'default' as const : 'outline' as const;
}

function severityVariant(severity: AttendanceLedgerException['severity']) {
  if (severity === 'HIGH') return 'destructive' as const;
  if (severity === 'MEDIUM') return 'secondary' as const;
  return 'outline' as const;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadLedgerCsv(rows: AttendanceLedgerRow[], date: string) {
  const headers = [
    'workDate',
    'employeeId',
    'name',
    'email',
    'department',
    'status',
    'firstCheckIn',
    'latestCheckOut',
    'workedMinutes',
    'payableMinutes',
    'deductionMinutes',
    'overtimeMinutes',
    'readyForPayroll',
    'exceptions',
  ];
  const lines = rows.map((row) => [
    row.workDate,
    row.worker.employeeId,
    row.worker.name,
    row.worker.email,
    row.worker.departmentName ?? '',
    row.status,
    row.firstCheckInAt ?? '',
    row.latestCheckOutAt ?? '',
    row.payrollInput.workedMinutes,
    row.payrollInput.payableMinutes,
    row.payrollInput.deductionMinutes,
    row.payrollInput.overtimeMinutes,
    row.payrollInput.readyForPayroll ? 'YES' : 'NO',
    row.exceptions.map((exception) => exception.code).join('|'),
  ]);
  const csv = [headers, ...lines]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `attendance-ledger-${date}.csv`);
}

async function downloadGeolocationEvidenceCsv(date: string) {
  const response = await apiClient.get<Blob>(
    `/time/attendance/daily-ledger/geolocation-evidence.csv?date=${encodeURIComponent(date)}`,
    { responseType: 'blob' },
  );
  downloadBlob(response.data, `attendance-geolocation-evidence-${date}.csv`);
}

async function downloadPeriodCloseEvidenceCsv(query: string, label: string) {
  const response = await apiClient.get<Blob>(
    `/time/attendance/period-close/evidence.csv?${query}`,
    { responseType: 'blob' },
  );
  downloadBlob(response.data, `attendance-period-close-evidence-${label}.csv`);
}

const attendanceTabs = [
  { value: 'daily', label: 'Daily Ledger' },
  { value: 'readiness', label: 'Close Readiness' },
  { value: 'corrections', label: 'Corrections' },
  { value: 'reminders', label: 'Reminders' },
  { value: 'reports', label: 'Reports' },
  { value: 'policies', label: 'Policies' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'handoff', label: 'Payroll Handoff' },
] as const;

type AttendanceTab = typeof attendanceTabs[number]['value'];

export function AdminAttendance() {
  const now = new Date();
  const [date, setDate] = React.useState(todayKey);
  const [payrollCycleId, setPayrollCycleId] = React.useState('');
  const [periodYear, setPeriodYear] = React.useState(String(now.getFullYear()));
  const [periodMonth, setPeriodMonth] = React.useState(String(now.getMonth() + 1));
  const [workplaceCode, setWorkplaceCode] = React.useState('ALL');
  const [activeTab, setActiveTab] = React.useState<AttendanceTab>('daily');
  const [periodCloseResult, setPeriodCloseResult] = React.useState<AttendancePeriodCloseResult | null>(null);
  const [geoExportError, setGeoExportError] = React.useState('');
  const [holidayDraft, setHolidayDraft] = React.useState<AttendanceHolidayRule>({
    date: todayKey(),
    name: '',
    countryCode: 'EG',
    locationCodes: [],
    paid: true,
  });
  const ledgerUrl = `/time/attendance/daily-ledger?date=${encodeURIComponent(date)}`;
  const periodQuery = `year=${periodYear}&month=${periodMonth}${workplaceCode !== 'ALL' ? `&workplaceCode=${encodeURIComponent(workplaceCode)}` : ''}`;
  const { data: ledger, isLoading, refetch } = useApiQuery<AttendanceLedger>(['attendance-ledger', date], ledgerUrl);
  const { data: setup = { locations: [] } } = useApiQuery<HcmSetupConfig>(['hcm-setup'], '/admin/hcm-setup');
  const { data: reminders } = useApiQuery<AttendanceReminderResponse>(
    ['attendance-reminders', date, workplaceCode],
    `/time/attendance/reminders?date=${encodeURIComponent(date)}${workplaceCode !== 'ALL' ? `&workplaceCode=${encodeURIComponent(workplaceCode)}` : ''}`,
  );
  const { data: report } = useApiQuery<AttendancePeriodReport>(
    ['attendance-report-summary', periodYear, periodMonth, workplaceCode],
    `/time/attendance/reports/summary?${periodQuery}`,
  );
  const { data: periodReadiness, isLoading: periodReadinessLoading, refetch: refetchPeriodReadiness } = useApiQuery<AttendancePeriodCloseReadinessResponse>(
    ['attendance-period-close-readiness', periodYear, periodMonth, workplaceCode],
    `/time/attendance/period-close/readiness?${periodQuery}`,
  );
  const { data: correctionRequests = [], refetch: refetchCorrections } = useApiQuery<AttendanceCorrectionRequest[]>(
    ['attendance-corrections', date],
    `/time/attendance/correction-requests?date=${encodeURIComponent(date)}`,
  );
  const [finalizeMessage, setFinalizeMessage] = React.useState('');
  const exceptionMutation = useApiMutation<unknown, { id: string; action: 'review' | 'resolve' | 'escalate' }>(
    (variables) => `/time/attendance/attendance-exceptions/${variables.id}/commands/${variables.action}`,
    'post',
    [['attendance-ledger', date]],
  );
  const finalizeMutation = useApiMutation<FinalizeDailyLedgerResponse, { date: string; payrollCycleId?: string }>(
    '/time/attendance/daily-ledger/finalize',
    'post',
    [['attendance-ledger', date]],
    {
      onSuccess: (result) => {
        if (result.alreadyLocked) {
          setFinalizeMessage(`Ledger already locked for ${result.workDate}.`);
        } else if (result.finalized) {
          setFinalizeMessage(`Ledger locked for ${result.workDate}: ${result.lockedRows ?? 0} rows ready for payroll handoff.`);
        } else if (result.blockedCorrections && result.blockedCorrections.length > 0) {
          setFinalizeMessage(`Cannot lock yet: ${result.blockedCorrections.length} correction request(s) still need approval or application.`);
        } else {
          setFinalizeMessage(`Cannot lock yet: ${result.blockedRows?.length ?? 0} employee rows still need correction.`);
        }
      },
    },
  );
  const periodCloseMutation = useApiMutation<AttendancePeriodCloseResult, {
    year: number;
    month: number;
    workplaceCode?: string;
    payrollCycleId?: string;
  }>(
    '/time/attendance/period-close/finalize',
    'post',
    [['attendance-period-close-readiness', periodYear, periodMonth, workplaceCode], ['attendance-ledger', date]],
    {
      onSuccess: (result) => {
        setPeriodCloseResult(result);
        void refetchPeriodReadiness();
      },
    },
  );
  const applyCorrectionMutation = useApiMutation<AttendanceCorrectionRequest, { id: string }>(
    (variables) => `/time/attendance/correction-requests/${variables.id}/commands/apply`,
    'post',
    [['attendance-ledger', date], ['attendance-corrections', date]],
    { onSuccess: () => refetchCorrections() },
  );
  const setupMutation = useApiMutation<HcmSetupConfig, Partial<HcmSetupConfig>>(
    '/admin/hcm-setup',
    'patch',
    [['hcm-setup'], ['attendance-ledger', date], ['attendance-period-close-readiness', periodYear, periodMonth, workplaceCode]],
  );

  const rows = ledger?.rows ?? [];
  const exceptionQueue = ledger?.exceptionQueue ?? [];
  const blockedRows = rows.filter((row) => !row.payrollInput.readyForPayroll).length;
  const lockedRows = ledger?.lockedSnapshots?.filter((snapshot) => snapshot.locked).length ?? 0;
  const isLocked = Boolean(ledger?.locked);
  const approvedCorrections = correctionRequests.filter((request) => request.status === 'APPROVED');
  const period = periodCloseResult?.readiness ?? periodReadiness?.readiness;
  const locations = setup.locations ?? [];
  const holidayCalendars = setup.attendancePolicy?.holidayCalendars ?? [];
  const periodLabel = `${periodYear}-${periodMonth.padStart(2, '0')}${workplaceCode !== 'ALL' ? `-${workplaceCode}` : ''}`;

  const closePeriod = async () => {
    const result = await periodCloseMutation.mutateAsync({
      year: Number(periodYear),
      month: Number(periodMonth),
      workplaceCode: workplaceCode !== 'ALL' ? workplaceCode : undefined,
      payrollCycleId: payrollCycleId.trim() || undefined,
    });
    setPeriodCloseResult(result);
  };

  const saveHolidays = (holidayCalendarsNext: AttendanceHolidayRule[]) => {
    setupMutation.mutate({
      attendancePolicy: {
        ...(setup.attendancePolicy ?? {}),
        holidayCalendars: holidayCalendarsNext,
      },
    });
  };

  const addHoliday = () => {
    if (!holidayDraft.name.trim() || !holidayDraft.date) return;
    saveHolidays([...holidayCalendars, {
      ...holidayDraft,
      name: holidayDraft.name.trim(),
      locationCodes: holidayDraft.locationCodes?.filter(Boolean),
    }]);
    setHolidayDraft({ date: todayKey(), name: '', countryCode: holidayDraft.countryCode, locationCodes: [], paid: true });
  };

  const columns = React.useMemo<DataTableColumn<AttendanceLedgerRow>[]>(() => [
    {
      key: 'employee',
      header: 'Employee',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.worker.name}</p>
          <p className="text-xs text-muted-foreground">{row.worker.employeeId} - {row.worker.email}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <div className="space-y-1">
          <Badge variant={statusVariant(row.status)}>{row.status.replace(/_/g, ' ')}</Badge>
          {row.holidayName ? <p className="text-xs text-muted-foreground">{row.holidayName}</p> : null}
        </div>
      ),
    },
    {
      key: 'clock',
      header: 'Clock Evidence',
      cell: (row) => (
        <div className="text-xs">
          <p>In {formatTime(row.firstCheckInAt)}</p>
          <p className="text-muted-foreground">Out {formatTime(row.latestCheckOutAt)}</p>
        </div>
      ),
    },
    {
      key: 'minutes',
      header: 'Payroll Minutes',
      cell: (row) => (
        <div className="text-xs">
          <p>{hours(row.payrollInput.payableMinutes)} payable</p>
          <p className="text-muted-foreground">{hours(row.payrollInput.deductionMinutes)} deduction</p>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      cell: (row) => (
        <div className="flex items-center gap-2 text-xs">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span>{row.locationStatus.replace(/_/g, ' ')}</span>
        </div>
      ),
    },
    {
      key: 'exceptions',
      header: 'Exceptions',
      cell: (row) => row.exceptions.length > 0 ? (
        <div className="flex max-w-xs flex-wrap gap-1">
          {row.exceptions.map((exception) => (
            <Badge key={`${row.worker.workerId}-${exception.code}-${exception.exceptionId ?? exception.source}`} variant={severityVariant(exception.severity)}>
              {exception.code.replace(/_/g, ' ')}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">None</span>
      ),
    },
    {
      key: 'payroll',
      header: 'Payroll',
      cell: (row) => (
        <Badge variant={row.payrollInput.readyForPayroll ? 'default' : 'destructive'}>
          {row.payrollInput.readyForPayroll ? 'Ready' : 'Blocked'}
        </Badge>
      ),
    },
  ], []);

  const tabClass = (tab: AttendanceTab) => activeTab === tab ? 'space-y-6' : 'hidden';

  return (
    <div className="-m-4 min-h-[calc(100vh-7rem)] bg-background px-6 py-6">
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Clock3 className="h-6 w-6" />
            Attendance Control
          </h2>
          <p className="text-muted-foreground">Payroll-grade attendance closure, evidence, exceptions, and daily ledger control.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="attendance-date">Work date</Label>
            <Input id="attendance-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="grid min-w-[260px] gap-2">
            <Label htmlFor="attendance-payroll-cycle">Payroll cycle ID</Label>
            <Input id="attendance-payroll-cycle" value={payrollCycleId} onChange={(event) => setPayrollCycleId(event.target.value)} placeholder="Optional payroll handoff" />
          </div>
          <Button variant="outline" onClick={() => {
            void refetch();
            void refetchPeriodReadiness();
          }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <section className="grid gap-4 border-b py-6 md:grid-cols-2 xl:grid-cols-6">
        <div>
          <p className="text-xs text-muted-foreground">Employees</p>
          <p className="text-2xl font-semibold">{ledger?.summary.totalEmployees ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Present / Out</p>
          <p className="text-2xl font-semibold">{ledger?.summary.present ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Absent</p>
          <p className="text-2xl font-semibold">{ledger?.summary.absent ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">On Leave</p>
          <p className="text-2xl font-semibold">{ledger?.summary.onLeave ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Exceptions</p>
          <p className="text-2xl font-semibold">{ledger?.summary.exceptions ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Period Blockers</p>
          <p className={period?.blockingIssueCount ? 'text-2xl font-semibold text-amber-600' : 'text-2xl font-semibold'}>{period?.blockingIssueCount ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Locked Rows</p>
          <p className="text-2xl font-semibold">{lockedRows}</p>
        </div>
      </section>

      {finalizeMessage ? (
        <div className="mt-4 flex items-center gap-2 rounded-md border bg-muted/30 px-4 py-3 text-sm">
          {blockedRows === 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
          <span>{finalizeMessage}</span>
        </div>
      ) : null}

      {geoExportError ? (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>{geoExportError}</span>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AttendanceTab)} className="py-5">
        <TabsList className="h-auto flex-wrap justify-start bg-transparent p-0">
          {attendanceTabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-[#0b7cff] data-[state=active]:bg-transparent data-[state=active]:text-[#0b7cff]"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <section className={tabClass('daily')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Daily ledger</p>
            <p className="text-xs text-muted-foreground">Calculated from clock events, schedules, geofence policy, holidays, and approved exceptions.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => finalizeMutation.mutate({ date, payrollCycleId: payrollCycleId.trim() || undefined })}
              disabled={isLocked || rows.length === 0 || finalizeMutation.isPending}
            >
              <LockKeyhole className="mr-2 h-4 w-4" />
              Finalize Day
            </Button>
            <Button variant="outline" onClick={() => downloadLedgerCsv(rows, ledger?.workDate ?? date)}>
              <Download className="mr-2 h-4 w-4" />
              Export Ledger CSV
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daily Attendance Ledger</CardTitle>
            <CardDescription>Rows must be ready before they can become locked payroll inputs.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={rows}
              keyExtractor={(row) => `${row.workDate}-${row.worker.workerId}`}
              isLoading={isLoading}
              emptyMessage="No attendance ledger rows found"
            />
          </CardContent>
        </Card>
      </section>

      <section className={tabClass('readiness')}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Close Readiness</CardTitle>
            <CardDescription>Checks calendar-day coverage, locked ledgers, payroll readiness, and unresolved corrections before payroll close.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="grid gap-2">
                <Label>Year</Label>
                <Input value={periodYear} onChange={(event) => setPeriodYear(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Month</Label>
                <Select value={periodMonth} onValueChange={setPeriodMonth}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, index) => (
                      <SelectItem key={index + 1} value={String(index + 1)}>{new Date(2026, index, 1).toLocaleString(undefined, { month: 'long' })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label>Workplace</Label>
                <Select value={workplaceCode} onValueChange={setWorkplaceCode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All workplaces</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.code} value={location.code}>{location.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-5">
              <div>
                <p className="text-xs text-muted-foreground">Expected Rows</p>
                <p className="text-xl font-semibold">{period?.totalExpectedRows ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Locked</p>
                <p className="text-xl font-semibold">{period?.lockedRows ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ready</p>
                <p className="text-xl font-semibold">{period?.readyRows ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Blockers</p>
                <p className={period?.blockingIssueCount ? 'text-xl font-semibold text-amber-600' : 'text-xl font-semibold'}>{period?.blockingIssueCount ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant={period?.canClose ? 'default' : 'destructive'}>{period?.canClose ? 'Ready to close' : periodReadinessLoading ? 'Checking' : 'Blocked'}</Badge>
              </div>
            </div>

            <div className="space-y-2">
              {(period?.issues ?? []).length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No period readiness blockers found.</div>
              ) : period?.issues.slice(0, 30).map((issue) => (
                <div key={`${issue.code}-${issue.workerId}-${issue.workDate}-${issue.correctionRequestId ?? ''}`} className="grid gap-2 rounded-md border p-3 md:grid-cols-[10rem_12rem_1fr_auto]">
                  <Badge variant={issue.blocking ? 'destructive' : 'secondary'}>{issue.code.replace(/_/g, ' ')}</Badge>
                  <span className="text-sm">{issue.employeeId ?? issue.workerId}</span>
                  <span className="text-sm text-muted-foreground">{issue.message}</span>
                  <span className="text-xs text-muted-foreground">{issue.workDate}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className={tabClass('corrections')}>
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileWarning className="h-5 w-5" />
                Exception Queue
              </CardTitle>
              <CardDescription>Items that need HR, manager, or payroll review before salary calculation locks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {exceptionQueue.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No open attendance exceptions for this date.</div>
              ) : exceptionQueue.map((item) => (
                <div key={`${item.workerId}-${item.code}-${item.exceptionId ?? item.source}`} className="space-y-3 rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.workerName}</p>
                      <p className="text-xs text-muted-foreground">{item.employeeId} - {item.code.replace(/_/g, ' ')}</p>
                    </div>
                    <Badge variant={severityVariant(item.severity)}>{item.severity}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{hours(item.payrollImpactMinutes)} payroll impact</span>
                  </div>
                  {item.exceptionId ? (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => exceptionMutation.mutate({ id: item.exceptionId as string, action: 'review' })} disabled={exceptionMutation.isPending}>Review</Button>
                      <Button size="sm" onClick={() => exceptionMutation.mutate({ id: item.exceptionId as string, action: 'resolve' })} disabled={exceptionMutation.isPending}>Resolve</Button>
                      <Button variant="ghost" size="sm" onClick={() => exceptionMutation.mutate({ id: item.exceptionId as string, action: 'escalate' })} disabled={exceptionMutation.isPending}>Escalate</Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Calculated exception. Correct the source clock event or create an approved exception to clear it.</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PlayCircle className="h-5 w-5" />
                Correction Application
              </CardTitle>
              <CardDescription>Approved attendance corrections are applied before final ledger locking.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {correctionRequests.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No correction requests for this work date.</div>
              ) : correctionRequests.map((request) => (
                <div key={request.id} className="space-y-3 rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{request.correctionType.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">{request.requestedEventType?.replace(/_/g, ' ') ?? 'Event correction'} at {formatTime(request.requestedTimestamp)}</p>
                    </div>
                    <Badge variant={request.status === 'APPROVED' ? 'secondary' : request.status === 'APPLIED' ? 'default' : request.status === 'REJECTED' ? 'destructive' : 'outline'}>{request.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{request.reason}</p>
                  {request.status === 'APPROVED' ? (
                    <Button size="sm" onClick={() => applyCorrectionMutation.mutate({ id: request.id })} disabled={applyCorrectionMutation.isPending || isLocked}>
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Apply to Ledger
                    </Button>
                  ) : request.status === 'APPLIED' ? (
                    <p className="flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" />Applied {request.appliedAt ? new Date(request.appliedAt).toLocaleString() : ''}</p>
                  ) : (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground"><XCircle className="h-4 w-4" />Waiting for manager approval or closed.</p>
                  )}
                </div>
              ))}
              {approvedCorrections.length > 0 && isLocked ? (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">Unlock/reopen policy is required before applying approved corrections to a locked day.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className={tabClass('reminders')}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BellRing className="h-5 w-5" />
              Attendance Reminders
            </CardTitle>
            <CardDescription>Late check-in and missing check-out reminders are calculated from live schedule, leave, holiday, and clock state.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(reminders?.reminders ?? []).length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No attendance reminders for this date.</div>
            ) : reminders?.reminders.map((reminder) => (
              <div key={`${reminder.type}-${reminder.workerId}-${reminder.workDate}`} className="grid gap-3 rounded-md border p-4 md:grid-cols-[12rem_1fr_auto]">
                <Badge variant={reminder.severity === 'CRITICAL' ? 'destructive' : 'secondary'}>{reminder.type.replace(/_/g, ' ')}</Badge>
                <div>
                  <p className="font-medium">{reminder.workerName}</p>
                  <p className="text-sm text-muted-foreground">{reminder.employeeId} - {reminder.message}</p>
                </div>
                <p className="text-sm text-muted-foreground">{reminder.minutesLate} min after {reminder.scheduledTime}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className={tabClass('reports')}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Attendance Reporting</CardTitle>
            <CardDescription>Period rollups for attendance, leave, deductions, overtime, exceptions, and payroll readiness.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Employee Days</p>
                <p className="text-xl font-semibold">{report?.totals.employeeDays ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Present</p>
                <p className="text-xl font-semibold">{report?.totals.present ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">On Leave</p>
                <p className="text-xl font-semibold">{report?.totals.onLeave ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Exceptions</p>
                <p className="text-xl font-semibold">{report?.totals.exceptions ?? 0}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void apiClient.get<Blob>(`/time/attendance/reports/summary.csv?${periodQuery}`, { responseType: 'blob' })
                    .then((response) => downloadBlob(response.data, `attendance-summary-${periodLabel}.csv`));
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Summary CSV
              </Button>
            </div>
            <div className="space-y-2">
              {(report?.departments ?? []).length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No report data for this period.</div>
              ) : report?.departments.map((department) => (
                <div key={department.departmentName} className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_repeat(5,7rem)]">
                  <span className="font-medium">{department.departmentName}</span>
                  <span className="text-sm text-muted-foreground">{department.employeeDays} days</span>
                  <span className="text-sm text-muted-foreground">{department.present} present</span>
                  <span className="text-sm text-muted-foreground">{department.onLeave} leave</span>
                  <span className="text-sm text-muted-foreground">{department.payableHours} paid h</span>
                  <span className="text-sm text-muted-foreground">{department.deductionHours} deduct h</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className={tabClass('policies')}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5" />
              Public Holiday Calendar
            </CardTitle>
            <CardDescription>Annual public holidays can be scoped globally, by country, or to specific workplaces.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 lg:grid-cols-[10rem_1fr_8rem_14rem_8rem_auto]">
              <div className="grid gap-2">
                <Label>Date</Label>
                <Input type="date" value={holidayDraft.date} onChange={(event) => setHolidayDraft((current) => ({ ...current, date: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={holidayDraft.name} onChange={(event) => setHolidayDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Holiday name" />
              </div>
              <div className="grid gap-2">
                <Label>Country</Label>
                <Input value={holidayDraft.countryCode ?? ''} onChange={(event) => setHolidayDraft((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))} placeholder="EG" />
              </div>
              <div className="grid gap-2">
                <Label>Workplaces</Label>
                <Input
                  value={holidayDraft.locationCodes?.join(',') ?? ''}
                  onChange={(event) => setHolidayDraft((current) => ({ ...current, locationCodes: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))}
                  placeholder="CAIRO_HQ,ALEX_BRANCH"
                />
              </div>
              <div className="grid gap-2">
                <Label>Paid</Label>
                <Select value={holidayDraft.paid === false ? 'NO' : 'YES'} onValueChange={(value) => setHolidayDraft((current) => ({ ...current, paid: value === 'YES' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YES">Yes</SelectItem>
                    <SelectItem value="NO">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="self-end" onClick={addHoliday} disabled={setupMutation.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {holidayCalendars.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No public holidays configured.</div>
              ) : holidayCalendars
                .slice()
                .sort((left, right) => left.date.localeCompare(right.date))
                .map((holiday, index) => (
                  <div key={`${holiday.date}-${holiday.name}-${index}`} className="grid gap-3 rounded-md border p-3 md:grid-cols-[8rem_1fr_8rem_1fr_6rem_auto]">
                    <span className="text-sm font-medium">{holiday.date}</span>
                    <span className="text-sm">{holiday.name}</span>
                    <span className="text-sm text-muted-foreground">{holiday.countryCode ?? 'Global'}</span>
                    <span className="text-sm text-muted-foreground">{holiday.locationCodes?.join(', ') || 'All workplaces'}</span>
                    <Badge variant={holiday.paid === false ? 'secondary' : 'default'}>{holiday.paid === false ? 'Unpaid' : 'Paid'}</Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => saveHolidays(holidayCalendars.filter((candidate) => candidate !== holiday))}
                      disabled={setupMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className={tabClass('evidence')}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5" />
              Evidence & Governance
            </CardTitle>
            <CardDescription>Exports are classified and scoped for HR/payroll administrators.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => downloadLedgerCsv(rows, ledger?.workDate ?? date)}>
                <Download className="mr-2 h-4 w-4" />
                Daily Ledger CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setGeoExportError('');
                  void downloadGeolocationEvidenceCsv(ledger?.workDate ?? date).catch(() => {
                    setGeoExportError('Geolocation evidence export failed. Confirm you are signed in as HR or payroll admin.');
                  });
                }}
              >
                <MapPin className="mr-2 h-4 w-4" />
                Daily Geo Evidence
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setGeoExportError('');
                  void downloadPeriodCloseEvidenceCsv(periodQuery, periodLabel).catch(() => {
                    setGeoExportError('Period close evidence export failed. Confirm you are signed in as HR or payroll admin.');
                  });
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Period Close Evidence
              </Button>
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground">Salary visibility</p>
                <Badge variant="outline">Employee self / Payroll only</Badge>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground">Location evidence</p>
                <Badge variant="outline">Confidential</Badge>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground">Payroll lock</p>
                <Badge variant={period?.canClose ? 'default' : 'destructive'}>{period?.canClose ? 'Period ready' : 'Period blocked'}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className={tabClass('handoff')}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payroll Handoff</CardTitle>
            <CardDescription>Finalizes each calendar day in the selected period and creates payroll attendance inputs when a payroll cycle ID is supplied.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-2">
                <Label>Year</Label>
                <Input value={periodYear} onChange={(event) => setPeriodYear(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Month</Label>
                <Select value={periodMonth} onValueChange={setPeriodMonth}>
                  <SelectTrigger className="w-[12rem]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, index) => (
                      <SelectItem key={index + 1} value={String(index + 1)}>{new Date(2026, index, 1).toLocaleString(undefined, { month: 'long' })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid min-w-[14rem] gap-2">
                <Label>Workplace</Label>
                <Select value={workplaceCode} onValueChange={setWorkplaceCode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All workplaces</SelectItem>
                    {locations.map((location) => <SelectItem key={location.code} value={location.code}>{location.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => void closePeriod()} disabled={periodCloseMutation.isPending}>
                <LockKeyhole className="mr-2 h-4 w-4" />
                {periodCloseMutation.isPending ? 'Closing...' : 'Close Period'}
              </Button>
            </div>

            {periodCloseResult ? (
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={periodCloseResult.finalized ? 'default' : 'destructive'}>{periodCloseResult.status.replace(/_/g, ' ')}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Daily Results</p>
                  <p className="text-xl font-semibold">{periodCloseResult.dailyResults.filter((result) => result.finalized).length}/{periodCloseResult.dailyResults.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payroll Inputs</p>
                  <p className="text-xl font-semibold">{periodCloseResult.payrollInputCommandCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Remaining Blockers</p>
                  <p className={periodCloseResult.readiness.blockingIssueCount ? 'text-xl font-semibold text-amber-600' : 'text-xl font-semibold'}>{periodCloseResult.readiness.blockingIssueCount}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Run period close to lock attendance and hand off payroll inputs.</div>
            )}

            {periodCloseResult?.dailyResults.length ? (
              <div className="space-y-2">
                {periodCloseResult.dailyResults.map((result) => (
                  <div key={result.workDate} className="grid gap-2 rounded-md border p-3 md:grid-cols-[8rem_10rem_1fr]">
                    <span className="text-sm font-medium">{result.workDate}</span>
                    <Badge variant={result.finalized ? 'default' : 'destructive'}>{result.alreadyLocked ? 'Already locked' : result.finalized ? 'Finalized' : 'Blocked'}</Badge>
                    <span className="text-sm text-muted-foreground">{result.lockedRows} rows, {result.payrollInputCommandCount} payroll input command(s)</span>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
