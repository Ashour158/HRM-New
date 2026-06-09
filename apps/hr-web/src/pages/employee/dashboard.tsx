import * as React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { useUIStore } from '@/stores/ui-store';
import { apiClient } from '@/lib/api-client';
import {
  buildClockActionPath,
  buildGoogleMapsEmbedUrl,
  buildGoogleMapsSearchUrl,
  geolocationFailureMessage,
  hasCoordinateEvidence,
  sanitizeGeolocationCoordinates,
  type CoordinateEvidence,
  type GeolocationFailureReason,
} from '@/lib/attendance-location';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_HCM_SETUP } from '@/lib/hcm-setup-defaults';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock3,
  FileClock,
  FileText,
  Heart,
  LifeBuoy,
  LogIn,
  LogOut,
  MapPin,
  Quote,
  Send,
  TrendingUp,
  Umbrella,
  UserCircle,
  UserRoundCheck,
} from 'lucide-react';
import {
  Area,
  AreaChart as ReAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HcmSetupConfig, Worker } from '@/types';

const dailyQuotes = [
  "Great teams aren't built in a day - they're built every day.",
  'Small steps, taken daily, move mountains.',
  'Progress beats perfection. Ship the next good thing.',
  'Make today 1% better than yesterday.',
  'Momentum loves consistency. Keep showing up.',
  'Clarity is kindness - say the helpful thing.',
  'A calm mind builds a confident day.',
  'Your effort today is tomorrow gathering momentum.',
];

function getDailyQuote(seedSource: string): string {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  let seed = 0;
  for (let index = 0; index < seedSource.length; index += 1) seed += seedSource.charCodeAt(index);
  return dailyQuotes[(dayOfYear + seed) % dailyQuotes.length];
}

interface DashboardData {
  upcomingEvents: Array<{ id: string; title: string; date: string; type: string }>;
  pendingTasks: Array<{ id: string; title: string; dueDate: string; priority: string }>;
  recentActivity: Array<{ id: string; description: string; timestamp: string }>;
  absenceBalance: Array<{ type: string; balance: number; unit: string }>;
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
  captureMethod?: 'API_IMPORT' | 'BIOMETRIC_DEVICE' | 'FACIAL_RECOGNITION' | 'MANUAL_CORRECTION' | 'MOBILE_GEOFENCE' | 'QR_CODE' | 'RFID_CARD' | 'WEB_KIOSK';
  captureDeviceKind?: string;
  captureReference?: string;
  verificationStatus?: 'FAILED' | 'NOT_REQUIRED' | 'PENDING' | 'VERIFIED';
  captureEvidence?: Record<string, unknown>;
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

const selfServiceModules = [
  {
    label: 'Check-in / Check-out',
    path: '/employee#attendance',
    icon: Clock3,
    description: 'Record time with workplace, device, and location evidence.',
    group: 'Workforce',
  },
  {
    label: 'Apply for Leave',
    path: '/employee/time-off',
    icon: Umbrella,
    description: 'Submit leave requests against policy-driven balances.',
    group: 'Workforce',
  },
  {
    label: 'Payslips',
    path: '/employee/payslip',
    icon: FileText,
    description: 'View salary statements connected to payroll operations.',
    group: 'Payroll & Reward',
  },
  {
    label: 'Benefits',
    path: '/employee/benefits',
    icon: Heart,
    description: 'Review enrollment, coverage, and benefit elections.',
    group: 'Payroll & Reward',
  },
  {
    label: 'My Profile',
    path: '/employee/profile',
    icon: UserCircle,
    description: 'Keep personal, job, and organization details aligned.',
    group: 'People & Organization',
  },
  {
    label: 'Preboarding',
    path: '/employee/onboarding',
    icon: UserRoundCheck,
    description: 'Complete onboarding tasks, document evidence, IT access, and 30/60/90 readiness.',
    group: 'Talent',
  },
  {
    label: 'Goals',
    path: '/employee/performance',
    icon: TrendingUp,
    description: 'Track objectives and feedback in the talent module.',
    group: 'Talent',
  },
  {
    label: 'Ask HR / Services',
    path: '/employee/services',
    icon: LifeBuoy,
    description: 'Open service cases for HR letters, payroll questions, benefits, profile corrections, and access help.',
    group: 'Services & Support',
  },
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

const GEOLOCATION_CAPTURE_TIMEOUT_MS = 2500;
const attendanceRangeOptions: Array<{ value: AttendancePeriodRange; label: string }> = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'NINETY_DAYS', label: '90 days' },
];

interface GeolocationCapture {
  evidence: Pick<ClockPayload, 'accuracyMeters' | 'latitude' | 'longitude'>;
  failureReason?: GeolocationFailureReason;
}

function mapGeolocationError(error: GeolocationPositionError): GeolocationFailureReason {
  if (error.code === error.PERMISSION_DENIED) return 'permission_denied';
  if (error.code === error.POSITION_UNAVAILABLE) return 'position_unavailable';
  if (error.code === error.TIMEOUT) return 'timeout';
  return 'unknown';
}

function captureBrowserPosition(): Promise<GeolocationCapture> {
  if (!navigator.geolocation) return Promise.resolve({ evidence: {}, failureReason: 'unsupported' });
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId: number | undefined;

    const finish = (capture: GeolocationCapture) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      resolve(capture);
    };

    timeoutId = window.setTimeout(() => finish({ evidence: {}, failureReason: 'timeout' }), GEOLOCATION_CAPTURE_TIMEOUT_MS);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        finish({
          evidence: sanitizeGeolocationCoordinates({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }),
        });
      },
      (error) => finish({ evidence: {}, failureReason: mapGeolocationError(error) }),
      { enableHighAccuracy: true, timeout: GEOLOCATION_CAPTURE_TIMEOUT_MS },
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

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit' }).format(new Date(`${value}T00:00:00.000Z`));
}

function dateKey(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: unknown; status?: number } }).response;
    const data = response?.data;
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') {
      const record = data as { message?: unknown; errorMessage?: unknown; _errors?: unknown };
      if (typeof record.errorMessage === 'string') return record.errorMessage;
      if (typeof record.message === 'string') return record.message;
      if (Array.isArray(record.message)) return record.message.join(', ');
      return JSON.stringify(data);
    }
    if (response?.status) return `Request failed with status code ${response.status}`;
  }
  return error instanceof Error ? error.message : fallback;
}

function rangeLabel(range: AttendancePeriodRange) {
  return attendanceRangeOptions.find((option) => option.value === range)?.label ?? 'Weekly';
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
  const addNotification = useUIStore((s) => s.addNotification);
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
  const [clockPendingDirection, setClockPendingDirection] = React.useState<'in' | 'out' | null>(null);
  const [manualPunchDirection, setManualPunchDirection] = React.useState<'in' | 'out' | null>(null);
  const [manualPunchReason, setManualPunchReason] = React.useState('');
  const [attendanceRange, setAttendanceRange] = React.useState<AttendancePeriodRange>('WEEKLY');
  const [pendingClockCommand, setPendingClockCommand] = React.useState<'in' | 'out' | null>(() => {
    const stored = window.localStorage.getItem('pending-attendance-clock');
    return stored === 'in' || stored === 'out' ? stored : null;
  });

  const today = React.useMemo(() => new Date(), []);

  const data = React.useMemo<DashboardData>(() => ({
    upcomingEvents: [],
    pendingTasks: [],
    recentActivity: [],
    absenceBalance: [],
  }), []);
  const isLoading = false;
  const { data: setup = DEFAULT_HCM_SETUP } = useApiQuery<HcmSetupConfig>(['employee-attendance-setup'], '/employee/attendance-setup');
  const { data: activeWorker } = useApiQuery<Worker>(['employee-dashboard-profile'], '/employee/profile');

  React.useEffect(() => {
    if (activeWorker?.id && selectedWorkerId !== activeWorker.id) {
      setSelectedWorkerId(activeWorker.id);
    }
  }, [activeWorker?.id, selectedWorkerId]);

  React.useEffect(() => {
    if (setup.locations[0]?.code && workplaceCode === DEFAULT_HCM_SETUP.locations[0]?.code) {
      setWorkplaceCode(setup.locations[0].code);
    }
  }, [setup.locations, workplaceCode]);

  const activeWorkerName = activeWorker ? `${activeWorker.firstName} ${activeWorker.lastName}` : `${user?.firstName ?? 'Employee'} ${user?.lastName ?? ''}`.trim();
  const workplace = setup.locations.find((location) => location.code === workplaceCode);
  const geofenceProfile = setup.attendancePolicy.geofenceProfiles?.find((item) => item.active && item.locationCode === workplaceCode);
  const requiresGeolocation = Boolean(setup.attendancePolicy.geofenceEnabled && geofenceProfile?.requireGeolocation);

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

  const { data: attendancePeriodView } = useApiQuery<AttendancePeriodView>(
    ['employee-attendance-period-view', selectedWorkerId, attendanceRange, dateKey(today)],
    `/time/attendance/reports/period-view?scope=SELF&range=${attendanceRange}&date=${dateKey(today)}&workerId=${selectedWorkerId}`,
    { enabled: Boolean(selectedWorkerId) },
  );
  const { data: correctionRequests = [] } = useApiQuery<AttendanceCorrectionRequest[]>(
    ['employee-attendance-corrections', selectedWorkerId],
    `/time/attendance/correction-requests?workerId=${selectedWorkerId}`,
    { enabled: Boolean(selectedWorkerId) },
  );

  const invalidateAttendanceKeys = [
    ['employee-attendance-state'],
    ['employee-attendance-period-view'],
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

  const attendanceSeries = React.useMemo(() => {
    if (!attendancePeriodView?.series.length) {
      return [{ day: formatDate(today), hours: Math.max((todayState?.totalWorkedMinutes ?? 0) / 60, 0) }];
    }
    return attendancePeriodView.series.map((day) => ({
      day: formatDateLabel(day.workDate),
      hours: day.payableHours,
      overtime: day.overtimeHours,
      lateMinutes: day.lateMinutes,
    }));
  }, [attendancePeriodView?.series, today, todayState?.totalWorkedMinutes]);
  const attendanceSummary = React.useMemo(() => ({
    summary: {
      payableMinutes: Math.round((attendancePeriodView?.totals.payableHours ?? 0) * 60),
      lateMinutes: attendancePeriodView?.totals.lateMinutes ?? 0,
      undertimeMinutes: attendancePeriodView?.totals.undertimeMinutes ?? 0,
      overtimeMinutes: Math.round((attendancePeriodView?.totals.overtimeHours ?? 0) * 60),
      geofenceViolations: attendancePeriodView?.totals.geofenceViolations ?? 0,
    },
  }), [attendancePeriodView?.totals]);

  const dailyQuote = getDailyQuote(activeWorkerName || user?.email || 'employee');

  const buildClockPayload = async (): Promise<{ payload: ClockPayload; failureReason?: GeolocationFailureReason } | null> => {
    if (!selectedWorkerId) return null;
    const capture = await captureBrowserPosition();
    const hasLocation = hasCoordinateEvidence(capture.evidence);
    return {
      payload: {
        workerId: selectedWorkerId,
        workplaceCode,
        deviceId: 'browser',
        timestamp: new Date().toISOString(),
        captureMethod: hasLocation ? 'MOBILE_GEOFENCE' : 'WEB_KIOSK',
        captureDeviceKind: 'BROWSER',
        captureReference: `browser-${Date.now()}`,
        verificationStatus: hasLocation ? 'VERIFIED' : 'PENDING',
        captureEvidence: {
          geolocationCapture: {
            captured: hasLocation,
            failureReason: capture.failureReason,
            policyRequiresGeolocation: requiresGeolocation,
          },
        },
        ...capture.evidence,
      },
      failureReason: capture.failureReason,
    };
  };

  const recordClock = async (direction: 'in' | 'out') => {
    setClockError('');
    setClockMessage('Capturing attendance evidence...');
    setManualPunchDirection(null);
    setManualPunchReason('');
    setClockPendingDirection(direction);
    try {
      const capture = await buildClockPayload();
      if (!capture) {
        setClockMessage('');
        setClockError('No linked employee profile was found for attendance capture.');
        return;
      }
      if (requiresGeolocation && !hasCoordinateEvidence(capture.payload)) {
        const reason = geolocationFailureMessage(capture.failureReason ?? 'unknown');
        setClockMessage('');
        setClockError(`${reason} You can route this punch to manager review instead.`);
        setManualPunchDirection(direction);
        setManualPunchReason(reason);
        return;
      }
      if (direction === 'in') {
        await checkInMutation.mutateAsync(capture.payload);
        setClockMessage('Check-in recorded with timestamp and location evidence.');
        addNotification({
          title: 'Check-in recorded',
          message: 'Your check-in was captured with timestamp and location evidence.',
          type: 'success',
          read: false,
        });
      } else {
        await checkOutMutation.mutateAsync(capture.payload);
        setClockMessage('Check-out recorded with timestamp and location evidence.');
        addNotification({
          title: 'Check-out recorded',
          message: 'Your check-out was captured with timestamp and location evidence.',
          type: 'success',
          read: false,
        });
      }
    } catch (error) {
      const message = apiErrorMessage(error, 'Attendance action failed.');
      setClockMessage('');
      setClockError(message);
      if (requiresGeolocation && /geo|location|geofence/i.test(message)) {
        setManualPunchDirection(direction);
        setManualPunchReason(message);
      }
      addNotification({
        title: 'Attendance action failed',
        message,
        type: 'error',
        read: false,
      });
    } finally {
      setClockPendingDirection(null);
    }
  };

  const requestManualPunchReview = async () => {
    if (!selectedWorkerId || !manualPunchDirection) return;
    const now = new Date();
    setClockError('');
    try {
      await correctionMutation.mutateAsync({
        workerId: selectedWorkerId,
        workDate: now.toISOString().slice(0, 10),
        correctionType: 'ADD_CLOCK_EVENT',
        requestedEventType: manualPunchDirection === 'out' ? 'CLOCK_OUT' : 'CLOCK_IN',
        requestedTimestamp: now.toISOString(),
        reason: `${manualPunchDirection === 'out' ? 'Check-out' : 'Check-in'} requires manual review. ${manualPunchReason || 'Browser location evidence was not available.'}`,
      });
      setManualPunchDirection(null);
      setManualPunchReason('');
      setClockMessage('Manual punch review sent to your manager. Payroll updates only after approval.');
      addNotification({
        title: 'Manual punch review sent',
        message: 'Your attendance punch was routed for manager approval.',
        type: 'success',
        read: false,
      });
    } catch (error) {
      setClockError(apiErrorMessage(error, 'Could not submit manual punch review.'));
    }
  };

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryAction = params.get('clock');
    const hashAction = location.hash === '#clock-in' ? 'in' : location.hash === '#clock-out' ? 'out' : null;
    const action = queryAction === 'in' || queryAction === 'out' ? queryAction : hashAction;
    if (action !== 'in' && action !== 'out') return;
    window.localStorage.setItem('pending-attendance-clock', action);
    setPendingClockCommand(action);
    window.history.replaceState(null, '', `${location.pathname}#attendance`);
  }, [location.hash, location.pathname, location.search]);

  React.useEffect(() => {
    const storedCommand = window.localStorage.getItem('pending-attendance-clock');
    const action = pendingClockCommand ?? (storedCommand === 'in' || storedCommand === 'out' ? storedCommand : null);
    if (!action || !selectedWorkerId || !todayState || clockPendingDirection !== null) return;

    if (action === 'in' && !todayState?.canCheckIn) {
      window.localStorage.removeItem('pending-attendance-clock');
      setPendingClockCommand(null);
      setClockMessage('');
      setClockError('Check-in is not available for the current attendance state.');
      return;
    }
    if (action === 'out' && !todayState?.canCheckOut) {
      window.localStorage.removeItem('pending-attendance-clock');
      setPendingClockCommand(null);
      setClockMessage('');
      setClockError('Check-out is not available until an active check-in exists.');
      return;
    }

    window.localStorage.removeItem('pending-attendance-clock');
    setPendingClockCommand(null);
    void recordClock(action);
  }, [clockPendingDirection, pendingClockCommand, selectedWorkerId, todayState, todayState?.canCheckIn, todayState?.canCheckOut]);

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
      addNotification({
        title: 'On-duty request submitted',
        message: 'Your on-duty request was sent for approval.',
        type: 'success',
        read: false,
      });
    } catch (error) {
      setClockError(apiErrorMessage(error, 'On-duty request failed.'));
      addNotification({
        title: 'On-duty request failed',
        message: apiErrorMessage(error, 'On-duty request failed.'),
        type: 'error',
        read: false,
      });
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
      addNotification({
        title: 'Correction request sent',
        message: 'Your attendance correction request was sent to your manager.',
        type: 'success',
        read: false,
      });
    } catch (error) {
      setClockError(apiErrorMessage(error, 'Correction request failed.'));
      addNotification({
        title: 'Correction request failed',
        message: apiErrorMessage(error, 'Correction request failed.'),
        type: 'error',
        read: false,
      });
    }
  };

  const timeline = todayState?.events ?? [];
  const latestMappedEvent = React.useMemo(
    () => [...timeline].reverse().find((event) => hasCoordinateEvidence(event.location)),
    [timeline],
  );

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const isOnClock = status === 'IN' || status === 'OUTSIDE_GEOFENCE';
  const isRecording = clockPendingDirection !== null || checkInMutation.isPending || checkOutMutation.isPending;
  const canCheckInNow = Boolean(todayState?.canCheckIn) && !isRecording && Boolean(activeWorker);
  const canCheckOutNow = Boolean(todayState?.canCheckOut) && !isRecording && Boolean(activeWorker);
  const weekDays = React.useMemo(() => currentWeekDays(today), [today]);

  return (
    <div className="relative z-10 mx-auto max-w-[1740px] space-y-6 px-4 py-7 lg:px-6">
      <div className="flex flex-col gap-3">
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/60 bg-white/60 px-3 py-1 text-xs font-bold text-slate-600 backdrop-blur-md">
          <span className="relative flex h-2.5 w-2.5">
            <span className="fusion-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          {statusMeta.label} · Self-service live
        </div>
        <h1 className="font-headline text-3xl font-extrabold tracking-tight md:text-4xl">
          {greeting}, <span className="fusion-gradient-text">{activeWorkerName}</span>
        </h1>
        <p className="flex max-w-2xl items-start gap-2.5 text-sm font-medium leading-relaxed text-slate-600 md:text-base">
          <Quote size={18} className="mt-0.5 -scale-x-100 shrink-0 text-amber-400" fill="currentColor" />
          <span className="italic">{dailyQuote}</span>
        </p>
      </div>

      <div className="fusion-glass flex flex-col justify-between gap-5 rounded-[2rem] p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-colors', isOnClock ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white' : 'bg-slate-100 text-slate-400')}>
            <Clock3 className="h-6 w-6" />
          </div>
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              {isOnClock ? (
                <span className="relative flex h-2 w-2">
                  <span className="fusion-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              ) : null}
              {isOnClock ? 'On the clock' : statusMeta.label}
            </p>
            <span className={cn('block text-4xl font-extrabold tracking-tight tabular-nums', isOnClock ? 'fusion-gradient-text' : 'text-slate-300')}>
              {hours}:{minutes}:{seconds}
            </span>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              {isOnClock ? `Checked in at ${formatTime(todayState?.activeCheckInAt)}` : statusMeta.helper}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {todayState?.canCheckOut ? (
            <a
              data-attendance-clock-action="out"
              href={canCheckOutNow ? buildClockActionPath('out', workplaceCode) : undefined}
              aria-disabled={!canCheckOutNow}
              className={cn('flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 px-7 py-3.5 font-bold text-white shadow-lg shadow-rose-500/25 transition-all hover:shadow-xl hover:shadow-rose-500/30 active:scale-95', !canCheckOutNow && 'pointer-events-none opacity-50')}
            >
              <LogOut className="h-[18px] w-[18px]" /> {isRecording ? 'Recording...' : 'Check Out'}
            </a>
          ) : (
            <a
              data-attendance-clock-action="in"
              href={canCheckInNow ? buildClockActionPath('in', workplaceCode) : undefined}
              aria-disabled={!canCheckInNow}
              className={cn('flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 px-7 py-3.5 font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/30 active:scale-95', !canCheckInNow && 'pointer-events-none opacity-50')}
            >
              <LogIn className="h-[18px] w-[18px]" /> {isRecording ? 'Recording...' : 'Check In'}
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile icon={Clock3} value={formatMinutes(todayState?.totalWorkedMinutes)} label="Worked today" gradient="from-indigo-400 to-violet-500" shadow="shadow-indigo-500/15" />
        <KpiTile icon={CalendarDays} value={formatMinutes(attendanceSummary.summary.payableMinutes)} label={`Payable - ${rangeLabel(attendanceRange)}`} gradient="from-violet-400 to-purple-500" shadow="shadow-violet-500/15" />
        <KpiTile icon={TrendingUp} value={formatMinutes(attendanceSummary.summary.overtimeMinutes)} label={`Overtime - ${rangeLabel(attendanceRange)}`} gradient="from-teal-400 to-emerald-500" shadow="shadow-emerald-500/15" />
        <KpiTile icon={AlertTriangle} value={`${attendanceSummary.summary.lateMinutes} min`} label={`Late - ${rangeLabel(attendanceRange)}`} gradient="from-amber-400 to-orange-500" shadow="shadow-orange-500/15" />
      </div>
      <div className="fusion-glass rounded-[2rem] p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <TrendingUp className="h-5 w-5 text-indigo-500" />
            Attendance Hours
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
              {rangeLabel(attendanceRange)}
            </span>
            <Select value={attendanceRange} onValueChange={(value) => setAttendanceRange(value as AttendancePeriodRange)}>
              <SelectTrigger className="h-9 w-[132px] rounded-xl bg-white/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {attendanceRangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="-ml-2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ReAreaChart data={attendanceSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fusionAttendance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#a5b4fc" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
              <ReTooltip contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', fontSize: 13 }} />
              <Area type="monotone" dataKey="hours" stroke="#818cf8" strokeWidth={3} fill="url(#fusionAttendance)" />
            </ReAreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <section className="fusion-glass fusion-hover rounded-[1.75rem] p-5">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-[100px] w-[100px] rounded-xl border-2 border-white shadow-md">
                <AvatarImage src={activeWorker?.photoUrl} alt={activeWorkerName} />
                <AvatarFallback className="rounded-xl bg-[#e0e7ff] text-2xl font-bold text-[#1e1b4b]">
                  {activeWorkerName.split(' ').map((part) => part.charAt(0)).slice(0, 2).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="mt-4 text-sm">
                <p className="text-slate-600">{activeWorker?.employeeId ?? 'EMPLOYEE'} - <span className="font-semibold text-slate-950">{activeWorkerName}</span></p>
                <p className="mt-1 text-slate-600">{activeWorker?.jobTitle ?? 'Employee'}</p>
                <p className={cn('mt-3 font-medium', statusMeta.tone)}>{statusMeta.label}</p>
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500">{statusMeta.helper}</p>
            </div>
          </section>

          <section className="fusion-glass fusion-hover rounded-[1.75rem] p-5">
            <h2 className="font-headline text-base font-bold text-slate-900">My Shortcuts</h2>
            <div className="mt-3 space-y-2">
              {[
                { label: 'My Profile', path: '/employee/profile' },
                { label: 'Leave Requests', path: '/employee/time-off' },
                { label: 'Payslips', path: '/employee/payslip' },
                { label: 'Ask HR', path: '/employee/services' },
              ].map((shortcut) => (
                <Link
                  key={shortcut.path}
                  to={shortcut.path}
                  className="flex items-center justify-between rounded-xl border border-white/60 bg-white/55 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-white/80 hover:text-slate-950"
                >
                  {shortcut.label}
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
              ))}
            </div>
          </section>
        </aside>

        <section className="min-w-0">
          <div>
            <div>
              <div className="space-y-3">

                <div className="fusion-glass rounded-2xl p-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <Badge variant="secondary" className="mb-2">Employee Self-Service</Badge>
                      <h2 className="text-lg font-semibold text-slate-950">My HCM Workspace</h2>
                      <p className="mt-1 text-sm text-slate-600">
                        The same modules appear here as employee actions: workforce, payroll and reward, people, and talent.
                      </p>
                    </div>
                    <Link className="text-sm font-medium text-[#6366f1]" to="/employee/time-off">Start a leave request</Link>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                    {selfServiceModules.map((module) => {
                      const Icon = module.icon;
                      return (
                        <Link key={module.path} to={module.path} className="group">
                          <div className="flex h-full min-h-[136px] flex-col rounded-2xl border border-white/60 bg-white/55 p-4 transition-all group-hover:-translate-y-0.5 group-hover:bg-white/80">
                            <div className="flex items-start justify-between gap-3">
                              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/25">
                                <Icon className="h-5 w-5" />
                              </div>
                              <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-[#4338ca]" />
                            </div>
                            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{module.group}</p>
                            <h3 className="mt-1 text-sm font-semibold text-slate-950">{module.label}</h3>
                            <p className="mt-2 text-xs leading-5 text-slate-600">{module.description}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
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

                    <div id="attendance" className="fusion-glass rounded-2xl p-5">
                      <div className="flex items-start gap-4">
                        <div className="grid h-11 w-11 place-items-center rounded-md bg-indigo-50">
                          <CalendarDays className="h-5 w-5 text-indigo-500" />
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
                            <div className="ml-1 h-10 rounded bg-[#fde68a] px-3 py-1 text-xs">
                              <p className="font-medium">Daily Shift</p>
                              <p>{setup.attendancePolicy.standardDailyMinutes / 60} working hours</p>
                            </div>
                            <div className="mt-3 grid grid-cols-7 border-t border-slate-200">
                              {weekDays.map((date) => {
                                const isToday = date.toDateString() === today.toDateString();
                                return (
                                  <div key={date.toISOString()} className="relative min-w-0 px-1 pt-3 text-xs">
                                    <span className={cn('absolute -top-1 left-0 h-2 w-2 rounded-full bg-slate-300', isToday && 'bg-[#6366f1]')} />
                                    <p className="truncate text-slate-800">{formatDate(date)}</p>
                                    <p className={cn('mt-2 truncate', isToday ? 'font-semibold text-[#6366f1]' : 'text-slate-500')}>
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

                    <div className="fusion-glass rounded-2xl p-5">
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
                          {latestMappedEvent?.location ? (
                            <div className="mt-4">
                              <AttendanceLocationMap
                                point={latestMappedEvent.location}
                                subtitle={`${latestMappedEvent.eventType.replace('_', ' ')} at ${new Date(latestMappedEvent.timestamp).toLocaleString()}`}
                                title="Latest Captured Location"
                              />
                            </div>
                          ) : (
                            <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                              No mapped attendance point yet. Once the browser grants location access, each punch can show the exact captured point here.
                            </div>
                          )}

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

                    <div className="fusion-glass rounded-2xl p-5">
                      <div className="flex items-start gap-4">
                        <div className="grid h-11 w-11 place-items-center rounded-md bg-indigo-50">
                          <Umbrella className="h-5 w-5 text-indigo-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="font-semibold">Upcoming Holidays</h3>
                              <p className="text-sm text-slate-600">Calendar items from your employee workspace.</p>
                            </div>
                            <Link className="text-sm font-medium text-[#6366f1]" to="/employee/time-off">View all</Link>
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            {(data?.upcomingEvents ?? []).slice(0, 3).map((event) => (
                              <div key={event.id} className="rounded border border-indigo-200 px-3 py-2 text-sm">
                                <p className="font-medium">{event.title}</p>
                                <p className="text-xs text-slate-500">{event.date} - {event.type}</p>
                              </div>
                            ))}
                            {!isLoading && (!data?.upcomingEvents || data.upcomingEvents.length === 0) ? (
                              <div className="rounded border border-indigo-200 px-3 py-2 text-sm">No holidays scheduled</div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <aside className="space-y-3">
                    <div className="fusion-glass rounded-2xl p-4">
                      <h3 className="font-semibold">Attendance Terminal</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Record your own attendance with workplace and location evidence.
                      </p>
                      <div className="mt-4 space-y-3">
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-sm font-medium">{activeWorkerName || 'Linked employee profile required'}</p>
                          <p className="text-xs text-slate-500">{activeWorker?.employeeId ?? user?.email ?? 'No employee profile linked'}</p>
                        </div>
                        <Select value={workplaceCode} onValueChange={setWorkplaceCode}>
                          <SelectTrigger><SelectValue placeholder="Select workplace" /></SelectTrigger>
                          <SelectContent>
                            {setup.locations.filter((location) => location.active).map((location) => (
                              <SelectItem key={location.code} value={location.code}>{location.flag} {location.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="grid grid-cols-2 gap-2">
                          {todayState?.canCheckIn && clockPendingDirection === null && !checkInMutation.isPending ? (
                            <a
                              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#4f46e5] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(79,70,229,0.18)] transition-all duration-200 hover:bg-[#312e81] active:scale-[0.98]"
                              data-attendance-clock-action="in"
                              href={buildClockActionPath('in', workplaceCode)}
                            >
                              Check-in
                            </a>
                          ) : (
                            <span className="inline-flex h-10 items-center justify-center rounded-lg bg-[#4f46e5] px-4 py-2 text-sm font-semibold text-white opacity-50">
                              {clockPendingDirection === 'in' || checkInMutation.isPending ? 'Recording...' : 'Check-in'}
                            </span>
                          )}
                          {todayState?.canCheckOut && clockPendingDirection === null && !checkOutMutation.isPending ? (
                            <a
                              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-semibold text-[#0f172a] transition-all duration-200 hover:bg-[#eef2ff] hover:text-[#4f46e5] active:scale-[0.98]"
                              data-attendance-clock-action="out"
                              href={buildClockActionPath('out', workplaceCode)}
                            >
                              Check-out
                            </a>
                          ) : (
                            <span className="inline-flex h-10 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-semibold text-[#0f172a] opacity-50">
                              {clockPendingDirection === 'out' || checkOutMutation.isPending ? 'Recording...' : 'Check-out'}
                            </span>
                          )}
                        </div>
                      </div>
                      {clockMessage ? <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{clockMessage}</p> : null}
                      {clockError ? <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{clockError}</p> : null}
                      {manualPunchDirection ? (
                        <Button
                          className="mt-3 w-full"
                          type="button"
                          variant="outline"
                          onClick={requestManualPunchReview}
                          disabled={correctionMutation.isPending}
                        >
                          {correctionMutation.isPending ? 'Sending review...' : 'Request manual punch review'}
                        </Button>
                      ) : null}
                    </div>

                    <div className="fusion-glass rounded-2xl p-4">
                      <h3 className="font-semibold">On-duty Request</h3>
                      <p className="mt-1 text-sm text-slate-600">Route field work or missing workplace attendance to approval.</p>
                      <div className="mt-4 space-y-3">
                        <Input value={onDutyReason} placeholder="Reason or client site" onChange={(event) => setOnDutyReason(event.target.value)} />
                        <Button className="w-full" variant="secondary" onClick={submitOnDuty} disabled={!onDutyReason.trim() || onDutyMutation.isPending}>
                          Submit On-duty
                        </Button>
                      </div>
                    </div>

                    <div className="fusion-glass rounded-2xl p-4">
                      <div className="flex items-center gap-2">
                        <FileClock className="h-4 w-4 text-[#6366f1]" />
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

                    <div className="fusion-glass rounded-2xl p-4">
                      <h3 className="font-semibold">{rangeLabel(attendanceRange)} Summary</h3>
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

export function EmployeeAttendanceAction() {
  const { direction } = useParams();
  const routeLocation = useLocation();
  const [message, setMessage] = React.useState('Preparing attendance command...');
  const [error, setError] = React.useState('');
  const [correctionMessage, setCorrectionMessage] = React.useState('');
  const [correctionError, setCorrectionError] = React.useState('');
  const [capturedLocation, setCapturedLocation] = React.useState<CoordinateEvidence>();
  const [attempt, setAttempt] = React.useState(0);
  const [isRunning, setIsRunning] = React.useState(false);
  const [isSubmittingCorrection, setIsSubmittingCorrection] = React.useState(false);
  const runKeyRef = React.useRef('');

  const action = direction === 'check-out' ? 'out' : direction === 'check-in' ? 'in' : null;
  const actionLabel = action === 'out' ? 'Check-out' : 'Check-in';
  const requestedWorkplaceCode = new URLSearchParams(routeLocation.search).get('workplaceCode') ?? undefined;
  const { data: setup = DEFAULT_HCM_SETUP } = useApiQuery<HcmSetupConfig>(['employee-attendance-action-setup'], '/employee/attendance-setup');
  const { data: activeWorker, isLoading: workerLoading } = useApiQuery<Worker>(
    ['employee-attendance-action-profile'],
    '/employee/profile',
  );
  const workplaceCode = requestedWorkplaceCode ?? setup.locations.find((location) => location.active)?.code ?? DEFAULT_HCM_SETUP.locations[0]?.code;
  const geofenceProfile = setup.attendancePolicy.geofenceProfiles?.find((item) => item.active && item.locationCode === workplaceCode);
  const requiresGeolocation = Boolean(setup.attendancePolicy.geofenceEnabled && geofenceProfile?.requireGeolocation);
  const canRequestCorrection = Boolean(error && activeWorker?.id && action);

  const requestManualPunchReview = async () => {
    if (!activeWorker?.id || !action) return;
    setCorrectionMessage('');
    setCorrectionError('');
    setIsSubmittingCorrection(true);
    try {
      const now = new Date();
      await apiClient.post('/time/attendance/correction-requests', {
        workerId: activeWorker.id,
        workDate: now.toISOString().slice(0, 10),
        correctionType: 'ADD_CLOCK_EVENT',
        requestedEventType: action === 'out' ? 'CLOCK_OUT' : 'CLOCK_IN',
        requestedTimestamp: now.toISOString(),
        reason: `${actionLabel} could not capture browser geolocation. ${error || 'Manual review requested from the employee attendance workflow.'}`,
      });
      setCorrectionMessage('Manual punch review sent to your manager. It will not affect payroll until approved and applied.');
    } catch (err) {
      setCorrectionError(apiErrorMessage(err, 'Could not submit manual punch review.'));
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  React.useEffect(() => {
    if (!action) {
      setMessage('');
      setError('Unknown attendance action.');
      return;
    }
    if (workerLoading || !activeWorker?.id) return;

    const runKey = `${action}:${activeWorker.id}:${workplaceCode ?? ''}:${attempt}`;
    if (runKeyRef.current === runKey) return;
    runKeyRef.current = runKey;

    const run = async () => {
      setError('');
      setCorrectionMessage('');
      setCorrectionError('');
      setMessage('Capturing attendance evidence...');
      setIsRunning(true);
      try {
        const capture = await captureBrowserPosition();
        setCapturedLocation(capture.evidence);
        if (requiresGeolocation && !hasCoordinateEvidence(capture.evidence)) {
          setMessage('');
          setError(geolocationFailureMessage(capture.failureReason ?? 'unknown'));
          return;
        }

        await apiClient.post(`/time/attendance/${action === 'in' ? 'check-in' : 'check-out'}`, {
          workerId: activeWorker.id,
          workplaceCode,
          deviceId: 'browser',
          timestamp: new Date().toISOString(),
          ...capture.evidence,
        });
        setMessage(`${actionLabel} recorded with timestamp and location evidence.`);
      } catch (err) {
        setMessage('');
        setError(apiErrorMessage(err, `${actionLabel} failed.`));
      } finally {
        setIsRunning(false);
      }
    };

    void run();
  }, [action, actionLabel, activeWorker?.id, attempt, requiresGeolocation, workplaceCode, workerLoading]);

  return (
    <div className="grid min-h-[calc(100vh-96px)] place-items-center bg-[#eef2ff] px-4 py-12">
      <div className="w-full max-w-2xl fusion-glass rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Clock3 className="h-5 w-5 text-[#4f46e5]" />
          <h1 className="text-xl font-semibold text-[#0f172a]">{actionLabel}</h1>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Attendance is recorded with timestamp, workplace, device, and location details when required.
        </p>
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Workplace: <span className="font-semibold">{workplaceCode ?? 'Not selected'}</span>
          {requiresGeolocation ? <span className="ml-2 text-amber-700">Location required by policy</span> : null}
        </div>
        {message ? <p className="mt-5 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-5 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {correctionMessage ? <p className="mt-5 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{correctionMessage}</p> : null}
        {correctionError ? <p className="mt-5 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{correctionError}</p> : null}
        {canRequestCorrection ? (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Policy controlled fallback</p>
            <p className="mt-1">
              Because this workplace requires geolocation, the system cannot create a verified punch without browser location evidence.
              You can send a manual punch review to your manager; payroll is updated only after manager approval and HR/payroll application.
            </p>
          </div>
        ) : null}
        {hasCoordinateEvidence(capturedLocation) ? (
          <div className="mt-5">
            <AttendanceLocationMap point={capturedLocation} title={`${actionLabel} Location`} />
          </div>
        ) : (
          <div className="mt-5 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Google Maps will show the exact punch location after the browser returns latitude and longitude.
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {error ? (
            <Button
              type="button"
              onClick={() => {
                setAttempt((value) => value + 1);
                setMessage('Preparing attendance command...');
                setError('');
              }}
              disabled={isRunning}
            >
              Retry Location Capture
            </Button>
          ) : null}
          {canRequestCorrection ? (
            <Button
              type="button"
              variant="outline"
              onClick={requestManualPunchReview}
              disabled={isSubmittingCorrection || Boolean(correctionMessage)}
            >
              {isSubmittingCorrection ? 'Sending...' : 'Request manual punch review'}
            </Button>
          ) : null}
          <Link
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-semibold text-[#0f172a] transition-colors hover:bg-[#eef2ff]"
            to="/employee#attendance"
          >
            Back to attendance
          </Link>
        </div>
      </div>
    </div>
  );
}

function AttendanceLocationMap({
  point,
  subtitle,
  title,
}: {
  point: CoordinateEvidence;
  subtitle?: string;
  title: string;
}) {
  const embedUrl = buildGoogleMapsEmbedUrl(point, import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  const searchUrl = buildGoogleMapsSearchUrl(point);
  if (!hasCoordinateEvidence(point)) return null;

  return (
    <div className="overflow-hidden fusion-glass rounded-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h4 className="font-semibold text-[#0f172a]">{title}</h4>
          {subtitle ? <p className="mt-1 text-xs text-slate-600">{subtitle}</p> : null}
        </div>
        {searchUrl ? (
          <a className="text-sm font-semibold text-[#4f46e5] underline" href={searchUrl} rel="noreferrer" target="_blank">
            Open in Google Maps
          </a>
        ) : null}
      </div>
      {embedUrl ? (
        <iframe
          className="h-64 w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={embedUrl}
          title={title}
        />
      ) : (
        <div className="grid h-64 place-items-center bg-slate-50 px-5 text-center text-sm text-slate-600">
          <div>
            <MapPin className="mx-auto mb-3 h-6 w-6 text-[#4f46e5]" />
            <p className="font-medium text-slate-800">Map preview is not configured.</p>
            <p className="mt-1">Your location was captured and can still be reviewed by HR.</p>
          </div>
        </div>
      )}
      <div className="grid gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 md:grid-cols-3">
        <span>Latitude: <strong>{point.latitude}</strong></span>
        <span>Longitude: <strong>{point.longitude}</strong></span>
        <span>Accuracy: <strong>{point.accuracyMeters !== undefined ? `${point.accuracyMeters}m` : 'not reported'}</strong></span>
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
    <div className="fusion-glass rounded-2xl p-5">
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

function KpiTile({
  icon: Icon,
  value,
  label,
  gradient,
  shadow,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
  gradient: string;
  shadow: string;
}) {
  return (
    <div className={cn('fusion-hover relative overflow-hidden rounded-[2rem] bg-gradient-to-br p-6 text-white shadow-lg', gradient, shadow)}>
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-xl" />
      <div className="relative flex items-center justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/20">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="relative mt-5 font-headline text-4xl font-extrabold leading-none tracking-tight">{value}</p>
      <p className="relative mt-2 text-xs font-semibold text-white/80">{label}</p>
    </div>
  );
}
