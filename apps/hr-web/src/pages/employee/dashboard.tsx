import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_HCM_SETUP } from '@/lib/hcm-setup-defaults';
import { cn } from '@/lib/utils';
import {
  CalendarDays,
  Clock3,
  FileClock,
  MapPin,
  Send,
  Sun,
  Umbrella,
} from 'lucide-react';
import type { AbsenceRequest, HcmSetupConfig, Worker } from '@/types';

interface DashboardData {
  upcomingEvents: Array<{ id: string; title: string; date: string; type: string }>;
  pendingTasks: Array<{ id: string; title: string; dueDate: string; priority: string }>;
  recentActivity: Array<{ id: string; description: string; timestamp: string }>;
  absenceBalance: Array<{ type: string; balance: number; unit: string }>;
}

interface AttendanceSummaryResponse {
  workerId: string;
  summary: {
    payableMinutes: number;
    lateMinutes: number;
    undertimeMinutes: number;
    overtimeMinutes: number;
    geofenceViolations: number;
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
    status: string;
    deviceId?: string;
    location?: {
      latitude?: number;
      longitude?: number;
      accuracyMeters?: number;
      workplaceCode?: string;
      distanceMeters?: number;
      trustScore?: number;
      trustLevel?: string;
      deviceTrustLevel?: string;
      trustReasons?: string[];
    };
    locationStatus: AttendanceLocationStatus;
    trustScore?: number;
    trustLevel?: string;
    deviceTrustLevel?: string;
    trustReasons?: string[];
  }>;
}

interface ClockPayload {
  workerId: string;
  workplaceCode?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  deviceId?: string;
  timestamp?: string;
}

interface AttendanceCorrectionRequest {
  id: string;
  workDate: string;
  correctionType: 'ADD_CLOCK_EVENT' | 'EDIT_CLOCK_EVENT' | 'DELETE_CLOCK_EVENT';
  requestedEventType?: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';
  requestedTimestamp?: string;
  reason: string;
  status: 'PENDING_MANAGER_REVIEW' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'CANCELLED';
  requestedAt: string;
}

interface AttendanceCorrectionPayload {
  workerId: string;
  workDate: string;
  correctionType: 'ADD_CLOCK_EVENT';
  requestedEventType: 'CLOCK_IN' | 'CLOCK_OUT';
  requestedTimestamp: string;
  reason: string;
}

const activityTabs = [
  { label: 'Overview', path: '/employee' },
  { label: 'Attendance', path: '/employee#attendance' },
  { label: 'Leave', path: '/employee/time-off' },
  { label: 'Profile', path: '/employee/profile' },
  { label: 'Payslips', path: '/employee/payslip' },
  { label: 'Benefits', path: '/employee/benefits' },
];

const statusCopy: Record<AttendanceClockStatus, { label: string; tone: string; helper: string }> = {
  YET_TO_CHECK_IN: {
    label: 'Yet to check-in',
    tone: 'text-red-500',
    helper: 'Your shift is ready to start.',
  },
  IN: {
    label: 'In',
    tone: 'text-emerald-600',
    helper: 'Active attendance session is running.',
  },
  OUT: {
    label: 'Out',
    tone: 'text-slate-600',
    helper: 'Attendance session is closed.',
  },
  MISSING_CHECKOUT: {
    label: 'Missing check-out',
    tone: 'text-amber-600',
    helper: 'Submit a correction before starting a new session.',
  },
  OUTSIDE_GEOFENCE: {
    label: 'In - outside geofence',
    tone: 'text-amber-600',
    helper: 'Location evidence is outside the allowed workplace radius.',
  },
};

function getBrowserPosition(): Promise<Pick<ClockPayload, 'accuracyMeters' | 'latitude' | 'longitude'>> {
  if (!navigator.geolocation) return Promise.resolve({});
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: Math.round(position.coords.accuracy),
      }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 7000 },
    );
  });
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(Math.floor(totalSeconds), 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0'));
}

function formatMinutes(minutes: number | undefined) {
  const total = Math.max(minutes ?? 0, 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

function formatTime(value?: string) {
  if (!value) return '--';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: '2-digit' }).format(value);
}

function dateKey(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function currentWeekDays(today: Date) {
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function EmployeeDashboard() {
  const location = useLocation();
  const { user } = useAuth();
  const [tick, setTick] = React.useState(0);
  const [selectedWorkerId, setSelectedWorkerId] = React.useState('');
  const [workplaceCode, setWorkplaceCode] = React.useState(DEFAULT_HCM_SETUP.locations[0]?.code ?? '');
  const [onDutyReason, setOnDutyReason] = React.useState('');
  const [correctionDate, setCorrectionDate] = React.useState(dateKey);
  const [correctionTime, setCorrectionTime] = React.useState('');
  const [correctionEventType, setCorrectionEventType] = React.useState<'CLOCK_IN' | 'CLOCK_OUT'>('CLOCK_IN');
  const [correctionReason, setCorrectionReason] = React.useState('');
  const [clockMessage, setClockMessage] = React.useState('');
  const [clockError, setClockError] = React.useState('');

  const today = React.useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const roleNames = React.useMemo(() => new Set((user?.roles ?? []).map((role) => role.name)), [user?.roles]);
  const canSwitchAttendanceWorker = ['HR_ADMIN', 'PAYROLL_ADMIN', 'SUPER_ADMIN', 'MANAGER'].some((role) => roleNames.has(role));
  const workerLookupUrl = React.useMemo(() => {
    if (roleNames.has('HR_ADMIN') || roleNames.has('PAYROLL_ADMIN') || roleNames.has('SUPER_ADMIN')) {
      return '/hr/core/workers?status=ACTIVE&pageSize=100';
    }
    if (roleNames.has('MANAGER') && user?.id) {
      return `/hr/core/workers?manager=${encodeURIComponent(user.id)}&pageSize=100`;
    }
    if (user?.email) {
      return `/hr/core/workers?search=${encodeURIComponent(user.email)}&pageSize=1`;
    }
    return '/hr/core/workers?pageSize=0';
  }, [roleNames, user?.email, user?.id]);

  const data = React.useMemo<DashboardData>(() => ({
    upcomingEvents: [],
    pendingTasks: [],
    recentActivity: [],
    absenceBalance: [],
  }), []);
  const isLoading = false;
  const { data: setup = DEFAULT_HCM_SETUP } = useApiQuery<HcmSetupConfig>(['hcm-setup'], '/admin/hcm-setup');
  const { data: workers = [] } = useApiQuery<Worker[]>(['employee-clock-workers', workerLookupUrl], workerLookupUrl);

  React.useEffect(() => {
    if (workers[0] && (!selectedWorkerId || !workers.some((worker) => worker.id === selectedWorkerId))) {
      setSelectedWorkerId(workers[0].id);
    }
  }, [selectedWorkerId, workers]);

  React.useEffect(() => {
    if (setup.locations[0]?.code && workplaceCode === DEFAULT_HCM_SETUP.locations[0]?.code) {
      setWorkplaceCode(setup.locations[0].code);
    }
  }, [setup.locations, workplaceCode]);

  const activeWorker = workers.find((worker) => worker.id === selectedWorkerId);
  const activeWorkerName = activeWorker ? `${activeWorker.firstName} ${activeWorker.lastName}` : `${user?.firstName ?? 'Employee'} ${user?.lastName ?? ''}`.trim();
  const workplace = setup.locations.find((location) => location.code === workplaceCode);

  const attendanceStateKey = ['employee-attendance-state', selectedWorkerId];
  const { data: todayState, isLoading: attendanceLoading } = useApiQuery<AttendanceTodayState>(
    attendanceStateKey,
    `/time/attendance/workers/${selectedWorkerId}/today-state`,
    { enabled: Boolean(selectedWorkerId), refetchInterval: 30000 },
  );

  React.useEffect(() => {
    if (!todayState?.activeCheckInAt) {
      setTick(0);
      return undefined;
    }

    const interval = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [todayState?.activeCheckInAt]);

  const { data: attendanceSummary } = useApiQuery<AttendanceSummaryResponse>(
    ['employee-attendance-summary', selectedWorkerId, currentYear, currentMonth],
    `/time/attendance/workers/${selectedWorkerId}/monthly-summary?year=${currentYear}&month=${currentMonth}`,
    { enabled: Boolean(selectedWorkerId) },
  );
  const { data: correctionRequests = [] } = useApiQuery<AttendanceCorrectionRequest[]>(
    ['employee-attendance-corrections', selectedWorkerId],
    `/time/attendance/correction-requests?workerId=${selectedWorkerId}`,
    { enabled: Boolean(selectedWorkerId) },
  );

  const invalidateAttendanceKeys = [
    ['employee-attendance-state'],
    ['employee-attendance-summary'],
    ['employee-attendance-corrections'],
  ];
  const checkInMutation = useApiMutation<unknown, ClockPayload>('/time/attendance/check-in', 'post', invalidateAttendanceKeys);
  const checkOutMutation = useApiMutation<unknown, ClockPayload>('/time/attendance/check-out', 'post', invalidateAttendanceKeys);
  const onDutyMutation = useApiMutation<unknown, { workerId: string; startAt: string; endAt: string; reason: string; location?: string }>(
    '/time/attendance/on-duty-requests',
    'post',
    invalidateAttendanceKeys,
  );
  const correctionMutation = useApiMutation<unknown, AttendanceCorrectionPayload>(
    '/time/attendance/correction-requests',
    'post',
    invalidateAttendanceKeys,
  );

  const status = todayState?.status ?? 'YET_TO_CHECK_IN';
  const statusMeta = statusCopy[status];
  const activeSeconds = todayState?.activeCheckInAt
    ? Math.max(Math.floor((Date.now() - new Date(todayState.activeCheckInAt).getTime()) / 1000), 0)
    : Math.max((todayState?.elapsedMinutes ?? 0) * 60, 0);
  const [hours, minutes, seconds] = formatDuration(activeSeconds + tick * 0);
  const pendingAbsences = React.useMemo<AbsenceRequest[]>(() => [], []);

  const reportees = React.useMemo(() => {
    if (!canSwitchAttendanceWorker) return [];
    const directReports = workers.filter((worker) => worker.managerId === activeWorker?.id);
    return directReports.length > 0 ? directReports : workers.filter((worker) => worker.id !== selectedWorkerId).slice(0, 4);
  }, [activeWorker?.id, canSwitchAttendanceWorker, selectedWorkerId, workers]);

  const weekDays = React.useMemo(() => currentWeekDays(today), [today]);

  const buildClockPayload = async (): Promise<ClockPayload | null> => {
    if (!selectedWorkerId) return null;
    return {
      workerId: selectedWorkerId,
      workplaceCode,
      deviceId: 'browser',
      timestamp: new Date().toISOString(),
      ...(await getBrowserPosition()),
    };
  };

  const recordClock = async (direction: 'in' | 'out') => {
    const payload = await buildClockPayload();
    if (!payload) return;
    setClockError('');
    try {
      if (direction === 'in') {
        await checkInMutation.mutateAsync(payload);
        setClockMessage('Check-in recorded with timestamp and location evidence.');
      } else {
        await checkOutMutation.mutateAsync(payload);
        setClockMessage('Check-out recorded with timestamp and location evidence.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Attendance action failed.';
      setClockError(message);
    }
  };

  const submitOnDuty = async () => {
    if (!selectedWorkerId || !onDutyReason.trim()) return;
    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + setup.attendancePolicy.standardDailyMinutes * 60000);
    setClockError('');
    try {
      await onDutyMutation.mutateAsync({
        workerId: selectedWorkerId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        reason: onDutyReason.trim(),
        location: workplace?.label,
      });
      setOnDutyReason('');
      setClockMessage('On-duty request submitted for approval.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'On-duty request failed.';
      setClockError(message);
    }
  };

  const submitCorrection = async () => {
    if (!selectedWorkerId || !correctionDate || !correctionTime || !correctionReason.trim()) return;
    setClockError('');
    try {
      await correctionMutation.mutateAsync({
        workerId: selectedWorkerId,
        workDate: correctionDate,
        correctionType: 'ADD_CLOCK_EVENT',
        requestedEventType: correctionEventType,
        requestedTimestamp: new Date(`${correctionDate}T${correctionTime}:00`).toISOString(),
        reason: correctionReason.trim(),
      });
      setCorrectionReason('');
      setClockMessage('Attendance correction request sent to your manager.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Correction request failed.';
      setClockError(message);
    }
  };

  const timeline = todayState?.events ?? [];

  return (
    <div className="min-h-[calc(100vh-96px)] bg-[#e9eef5]">
      <div className="relative h-[140px] overflow-hidden bg-[#0f2f26]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(7,44,35,0.98),rgba(10,83,59,0.76)),repeating-linear-gradient(135deg,rgba(255,255,255,0.08)_0px,rgba(255,255,255,0.08)_1px,transparent_1px,transparent_18px)]" />
      </div>

      <div className="relative mx-auto grid max-w-[1740px] gap-3 px-4 pb-8 md:grid-cols-[280px_minmax(0,1fr)] lg:px-5">
        <aside className="-mt-8 space-y-3">
          <section className="rounded-md border border-[#ced8e4] bg-white p-5 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-[100px] w-[100px] rounded-xl border-2 border-white shadow-md">
                <AvatarImage src={activeWorker?.photoUrl} alt={activeWorkerName} />
                <AvatarFallback className="rounded-xl bg-[#d8e7ff] text-2xl font-bold text-[#17346c]">
                  {activeWorkerName.split(' ').map((part) => part.charAt(0)).slice(0, 2).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="mt-4 text-sm">
                <p className="text-slate-600">{activeWorker?.employeeId ?? 'EMPLOYEE'} - <span className="font-semibold text-slate-950">{activeWorkerName}</span></p>
                <p className="mt-1 text-slate-600">{activeWorker?.jobTitle ?? 'Employee'}</p>
                <p className={cn('mt-3 font-medium', statusMeta.tone)}>{statusMeta.label}</p>
              </div>

              <div className="mt-3 flex items-center gap-2 font-mono text-xl font-semibold text-slate-950">
                {[hours, minutes, seconds].map((part, index) => (
                  <React.Fragment key={`${part}-${index}`}>
                    {index > 0 ? <span className="text-slate-400">:</span> : null}
                    <span className="rounded-md bg-slate-100 px-2 py-1">{part}</span>
                  </React.Fragment>
                ))}
              </div>

              <Button
                className={cn(
                  'mt-3 w-[112px] border bg-white shadow-none',
                  todayState?.canCheckOut ? 'border-red-500 text-red-600 hover:bg-red-50' : 'border-emerald-500 text-emerald-700 hover:bg-emerald-50',
                )}
                variant="outline"
                onClick={() => recordClock(todayState?.canCheckOut ? 'out' : 'in')}
                disabled={!activeWorker || attendanceLoading || checkInMutation.isPending || checkOutMutation.isPending || (!todayState?.canCheckIn && !todayState?.canCheckOut)}
              >
                {todayState?.canCheckOut ? 'Check-out' : 'Check-in'}
              </Button>

              <p className="mt-3 text-xs leading-5 text-slate-500">{statusMeta.helper}</p>
            </div>
          </section>

          <section className="rounded-md border border-[#ced8e4] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Reportees</h2>
            <div className="mt-3 divide-y">
              {reportees.map((reportee) => (
                <div key={reportee.id} className="flex items-center gap-3 py-3">
                  <Avatar className="h-10 w-10 rounded-md">
                    <AvatarImage src={reportee.photoUrl} alt={`${reportee.firstName} ${reportee.lastName}`} />
                    <AvatarFallback className="rounded-md text-xs">{reportee.firstName.charAt(0)}{reportee.lastName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{reportee.employeeId} - {reportee.firstName} {reportee.lastName}</p>
                    <p className="text-xs text-orange-500">{reportee.status === 'ACTIVE' ? 'In' : 'Yet to check-in'}</p>
                  </div>
                </div>
              ))}
              {reportees.length === 0 ? <p className="py-4 text-sm text-slate-500">No reportees assigned.</p> : null}
            </div>
          </section>
        </aside>

        <section className="-mt-8 min-w-0">
          <div className="rounded-md border border-[#ced8e4] bg-white shadow-sm">
            <div className="flex h-[60px] items-center gap-4 overflow-x-auto border-b px-5">
              {activityTabs.map((tab) => {
                const [path, hash] = tab.path.split('#');
                const isActive = location.pathname === path && (!hash || location.hash === `#${hash}`);
                return (
                  <Link
                    key={tab.label}
                    to={tab.path}
                    className={cn(
                      'relative flex h-full shrink-0 items-center border-b-2 px-1 text-sm font-medium',
                      isActive ? 'border-[#0b8cff] text-slate-950' : 'border-transparent text-slate-700 hover:text-slate-950',
                    )}
                  >
                    {tab.label}
                    {tab.label === 'Leave' && pendingAbsences.length > 0 ? (
                      <span className="absolute right-[-12px] top-3 rounded-md bg-[#0b8cff] px-1.5 text-[10px] font-bold text-white">{pendingAbsences.length}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>

            <div className="max-h-[calc(100vh-178px)] overflow-y-auto bg-[#f7f9fc] p-5">
              <div className="space-y-3">
                <div className="flex items-center gap-4 rounded-md border border-[#d5e7f3] bg-[#effaff] p-4">
                  <div className="grid h-[62px] w-[100px] place-items-center rounded border bg-white text-lg font-bold text-[#0b60c8]">HCM</div>
                  <div>
                    <p className="font-semibold">Good Afternoon&nbsp; {activeWorkerName}</p>
                    <p className="text-sm text-slate-600">Have a productive day!</p>
                  </div>
                  <Sun className="ml-auto h-14 w-14 text-amber-300" />
                </div>

                <div className="grid gap-3 xl:grid-cols-[1fr_360px]">
                  <div className="space-y-3">
                    <FeedRow
                      icon={<Clock3 className="h-5 w-5 text-orange-500" />}
                      title={status === 'IN' || status === 'OUTSIDE_GEOFENCE' ? 'Active attendance session' : 'Check-in reminder'}
                      subtitle={status === 'IN' || status === 'OUTSIDE_GEOFENCE' ? `Started at ${formatTime(todayState?.activeCheckInAt)}` : 'Your shift has already started'}
                      rightTitle="Daily Shift"
                      rightSubtitle={`${setup.attendancePolicy.standardStartTime ?? setup.attendancePolicy.flexibleWindowStart ?? '09:00'} - ${setup.attendancePolicy.standardEndTime ?? setup.attendancePolicy.coreEndTime ?? '17:00'}`}
                    />

                    <div id="attendance" className="rounded-md border border-[#d7e1ec] bg-white p-5">
                      <div className="flex items-start gap-4">
                        <div className="grid h-11 w-11 place-items-center rounded-md bg-sky-50">
                          <CalendarDays className="h-5 w-5 text-sky-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h3 className="font-semibold">Work Schedule</h3>
                              <p className="text-sm text-slate-600">{weekDays[0]?.toLocaleDateString()} - {weekDays[6]?.toLocaleDateString()}</p>
                            </div>
                            <Badge variant="outline">{setup.attendancePolicy.flexibleHoursEnabled ? 'Flexible policy' : 'Fixed shift'}</Badge>
                          </div>

                          <div className="mt-5">
                            <div className="ml-1 h-10 rounded bg-[#fff86b] px-3 py-1 text-xs">
                              <p className="font-medium">Daily Shift</p>
                              <p>{setup.attendancePolicy.standardDailyMinutes / 60} working hours</p>
                            </div>
                            <div className="mt-3 grid grid-cols-7 border-t border-slate-200">
                              {weekDays.map((date) => {
                                const isToday = date.toDateString() === today.toDateString();
                                return (
                                  <div key={date.toISOString()} className="relative min-w-0 px-1 pt-3 text-xs">
                                    <span className={cn('absolute -top-1 left-0 h-2 w-2 rounded-full bg-slate-300', isToday && 'bg-[#0b8cff]')} />
                                    <p className="truncate text-slate-800">{formatDate(date)}</p>
                                    <p className={cn('mt-2 truncate', isToday ? 'font-semibold text-[#0b8cff]' : 'text-slate-500')}>
                                      {isToday ? 'Today' : date.getDay() === 5 || date.getDay() === 6 ? 'Weekend' : 'Scheduled'}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border border-[#d7e1ec] bg-white p-5">
                      <div className="flex items-start gap-4">
                        <div className="grid h-11 w-11 place-items-center rounded-md bg-emerald-50">
                          <MapPin className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="font-semibold">Attendance Evidence</h3>
                              <p className="text-sm text-slate-600">Timestamp, workplace, device, and geolocation captured for every punch.</p>
                            </div>
                            <Badge variant={todayState?.locationStatus === 'OUTSIDE_GEOFENCE' ? 'destructive' : 'secondary'}>
                              {todayState?.locationStatus?.replace(/_/g, ' ') ?? 'NO GEOLOCATION'}
                            </Badge>
                          </div>
                          <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                            <EvidenceMetric label="First check-in" value={formatTime(todayState?.firstCheckInAt)} />
                            <EvidenceMetric label="Latest check-out" value={formatTime(todayState?.latestCheckOutAt)} />
                            <EvidenceMetric label="Worked today" value={formatMinutes(todayState?.totalWorkedMinutes)} />
                            <EvidenceMetric label="Workplace" value={workplace ? `${workplace.flag} ${workplace.label}` : workplaceCode || '--'} />
                          </div>

                          <div className="mt-4 space-y-2">
                            {attendanceLoading ? <Skeleton className="h-16 w-full" /> : null}
                            {timeline.map((event) => (
                              <div key={event.id} className="grid gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs md:grid-cols-[130px_1fr_170px_150px]">
                                <p className="font-semibold">{event.eventType.replace('_', ' ')}</p>
                                <p className="text-slate-600">
                                  {new Date(event.timestamp).toLocaleString()} - {event.deviceId ?? 'unknown device'}
                                </p>
                                <p className={cn('font-medium', event.locationStatus === 'OUTSIDE_GEOFENCE' ? 'text-amber-600' : 'text-emerald-600')}>
                                  {event.location?.distanceMeters !== undefined ? `${event.location.distanceMeters}m from workplace` : event.locationStatus.replace(/_/g, ' ')}
                                </p>
                                <p className={cn('font-medium', (event.trustScore ?? event.location?.trustScore ?? 100) < 70 ? 'text-amber-600' : 'text-slate-600')}>
                                  Trust {event.trustScore ?? event.location?.trustScore ?? '-'} {event.deviceTrustLevel ?? event.location?.deviceTrustLevel ?? ''}
                                </p>
                              </div>
                            ))}
                            {!attendanceLoading && timeline.length === 0 ? (
                              <p className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No attendance events recorded today.</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border border-[#d7e1ec] bg-white p-5">
                      <div className="flex items-start gap-4">
                        <div className="grid h-11 w-11 place-items-center rounded-md bg-blue-50">
                          <Umbrella className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="font-semibold">Upcoming Holidays</h3>
                              <p className="text-sm text-slate-600">Calendar items from your employee workspace.</p>
                            </div>
                            <Link className="text-sm font-medium text-[#0b8cff]" to="/employee/time-off">View all</Link>
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            {(data?.upcomingEvents ?? []).slice(0, 3).map((event) => (
                              <div key={event.id} className="rounded border border-sky-200 px-3 py-2 text-sm">
                                <p className="font-medium">{event.title}</p>
                                <p className="text-xs text-slate-500">{event.date} - {event.type}</p>
                              </div>
                            ))}
                            {!isLoading && (!data?.upcomingEvents || data.upcomingEvents.length === 0) ? (
                              <div className="rounded border border-sky-200 px-3 py-2 text-sm">No holidays scheduled</div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <aside className="space-y-3">
                    <div className="rounded-md border border-[#d7e1ec] bg-white p-4">
                      <h3 className="font-semibold">Attendance Terminal</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {canSwitchAttendanceWorker ? 'Select the authorized employee and workplace before recording a punch.' : 'Record your own attendance with workplace and location evidence.'}
                      </p>
                      <div className="mt-4 space-y-3">
                        {canSwitchAttendanceWorker ? (
                          <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
                            <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                            <SelectContent>
                              {workers.map((worker) => (
                                <SelectItem key={worker.id} value={worker.id}>
                                  {worker.firstName} {worker.lastName} - {worker.employeeId}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-sm font-medium">{activeWorkerName || 'Linked employee profile required'}</p>
                            <p className="text-xs text-slate-500">{activeWorker?.employeeId ?? user?.email ?? 'No employee profile linked'}</p>
                          </div>
                        )}
                        <Select value={workplaceCode} onValueChange={setWorkplaceCode}>
                          <SelectTrigger><SelectValue placeholder="Select workplace" /></SelectTrigger>
                          <SelectContent>
                            {setup.locations.filter((location) => location.active).map((location) => (
                              <SelectItem key={location.code} value={location.code}>{location.flag} {location.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="grid grid-cols-2 gap-2">
                          <Button onClick={() => recordClock('in')} disabled={!todayState?.canCheckIn || checkInMutation.isPending}>Check-in</Button>
                          <Button variant="outline" onClick={() => recordClock('out')} disabled={!todayState?.canCheckOut || checkOutMutation.isPending}>Check-out</Button>
                        </div>
                      </div>
                      {clockMessage ? <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{clockMessage}</p> : null}
                      {clockError ? <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{clockError}</p> : null}
                    </div>

                    <div className="rounded-md border border-[#d7e1ec] bg-white p-4">
                      <h3 className="font-semibold">On-duty Request</h3>
                      <p className="mt-1 text-sm text-slate-600">Route field work or missing workplace attendance to approval.</p>
                      <div className="mt-4 space-y-3">
                        <Input value={onDutyReason} placeholder="Reason or client site" onChange={(event) => setOnDutyReason(event.target.value)} />
                        <Button className="w-full" variant="secondary" onClick={submitOnDuty} disabled={!onDutyReason.trim() || onDutyMutation.isPending}>
                          Submit On-duty
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-md border border-[#d7e1ec] bg-white p-4">
                      <div className="flex items-center gap-2">
                        <FileClock className="h-4 w-4 text-[#0b8cff]" />
                        <h3 className="font-semibold">Attendance Correction</h3>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">Request a missing or corrected punch with manager approval.</p>
                      <div className="mt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <Input type="date" value={correctionDate} onChange={(event) => setCorrectionDate(event.target.value)} />
                          <Input type="time" value={correctionTime} onChange={(event) => setCorrectionTime(event.target.value)} />
                        </div>
                        <Select value={correctionEventType} onValueChange={(value) => setCorrectionEventType(value as 'CLOCK_IN' | 'CLOCK_OUT')}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CLOCK_IN">Missing check-in</SelectItem>
                            <SelectItem value="CLOCK_OUT">Missing check-out</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input value={correctionReason} placeholder="Reason for correction" onChange={(event) => setCorrectionReason(event.target.value)} />
                        <Button
                          className="w-full"
                          variant="secondary"
                          onClick={submitCorrection}
                          disabled={!correctionReason.trim() || !correctionTime || correctionMutation.isPending}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Send Correction
                        </Button>
                      </div>
                      <div className="mt-4 space-y-2">
                        {correctionRequests.slice(0, 3).map((request) => (
                          <div key={request.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{request.requestedEventType?.replace('_', ' ') ?? 'Correction'}</span>
                              <Badge variant={request.status === 'APPLIED' ? 'default' : request.status === 'REJECTED' ? 'destructive' : 'outline'}>
                                {request.status.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <p className="mt-1 truncate text-slate-500">{request.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-md border border-[#d7e1ec] bg-white p-4">
                      <h3 className="font-semibold">This Month</h3>
                      <div className="mt-4 grid gap-3 text-sm">
                        <EvidenceMetric label="Payable" value={formatMinutes(attendanceSummary?.summary.payableMinutes)} />
                        <EvidenceMetric label="Late" value={`${attendanceSummary?.summary.lateMinutes ?? 0} min`} />
                        <EvidenceMetric label="Undertime" value={`${attendanceSummary?.summary.undertimeMinutes ?? 0} min`} />
                        <EvidenceMetric label="Overtime" value={`${attendanceSummary?.summary.overtimeMinutes ?? 0} min`} />
                        <EvidenceMetric label="Geofence flags" value={`${attendanceSummary?.summary.geofenceViolations ?? 0}`} />
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function FeedRow({
  icon,
  title,
  subtitle,
  rightTitle,
  rightSubtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  rightTitle?: string;
  rightSubtitle?: string;
}) {
  return (
    <div className="rounded-md border border-[#d7e1ec] bg-white p-5">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-orange-50">{icon}</div>
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-slate-600">{subtitle}</p>
        </div>
        {rightTitle ? (
          <div className="ml-auto min-w-[180px] text-sm">
            <p className="font-semibold">{rightTitle}</p>
            <p className="text-slate-600">{rightSubtitle}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 truncate font-semibold text-slate-950">{value}</p>
    </div>
  );
}
