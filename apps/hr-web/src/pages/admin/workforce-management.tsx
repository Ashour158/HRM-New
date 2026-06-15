import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Clock3, Repeat2, ShieldAlert, UserCheck, UsersRound } from 'lucide-react';
import { AllowedActions } from '@/components/common/allowed-actions';
import { BusinessMetric, BusinessPageHeader } from '@/components/common/business-page';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { ErrorState } from '@/components/common/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { useUIStore } from '@/stores/ui-store';
import type { AllowedAction } from '@/types';

type WorkforceTab = 'schedules' | 'open-shifts' | 'bids' | 'swaps' | 'overtime' | 'coverage';
type IdValue = string | { value?: string } | undefined | null;

interface BaseRecord {
  id?: IdValue;
  status?: string;
  tenantId?: IdValue;
  workplaceCode?: string;
}

interface ShiftSchedule extends BaseRecord {
  workerId?: string;
  departmentId?: string;
  shiftDate?: string;
  startTime?: string;
  endTime?: string;
  breakDuration?: number;
}

interface OpenShift extends BaseRecord {
  departmentId?: string;
  shiftDate?: string;
  startTime?: string;
  endTime?: string;
  requiredSkills?: string[];
  bidDeadline?: string;
  filledByWorkerId?: string;
}

interface ShiftBid extends BaseRecord {
  workerId?: string;
  openShiftId?: string;
  bidAt?: string;
  approvedBy?: string;
}

interface ShiftSwapRequest extends BaseRecord {
  requesterWorkerId?: string;
  requestedWorkerId?: string;
  originalShiftId?: string;
  targetShiftId?: string;
  reason?: string;
  approvedBy?: string;
}

interface OvertimeApproval extends BaseRecord {
  workerId?: string;
  requestedHours?: number;
  reason?: string;
  shiftDate?: string;
  approvedBy?: string;
}

interface CoverageGap extends BaseRecord {
  departmentId?: string;
  shiftDate?: string;
  startTime?: string;
  endTime?: string;
  requiredSkills?: string[];
  filledByWorkerId?: string;
}

type WorkforceRecord = ShiftSchedule | OpenShift | ShiftBid | ShiftSwapRequest | OvertimeApproval | CoverageGap;

interface SelectedRecord {
  tab: WorkforceTab;
  record: WorkforceRecord;
}

interface ScheduleForm {
  workerId: string;
  departmentId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  breakDuration: string;
  workplaceCode: string;
}

interface OpenShiftForm {
  departmentId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  requiredSkills: string;
  bidDeadline: string;
  workplaceCode: string;
}

interface BidForm {
  workerId: string;
  openShiftId: string;
}

interface SwapForm {
  requesterWorkerId: string;
  requestedWorkerId: string;
  originalShiftId: string;
  targetShiftId: string;
  reason: string;
}

interface OvertimeForm {
  workerId: string;
  requestedHours: string;
  reason: string;
  shiftDate: string;
}

interface CoverageForm {
  departmentId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  requiredSkills: string;
  workplaceCode: string;
}

const tabLabels: Record<WorkforceTab, string> = {
  schedules: 'Schedules',
  'open-shifts': 'Open Shifts',
  bids: 'Bids',
  swaps: 'Swaps',
  overtime: 'Overtime',
  coverage: 'Coverage',
};

const createLabels: Record<WorkforceTab, string> = {
  schedules: 'Create Schedule',
  'open-shifts': 'Create Open Shift',
  bids: 'Create Bid',
  swaps: 'Create Swap',
  overtime: 'Request Overtime',
  coverage: 'Create Coverage Gap',
};

const aggregateTypes: Record<WorkforceTab, string> = {
  schedules: 'ShiftSchedule',
  'open-shifts': 'OpenShift',
  bids: 'ShiftBid',
  swaps: 'ShiftSwapRequest',
  overtime: 'WfmOvertimeApproval',
  coverage: 'CoverageGap',
};

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as { success?: boolean; data?: T } | T;
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: T }).data;
  return body as T;
}

function recordId(record?: WorkforceRecord | null): string {
  const id = record?.id;
  if (!id) return '';
  return typeof id === 'string' ? id : id.value ?? '';
}

function csv(value: string): string[] {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoAt(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function numberValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function actionToken(action: AllowedAction): string {
  return `${action.action} ${action.id} ${action.label}`.toLowerCase();
}

function actionMatches(action: AllowedAction, tokens: string[]): boolean {
  const token = actionToken(action);
  return tokens.some((candidate) => token.includes(candidate.toLowerCase()));
}

function statusTone(status?: string): string {
  const value = (status ?? '').toUpperCase();
  if (['ACTIVE', 'PUBLISHED', 'APPROVED', 'FILLED'].includes(value)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['DRAFT', 'OPEN', 'REQUESTED', 'SUBMITTED', 'DETECTED'].includes(value)) return 'border-slate-200 bg-slate-50 text-slate-700';
  if (['BID_PENDING', 'PENDING_APPROVAL', 'NOTIFIED'].includes(value)) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (['REJECTED', 'CANCELLED', 'ARCHIVED', 'CLOSED'].includes(value)) return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-indigo-200 bg-indigo-50 text-indigo-700';
}

function statusBadge(status?: string) {
  return <Badge variant="outline" className={statusTone(status)}>{status ?? 'DRAFT'}</Badge>;
}

function scheduleTitle(record: ShiftSchedule): string {
  return `${record.shiftDate ?? 'Unscheduled'} · ${record.workplaceCode ?? 'No workplace'}`;
}

function openShiftTitle(record: OpenShift): string {
  return `${record.shiftDate ?? 'Open shift'} · ${record.workplaceCode ?? 'No workplace'}`;
}

function tabPath(tab: WorkforceTab, tenantId: string): string {
  if (tab === 'schedules') return `/workforce-management/shift-schedules/tenant/${tenantId}`;
  if (tab === 'open-shifts') return `/workforce-management/open-shifts/tenant/${tenantId}`;
  if (tab === 'bids') return `/workforce-management/shift-bids/tenant/${tenantId}`;
  if (tab === 'swaps') return `/workforce-management/shift-swap-requests/tenant/${tenantId}`;
  if (tab === 'overtime') return `/workforce-management/overtime-approvals/tenant/${tenantId}`;
  return `/workforce-management/coverage-gaps/tenant/${tenantId}`;
}

function detailPath(tab: WorkforceTab, id: string): string {
  if (tab === 'schedules') return `/workforce-management/shift-schedules/${id}`;
  if (tab === 'open-shifts') return `/workforce-management/open-shifts/${id}`;
  if (tab === 'bids') return `/workforce-management/shift-bids/${id}`;
  if (tab === 'swaps') return `/workforce-management/shift-swap-requests/${id}`;
  if (tab === 'overtime') return `/workforce-management/overtime-approvals/${id}`;
  return `/workforce-management/coverage-gaps/${id}`;
}

function commandPath(tab: WorkforceTab, id: string, command: string): string {
  return `${detailPath(tab, id)}/commands/${command}`;
}

function defaultSchedule(workerId: string): ScheduleForm {
  const day = todayIso();
  return { workerId, departmentId: '', shiftDate: day, startTime: '09:00', endTime: '17:00', breakDuration: '60', workplaceCode: 'CAIRO_HQ' };
}

function defaultOpenShift(): OpenShiftForm {
  const day = todayIso();
  return { departmentId: '', shiftDate: day, startTime: '18:00', endTime: '23:00', requiredSkills: 'nurse', bidDeadline: day, workplaceCode: 'CAIRO_HQ' };
}

function defaultBid(workerId: string): BidForm {
  return { workerId, openShiftId: '' };
}

function defaultSwap(workerId: string): SwapForm {
  return { requesterWorkerId: workerId, requestedWorkerId: '', originalShiftId: '', targetShiftId: '', reason: 'Coverage swap request' };
}

function defaultOvertime(workerId: string): OvertimeForm {
  return { workerId, requestedHours: '2', reason: 'Coverage requirement', shiftDate: todayIso() };
}

function defaultCoverage(): CoverageForm {
  const day = todayIso();
  return { departmentId: '', shiftDate: day, startTime: '18:00', endTime: '23:00', requiredSkills: 'icu', workplaceCode: 'CAIRO_HQ' };
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold text-foreground">{value || '-'}</div>
    </div>
  );
}

export function AdminWorkforceManagement() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const actorId = user?.id ?? '';
  const [activeTab, setActiveTab] = React.useState<WorkforceTab>('schedules');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<SelectedRecord | null>(null);
  const [scheduleForm, setScheduleForm] = React.useState<ScheduleForm>(() => defaultSchedule(actorId));
  const [openShiftForm, setOpenShiftForm] = React.useState<OpenShiftForm>(() => defaultOpenShift());
  const [bidForm, setBidForm] = React.useState<BidForm>(() => defaultBid(actorId));
  const [swapForm, setSwapForm] = React.useState<SwapForm>(() => defaultSwap(actorId));
  const [overtimeForm, setOvertimeForm] = React.useState<OvertimeForm>(() => defaultOvertime(actorId));
  const [coverageForm, setCoverageForm] = React.useState<CoverageForm>(() => defaultCoverage());

  React.useEffect(() => {
    if (actorId) {
      setScheduleForm((current) => current.workerId ? current : { ...current, workerId: actorId });
      setBidForm((current) => current.workerId ? current : { ...current, workerId: actorId });
      setSwapForm((current) => current.requesterWorkerId ? current : { ...current, requesterWorkerId: actorId });
      setOvertimeForm((current) => current.workerId ? current : { ...current, workerId: actorId });
    }
  }, [actorId]);

  const schedulesQuery = useQuery({
    queryKey: ['workforce-management', 'schedules', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => unwrap<ShiftSchedule[]>(await apiClient.get(tabPath('schedules', tenantId))),
  });
  const openShiftsQuery = useQuery({
    queryKey: ['workforce-management', 'open-shifts', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => unwrap<OpenShift[]>(await apiClient.get(tabPath('open-shifts', tenantId))),
  });
  const bidsQuery = useQuery({
    queryKey: ['workforce-management', 'bids', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => unwrap<ShiftBid[]>(await apiClient.get(tabPath('bids', tenantId))),
  });
  const swapsQuery = useQuery({
    queryKey: ['workforce-management', 'swaps', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => unwrap<ShiftSwapRequest[]>(await apiClient.get(tabPath('swaps', tenantId))),
  });
  const overtimeQuery = useQuery({
    queryKey: ['workforce-management', 'overtime', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => unwrap<OvertimeApproval[]>(await apiClient.get(tabPath('overtime', tenantId))),
  });
  const coverageQuery = useQuery({
    queryKey: ['workforce-management', 'coverage', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => unwrap<CoverageGap[]>(await apiClient.get(tabPath('coverage', tenantId))),
  });

  const schedules = React.useMemo(() => schedulesQuery.data ?? [], [schedulesQuery.data]);
  const openShifts = React.useMemo(() => openShiftsQuery.data ?? [], [openShiftsQuery.data]);
  const bids = React.useMemo(() => bidsQuery.data ?? [], [bidsQuery.data]);
  const swaps = React.useMemo(() => swapsQuery.data ?? [], [swapsQuery.data]);
  const overtime = React.useMemo(() => overtimeQuery.data ?? [], [overtimeQuery.data]);
  const coverage = React.useMemo(() => coverageQuery.data ?? [], [coverageQuery.data]);

  const selectedId = recordId(selected?.record);
  const detailQuery = useQuery({
    queryKey: ['workforce-management-detail', selected?.tab, selectedId],
    enabled: Boolean(selected && selectedId),
    queryFn: async () => unwrap<WorkforceRecord>(await apiClient.get(detailPath(selected?.tab ?? 'schedules', selectedId))),
  });
  const currentRecord = detailQuery.data ?? selected?.record ?? null;

  const invalidateWorkforce = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['workforce-management'] });
    void queryClient.invalidateQueries({ queryKey: ['workforce-management-detail'] });
    void queryClient.invalidateQueries({ queryKey: ['allowed-actions'] });
  }, [queryClient]);

  const mutation = useMutation({
    mutationFn: async ({ path, body }: { path: string; body?: Record<string, unknown> }) => apiClient.post(path, body ?? {}),
    onSuccess: () => {
      setDialogOpen(false);
      invalidateWorkforce();
      addNotification({ title: 'Workforce action completed', message: 'The shift operation was updated.', type: 'success', read: false });
    },
    onError: (error: unknown) => {
      addNotification({ title: 'Workforce action failed', message: error instanceof Error ? error.message : 'Unable to complete the workforce operation.', type: 'error', read: false });
    },
  });

  const openCreateDialog = (tab: WorkforceTab) => {
    setActiveTab(tab);
    setDialogOpen(true);
  };

  const createRecord = () => {
    if (activeTab === 'schedules') {
      mutation.mutate({
        path: '/workforce-management/shift-schedules',
        body: {
          workerId: scheduleForm.workerId,
          departmentId: scheduleForm.departmentId,
          shiftDate: scheduleForm.shiftDate,
          startTime: isoAt(scheduleForm.shiftDate, scheduleForm.startTime),
          endTime: isoAt(scheduleForm.shiftDate, scheduleForm.endTime),
          breakDuration: numberValue(scheduleForm.breakDuration),
          workplaceCode: scheduleForm.workplaceCode,
        },
      });
      return;
    }
    if (activeTab === 'open-shifts') {
      mutation.mutate({
        path: '/workforce-management/open-shifts',
        body: {
          departmentId: openShiftForm.departmentId,
          shiftDate: openShiftForm.shiftDate,
          startTime: isoAt(openShiftForm.shiftDate, openShiftForm.startTime),
          endTime: isoAt(openShiftForm.shiftDate, openShiftForm.endTime),
          requiredSkills: csv(openShiftForm.requiredSkills),
          bidDeadline: openShiftForm.bidDeadline || undefined,
          workplaceCode: openShiftForm.workplaceCode,
        },
      });
      return;
    }
    if (activeTab === 'bids') {
      mutation.mutate({ path: '/workforce-management/shift-bids', body: { workerId: bidForm.workerId, openShiftId: bidForm.openShiftId } });
      return;
    }
    if (activeTab === 'swaps') {
      mutation.mutate({
        path: '/workforce-management/shift-swap-requests',
        body: {
          requesterWorkerId: swapForm.requesterWorkerId,
          requestedWorkerId: swapForm.requestedWorkerId,
          originalShiftId: swapForm.originalShiftId,
          targetShiftId: swapForm.targetShiftId,
          reason: swapForm.reason,
        },
      });
      return;
    }
    if (activeTab === 'overtime') {
      mutation.mutate({
        path: '/workforce-management/overtime-approvals',
        body: {
          workerId: overtimeForm.workerId,
          requestedHours: numberValue(overtimeForm.requestedHours),
          reason: overtimeForm.reason,
          shiftDate: overtimeForm.shiftDate,
        },
      });
      return;
    }
    mutation.mutate({
      path: '/workforce-management/coverage-gaps',
      body: {
        departmentId: coverageForm.departmentId,
        shiftDate: coverageForm.shiftDate,
        startTime: isoAt(coverageForm.shiftDate, coverageForm.startTime),
        endTime: isoAt(coverageForm.shiftDate, coverageForm.endTime),
        requiredSkills: csv(coverageForm.requiredSkills),
        workplaceCode: coverageForm.workplaceCode,
      },
    });
  };

  const runAllowedAction = (action: AllowedAction) => {
    if (!selected || !currentRecord) return;
    const id = recordId(currentRecord);
    if (!id) return;
    if (selected.tab === 'schedules') {
      if (actionMatches(action, ['publish'])) mutation.mutate({ path: commandPath('schedules', id, 'publish') });
      else if (actionMatches(action, ['activate'])) mutation.mutate({ path: commandPath('schedules', id, 'activate') });
      else if (actionMatches(action, ['archive'])) mutation.mutate({ path: commandPath('schedules', id, 'archive') });
      return;
    }
    if (selected.tab === 'open-shifts') {
      if (actionMatches(action, ['bid pending', 'mark-bid-pending'])) mutation.mutate({ path: commandPath('open-shifts', id, 'mark-bid-pending') });
      else if (actionMatches(action, ['fill'])) mutation.mutate({ path: commandPath('open-shifts', id, 'fill'), body: { filledByWorkerId: actorId } });
      else if (actionMatches(action, ['close'])) mutation.mutate({ path: commandPath('open-shifts', id, 'close') });
      else if (actionMatches(action, ['cancel'])) mutation.mutate({ path: commandPath('open-shifts', id, 'cancel') });
      return;
    }
    if (selected.tab === 'bids') {
      if (actionMatches(action, ['approve'])) mutation.mutate({ path: commandPath('bids', id, 'approve'), body: { approvedBy: actorId } });
      else if (actionMatches(action, ['reject'])) mutation.mutate({ path: commandPath('bids', id, 'reject') });
      else if (actionMatches(action, ['cancel'])) mutation.mutate({ path: commandPath('bids', id, 'cancel') });
      return;
    }
    if (selected.tab === 'swaps') {
      if (actionMatches(action, ['approve'])) mutation.mutate({ path: commandPath('swaps', id, 'approve'), body: { approvedBy: actorId } });
      else if (actionMatches(action, ['reject'])) mutation.mutate({ path: commandPath('swaps', id, 'reject') });
      else if (actionMatches(action, ['cancel'])) mutation.mutate({ path: commandPath('swaps', id, 'cancel') });
      return;
    }
    if (selected.tab === 'overtime') {
      if (actionMatches(action, ['approve'])) mutation.mutate({ path: commandPath('overtime', id, 'approve'), body: { approvedBy: actorId } });
      else if (actionMatches(action, ['reject'])) mutation.mutate({ path: commandPath('overtime', id, 'reject') });
      else if (actionMatches(action, ['cancel'])) mutation.mutate({ path: commandPath('overtime', id, 'cancel') });
      return;
    }
    if (actionMatches(action, ['notify'])) mutation.mutate({ path: commandPath('coverage', id, 'notify') });
    else if (actionMatches(action, ['fill'])) mutation.mutate({ path: commandPath('coverage', id, 'fill'), body: { filledByWorkerId: actorId } });
    else if (actionMatches(action, ['close'])) mutation.mutate({ path: commandPath('coverage', id, 'close') });
  };

  const scheduleColumns = React.useMemo<DataTableColumn<ShiftSchedule>[]>(() => [
    { key: 'shift', header: 'Shift', cell: (row) => <button className="font-semibold text-primary hover:underline" onClick={() => setSelected({ tab: 'schedules', record: row })}>{scheduleTitle(row)}</button> },
    { key: 'worker', header: 'Worker', cell: (row) => row.workerId?.slice(0, 8) ?? '-' },
    { key: 'time', header: 'Time', cell: (row) => `${formatDate(row.startTime, { hour: '2-digit', minute: '2-digit' })} - ${formatDate(row.endTime, { hour: '2-digit', minute: '2-digit' })}` },
    { key: 'status', header: 'Status', cell: (row) => statusBadge(row.status) },
  ], []);

  const openShiftColumns = React.useMemo<DataTableColumn<OpenShift>[]>(() => [
    { key: 'shift', header: 'Open shift', cell: (row) => <button className="font-semibold text-primary hover:underline" onClick={() => setSelected({ tab: 'open-shifts', record: row })}>{openShiftTitle(row)}</button> },
    { key: 'department', header: 'Department', cell: (row) => row.departmentId?.slice(0, 8) ?? '-' },
    { key: 'skills', header: 'Skills', cell: (row) => row.requiredSkills?.join(', ') || '-' },
    { key: 'status', header: 'Status', cell: (row) => statusBadge(row.status) },
  ], []);

  const bidColumns = React.useMemo<DataTableColumn<ShiftBid>[]>(() => [
    { key: 'bid', header: 'Bid', cell: (row) => <button className="font-semibold text-primary hover:underline" onClick={() => setSelected({ tab: 'bids', record: row })}>{row.workerId?.slice(0, 8) ?? 'Worker'} bid</button> },
    { key: 'openShift', header: 'Open shift', cell: (row) => row.openShiftId?.slice(0, 8) ?? '-' },
    { key: 'status', header: 'Status', cell: (row) => statusBadge(row.status) },
  ], []);

  const swapColumns = React.useMemo<DataTableColumn<ShiftSwapRequest>[]>(() => [
    { key: 'swap', header: 'Swap', cell: (row) => <button className="font-semibold text-primary hover:underline" onClick={() => setSelected({ tab: 'swaps', record: row })}>{row.requesterWorkerId?.slice(0, 8) ?? 'Requester'} to {row.requestedWorkerId?.slice(0, 8) ?? 'worker'}</button> },
    { key: 'reason', header: 'Reason', cell: (row) => row.reason ?? '-' },
    { key: 'status', header: 'Status', cell: (row) => statusBadge(row.status) },
  ], []);

  const overtimeColumns = React.useMemo<DataTableColumn<OvertimeApproval>[]>(() => [
    { key: 'overtime', header: 'Request', cell: (row) => <button className="font-semibold text-primary hover:underline" onClick={() => setSelected({ tab: 'overtime', record: row })}>{row.workerId?.slice(0, 8) ?? 'Worker'} · {row.requestedHours ?? 0}h</button> },
    { key: 'date', header: 'Shift date', cell: (row) => formatDate(row.shiftDate) },
    { key: 'reason', header: 'Reason', cell: (row) => row.reason ?? '-' },
    { key: 'status', header: 'Status', cell: (row) => statusBadge(row.status) },
  ], []);

  const coverageColumns = React.useMemo<DataTableColumn<CoverageGap>[]>(() => [
    { key: 'gap', header: 'Coverage gap', cell: (row) => <button className="font-semibold text-primary hover:underline" onClick={() => setSelected({ tab: 'coverage', record: row })}>{row.shiftDate ?? 'Gap'} · {row.workplaceCode ?? 'No workplace'}</button> },
    { key: 'department', header: 'Department', cell: (row) => row.departmentId?.slice(0, 8) ?? '-' },
    { key: 'skills', header: 'Skills', cell: (row) => row.requiredSkills?.join(', ') || '-' },
    { key: 'status', header: 'Status', cell: (row) => statusBadge(row.status) },
  ], []);

  const pageError = schedulesQuery.error ?? openShiftsQuery.error ?? coverageQuery.error;
  if (pageError) {
    return <ErrorState title="Unable to load workforce operations" error={pageError} onRetry={() => {
      void schedulesQuery.refetch();
      void openShiftsQuery.refetch();
      void coverageQuery.refetch();
    }} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-6 lg:p-8">
      <BusinessPageHeader
        eyebrow="Workforce Operations"
        icon={CalendarClock}
        title="Workforce Management"
        subtitle="Plan shifts, fill coverage gaps, manage swaps, bids, and overtime approvals."
        actions={<Button onClick={() => openCreateDialog(activeTab)}>{createLabels[activeTab]}</Button>}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <BusinessMetric label="Scheduled Shifts" value={schedules.length} />
        <BusinessMetric label="Open Shifts" value={openShifts.length} tone={openShifts.length ? 'warning' : 'default'} />
        <BusinessMetric label="Coverage Gaps" value={coverage.length} tone={coverage.length ? 'warning' : 'default'} />
        <BusinessMetric label="Overtime Requests" value={overtime.length} />
      </div>

      <h2 className="sr-only">Workforce operation workspaces</h2>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WorkforceTab)} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="open-shifts">Open Shifts</TabsTrigger>
          <TabsTrigger value="bids">Bids</TabsTrigger>
          <TabsTrigger value="swaps">Swaps</TabsTrigger>
          <TabsTrigger value="overtime">Overtime</TabsTrigger>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
        </TabsList>

        <TabsContent value="schedules">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" /> Shift schedules</CardTitle></CardHeader>
            <CardContent>
              <DataTable columns={scheduleColumns} data={schedules} keyExtractor={recordId} isLoading={schedulesQuery.isLoading} emptyMessage="No shift schedules found" total={schedules.length} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="open-shifts">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5" /> Open shifts</CardTitle></CardHeader>
            <CardContent>
              <DataTable columns={openShiftColumns} data={openShifts} keyExtractor={recordId} isLoading={openShiftsQuery.isLoading} emptyMessage="No open shifts found" total={openShifts.length} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bids">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5" /> Shift bids</CardTitle></CardHeader>
            <CardContent>
              <DataTable columns={bidColumns} data={bids} keyExtractor={recordId} isLoading={bidsQuery.isLoading} emptyMessage="No shift bids found" total={bids.length} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="swaps">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Repeat2 className="h-5 w-5" /> Shift swaps</CardTitle></CardHeader>
            <CardContent>
              <DataTable columns={swapColumns} data={swaps} keyExtractor={recordId} isLoading={swapsQuery.isLoading} emptyMessage="No shift swaps found" total={swaps.length} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overtime">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" /> Overtime approvals</CardTitle></CardHeader>
            <CardContent>
              <DataTable columns={overtimeColumns} data={overtime} keyExtractor={recordId} isLoading={overtimeQuery.isLoading} emptyMessage="No overtime requests found" total={overtime.length} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coverage">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Coverage gaps</CardTitle></CardHeader>
            <CardContent>
              <DataTable columns={coverageColumns} data={coverage} keyExtractor={recordId} isLoading={coverageQuery.isLoading} emptyMessage="No coverage gaps found" total={coverage.length} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{createLabels[activeTab]}</DialogTitle>
            <DialogDescription>Create a workforce operation record for the active tenant.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            {activeTab === 'schedules' ? (
              <>
                <div className="space-y-2"><Label htmlFor="schedule-worker">Worker ID</Label><Input id="schedule-worker" value={scheduleForm.workerId} onChange={(event) => setScheduleForm({ ...scheduleForm, workerId: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="schedule-department">Department ID</Label><Input id="schedule-department" value={scheduleForm.departmentId} onChange={(event) => setScheduleForm({ ...scheduleForm, departmentId: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="schedule-date">Shift date</Label><Input id="schedule-date" type="date" value={scheduleForm.shiftDate} onChange={(event) => setScheduleForm({ ...scheduleForm, shiftDate: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="schedule-workplace">Workplace</Label><Input id="schedule-workplace" value={scheduleForm.workplaceCode} onChange={(event) => setScheduleForm({ ...scheduleForm, workplaceCode: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="schedule-start">Start time</Label><Input id="schedule-start" type="time" value={scheduleForm.startTime} onChange={(event) => setScheduleForm({ ...scheduleForm, startTime: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="schedule-end">End time</Label><Input id="schedule-end" type="time" value={scheduleForm.endTime} onChange={(event) => setScheduleForm({ ...scheduleForm, endTime: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="schedule-break">Break minutes</Label><Input id="schedule-break" inputMode="numeric" value={scheduleForm.breakDuration} onChange={(event) => setScheduleForm({ ...scheduleForm, breakDuration: event.target.value })} /></div>
              </>
            ) : null}
            {activeTab === 'open-shifts' ? (
              <>
                <div className="space-y-2"><Label htmlFor="open-department">Department ID</Label><Input id="open-department" value={openShiftForm.departmentId} onChange={(event) => setOpenShiftForm({ ...openShiftForm, departmentId: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="open-workplace">Workplace</Label><Input id="open-workplace" value={openShiftForm.workplaceCode} onChange={(event) => setOpenShiftForm({ ...openShiftForm, workplaceCode: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="open-date">Shift date</Label><Input id="open-date" type="date" value={openShiftForm.shiftDate} onChange={(event) => setOpenShiftForm({ ...openShiftForm, shiftDate: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="open-deadline">Bid deadline</Label><Input id="open-deadline" type="date" value={openShiftForm.bidDeadline} onChange={(event) => setOpenShiftForm({ ...openShiftForm, bidDeadline: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="open-start">Start time</Label><Input id="open-start" type="time" value={openShiftForm.startTime} onChange={(event) => setOpenShiftForm({ ...openShiftForm, startTime: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="open-end">End time</Label><Input id="open-end" type="time" value={openShiftForm.endTime} onChange={(event) => setOpenShiftForm({ ...openShiftForm, endTime: event.target.value })} /></div>
                <div className="space-y-2 md:col-span-2"><Label htmlFor="open-skills">Required skills</Label><Input id="open-skills" value={openShiftForm.requiredSkills} onChange={(event) => setOpenShiftForm({ ...openShiftForm, requiredSkills: event.target.value })} /></div>
              </>
            ) : null}
            {activeTab === 'bids' ? (
              <>
                <div className="space-y-2"><Label htmlFor="bid-worker">Worker ID</Label><Input id="bid-worker" value={bidForm.workerId} onChange={(event) => setBidForm({ ...bidForm, workerId: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="bid-open-shift">Open shift ID</Label><Input id="bid-open-shift" value={bidForm.openShiftId} onChange={(event) => setBidForm({ ...bidForm, openShiftId: event.target.value })} /></div>
              </>
            ) : null}
            {activeTab === 'swaps' ? (
              <>
                <div className="space-y-2"><Label htmlFor="swap-requester">Requester worker ID</Label><Input id="swap-requester" value={swapForm.requesterWorkerId} onChange={(event) => setSwapForm({ ...swapForm, requesterWorkerId: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="swap-requested">Requested worker ID</Label><Input id="swap-requested" value={swapForm.requestedWorkerId} onChange={(event) => setSwapForm({ ...swapForm, requestedWorkerId: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="swap-original">Original shift ID</Label><Input id="swap-original" value={swapForm.originalShiftId} onChange={(event) => setSwapForm({ ...swapForm, originalShiftId: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="swap-target">Target shift ID</Label><Input id="swap-target" value={swapForm.targetShiftId} onChange={(event) => setSwapForm({ ...swapForm, targetShiftId: event.target.value })} /></div>
                <div className="space-y-2 md:col-span-2"><Label htmlFor="swap-reason">Reason</Label><Input id="swap-reason" value={swapForm.reason} onChange={(event) => setSwapForm({ ...swapForm, reason: event.target.value })} /></div>
              </>
            ) : null}
            {activeTab === 'overtime' ? (
              <>
                <div className="space-y-2"><Label htmlFor="overtime-worker">Worker ID</Label><Input id="overtime-worker" value={overtimeForm.workerId} onChange={(event) => setOvertimeForm({ ...overtimeForm, workerId: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="overtime-date">Shift date</Label><Input id="overtime-date" type="date" value={overtimeForm.shiftDate} onChange={(event) => setOvertimeForm({ ...overtimeForm, shiftDate: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="overtime-hours">Requested hours</Label><Input id="overtime-hours" inputMode="numeric" value={overtimeForm.requestedHours} onChange={(event) => setOvertimeForm({ ...overtimeForm, requestedHours: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="overtime-reason">Reason</Label><Input id="overtime-reason" value={overtimeForm.reason} onChange={(event) => setOvertimeForm({ ...overtimeForm, reason: event.target.value })} /></div>
              </>
            ) : null}
            {activeTab === 'coverage' ? (
              <>
                <div className="space-y-2"><Label htmlFor="coverage-department">Department ID</Label><Input id="coverage-department" value={coverageForm.departmentId} onChange={(event) => setCoverageForm({ ...coverageForm, departmentId: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="coverage-workplace">Workplace</Label><Input id="coverage-workplace" value={coverageForm.workplaceCode} onChange={(event) => setCoverageForm({ ...coverageForm, workplaceCode: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="coverage-date">Shift date</Label><Input id="coverage-date" type="date" value={coverageForm.shiftDate} onChange={(event) => setCoverageForm({ ...coverageForm, shiftDate: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="coverage-start">Start time</Label><Input id="coverage-start" type="time" value={coverageForm.startTime} onChange={(event) => setCoverageForm({ ...coverageForm, startTime: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="coverage-end">End time</Label><Input id="coverage-end" type="time" value={coverageForm.endTime} onChange={(event) => setCoverageForm({ ...coverageForm, endTime: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="coverage-skills">Required skills</Label><Input id="coverage-skills" value={coverageForm.requiredSkills} onChange={(event) => setCoverageForm({ ...coverageForm, requiredSkills: event.target.value })} /></div>
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button onClick={createRecord} disabled={mutation.isPending}>Save {tabLabels[activeTab].replace(/s$/, '')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="max-w-xl overflow-y-auto">
          {currentRecord && selected ? (
            <>
              <SheetTitle>{tabLabels[selected.tab]} detail</SheetTitle>
              <SheetDescription>Review the record and run policy-allowed lifecycle actions.</SheetDescription>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                    <div className="mt-2">{statusBadge(currentRecord.status)}</div>
                  </div>
                  <AllowedActions
                    aggregateType={aggregateTypes[selected.tab]}
                    aggregateId={recordId(currentRecord)}
                    state={currentRecord.status}
                    context={{ tenantId }}
                    onAction={runAllowedAction}
                    variant="outline"
                  />
                </div>
                <div className="grid gap-3">
                  <DetailRow label="Record ID" value={recordId(currentRecord)} />
                  <DetailRow label="Workplace" value={currentRecord.workplaceCode} />
                  {'workerId' in currentRecord ? <DetailRow label="Worker" value={currentRecord.workerId} /> : null}
                  {'departmentId' in currentRecord ? <DetailRow label="Department" value={currentRecord.departmentId} /> : null}
                  {'shiftDate' in currentRecord ? <DetailRow label="Shift date" value={formatDate(currentRecord.shiftDate)} /> : null}
                  {'requiredSkills' in currentRecord ? <DetailRow label="Required skills" value={currentRecord.requiredSkills?.join(', ')} /> : null}
                  {'requestedHours' in currentRecord ? <DetailRow label="Requested hours" value={currentRecord.requestedHours} /> : null}
                  {'reason' in currentRecord ? <DetailRow label="Reason" value={currentRecord.reason} /> : null}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default AdminWorkforceManagement;
