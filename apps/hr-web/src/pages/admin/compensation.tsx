import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Award, BadgeDollarSign, Layers3, LineChart, WalletCards } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { BusinessMetric, BusinessPageHeader } from '@/components/common/business-page';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { FormField } from '@/components/common/form-field';
import { ModuleConfigureLauncher } from '@/components/common/module-configure-launcher';
import { WorkerPicker } from '@/components/common/worker-picker';
import { optionalNumericText, requiredNumericText, requiredText } from '@/components/forms/schema-helpers';
import { apiClient } from '@/lib/api-client';
import { formatCurrency, formatDate, generateUUID } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { useUIStore } from '@/stores/ui-store';

type CompensationTab = 'plans' | 'bands' | 'changes' | 'bonus-cycles' | 'equity-grants';

interface IdValue {
  value?: string;
}

interface CompensationPlan {
  id: string | IdValue;
  name: string;
  planType: string;
  currency: string;
  status: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
}

interface CompensationBand {
  id: string | IdValue;
  bandCode: string;
  jobLevel: string;
  jobFamily: string;
  minSalary: number;
  midSalary: number;
  maxSalary: number;
  currency: string;
  status: string;
}

interface CompensationChange {
  id: string | IdValue;
  workerId: string | IdValue;
  changeType: string;
  oldAmount?: number;
  newAmount: number;
  currency: string;
  effectiveDate: string;
  status: string;
}

interface BonusCycle {
  id: string | IdValue;
  cycleName: string;
  cycleYear: number;
  eligibilityDate: string;
  paymentDate: string;
  totalPoolAmount: number;
  currency: string;
  status: string;
}

interface VestingScheduleEntry {
  date: string;
  percentage: number;
  units: number;
}

interface EquityGrant {
  id: string | IdValue;
  workerId: string | IdValue;
  grantType: string;
  grantDate: string;
  vestingSchedule: VestingScheduleEntry[];
  totalUnits: number;
  vestedUnits?: number;
  exercisedUnits?: number;
  strikePrice?: number;
  status: string;
}

type CompensationRecord = CompensationPlan | CompensationBand | CompensationChange | BonusCycle | EquityGrant;

interface SelectedRecord {
  tab: CompensationTab;
  record: CompensationRecord;
}

interface AllowedActionsResponse {
  allowedActions?: string[];
}

/**
 * Zod schemas for the five create-record forms below. One `useForm` per tab
 * (see `AdminCompensation`) instead of one big discriminated form, since each
 * tab already had its own independent state shape. See
 * @/components/forms/README.md for the general react-hook-form + zod
 * pattern this follows.
 */
const planSchema = z.object({
  name: requiredText('Plan name is required'),
  planType: requiredText('Plan type is required'),
  effectiveFrom: requiredText('Effective date is required'),
});
type PlanForm = z.infer<typeof planSchema>;

const bandSchema = z.object({
  bandCode: requiredText('Band code is required'),
  jobLevel: requiredText('Job level is required'),
  jobFamily: requiredText('Job family is required'),
  minSalary: requiredNumericText('Minimum salary is required'),
  midSalary: requiredNumericText('Mid salary is required'),
  maxSalary: requiredNumericText('Maximum salary is required'),
});
type BandForm = z.infer<typeof bandSchema>;

const changeSchema = z.object({
  workerId: requiredText('Worker ID is required'),
  changeType: requiredText('Change type is required'),
  oldAmount: optionalNumericText('Old amount must be a number'),
  newAmount: requiredNumericText('New amount is required'),
  effectiveDate: requiredText('Effective date is required'),
});
type ChangeForm = z.infer<typeof changeSchema>;

const bonusCycleSchema = z.object({
  cycleName: requiredText('Cycle name is required'),
  cycleYear: requiredNumericText('Cycle year is required'),
  eligibilityDate: requiredText('Eligibility date is required'),
  paymentDate: requiredText('Payment date is required'),
  totalPoolAmount: requiredNumericText('Pool amount is required'),
});
type BonusCycleForm = z.infer<typeof bonusCycleSchema>;

const equityGrantSchema = z.object({
  workerId: requiredText('Worker ID is required'),
  grantType: requiredText('Grant type is required'),
  grantDate: requiredText('Grant date is required'),
  totalUnits: requiredNumericText('Total units is required'),
  strikePrice: optionalNumericText('Strike price must be a number'),
  vestingDate: requiredText('Vesting date is required'),
});
type EquityGrantForm = z.infer<typeof equityGrantSchema>;

const tabLabels: Record<CompensationTab, string> = {
  plans: 'Plans',
  bands: 'Bands',
  changes: 'Changes',
  'bonus-cycles': 'Bonus Cycles',
  'equity-grants': 'Equity Grants',
};

const tabCreateLabels: Record<CompensationTab, string> = {
  plans: 'Create Plan',
  bands: 'Create Band',
  changes: 'Create Change',
  'bonus-cycles': 'Create Bonus Cycle',
  'equity-grants': 'Create Equity Grant',
};

// Every action here corresponds to an FSM transition with a matching
// POST /hr/compensation/<tab>/:id/commands/<kebab-case-action> endpoint on the API.
const SUPPORTED_ACTIONS: Record<CompensationTab, string[]> = {
  plans: ['Activate', 'Suspend', 'Close'],
  bands: ['Activate', 'Revise', 'Close'],
  changes: ['Submit', 'SendForApproval', 'Approve', 'MakeEffective', 'Reject', 'Cancel'],
  'bonus-cycles': ['Activate', 'StartCalculation', 'StartReview', 'Approve', 'MarkPaid', 'Close'],
  'equity-grants': ['StartVesting', 'RecordVesting', 'Exercise', 'Expire', 'Forfeit'],
};

// Actions whose command payload needs more than the record id, collected via the action-input dialog.
const ACTIONS_REQUIRING_INPUT = new Set(['Revise', 'RecordVesting', 'Exercise']);

function actionLabel(action: string): string {
  return action.replace(/([A-Z])/g, ' $1').trim();
}

function actionCommandSlug(action: string): string {
  return action.replace(/[A-Z]/g, (letter, offset) => (offset === 0 ? letter.toLowerCase() : `-${letter.toLowerCase()}`));
}

function apiData<T>(payload: unknown): T {
  const response = payload as { success?: boolean; data?: T };
  if (response.success === true && response.data !== undefined) return response.data;
  return payload as T;
}

function unwrap<T>(response: { data: unknown }): T {
  return apiData<T>(response.data);
}

function recordId(record: CompensationRecord | undefined): string {
  if (!record) return '';
  const rawId = record.id;
  return typeof rawId === 'string' ? rawId : rawId?.value ?? '';
}

function workerIdValue(value: string | IdValue | undefined): string {
  return typeof value === 'string' ? value : value?.value ?? '';
}

function numberValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusTone(status: string): string {
  if (['ACTIVE', 'APPROVED', 'PAID', 'VESTED', 'EXERCISED'].includes(status)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['DRAFT', 'GRANTED', 'SUBMITTED'].includes(status)) return 'bg-slate-50 text-slate-700 border-slate-200';
  if (['PENDING_APPROVAL', 'REVIEW', 'CALCULATION', 'VESTING'].includes(status)) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (['CANCELLED', 'REJECTED', 'EXPIRED', 'FORFEITED', 'CLOSED'].includes(status)) return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-indigo-50 text-indigo-700 border-indigo-200';
}

function titleForRecord(record: CompensationRecord): string {
  if ('name' in record) return record.name;
  if ('bandCode' in record) return record.bandCode;
  if ('cycleName' in record) return record.cycleName;
  if ('grantType' in record) return `${record.grantType} grant`;
  if ('changeType' in record) return `${record.changeType} change`;
  return recordId(record);
}

function statusForRecord(record: CompensationRecord): string {
  return 'status' in record ? record.status : 'UNKNOWN';
}

function createEmptyPlanForm(): PlanForm {
  return { name: 'Annual merit plan', planType: 'MERIT', effectiveFrom: todayIso() };
}

function createEmptyBandForm(): BandForm {
  return { bandCode: 'BAND-001', jobLevel: 'L3', jobFamily: 'Operations', minSalary: '50000', midSalary: '65000', maxSalary: '80000' };
}

function createEmptyChangeForm(): ChangeForm {
  return { workerId: '', changeType: 'SALARY_ADJUSTMENT', oldAmount: '', newAmount: '75000', effectiveDate: todayIso() };
}

function createEmptyBonusCycleForm(): BonusCycleForm {
  const year = String(new Date().getFullYear());
  return { cycleName: `${year} Annual Bonus`, cycleYear: year, eligibilityDate: `${year}-12-01`, paymentDate: `${year}-12-25`, totalPoolAmount: '250000' };
}

function createEmptyEquityGrantForm(): EquityGrantForm {
  return { workerId: '', grantType: 'RSU', grantDate: todayIso(), totalUnits: '100', strikePrice: '0', vestingDate: todayIso() };
}

function RecordActions({
  selected,
  onRun,
}: {
  selected: SelectedRecord | null;
  onRun: (action: string, record: CompensationRecord, tab: CompensationTab) => void;
}) {
  const id = recordId(selected?.record);
  const route = selected?.tab === 'plans'
    ? `/hr/compensation/plans/${id}/allowed-actions`
    : selected?.tab === 'bands'
      ? `/hr/compensation/bands/${id}/allowed-actions`
      : selected?.tab === 'changes'
        ? `/hr/compensation/changes/${id}/allowed-actions`
        : selected?.tab === 'bonus-cycles'
          ? `/hr/compensation/bonus-cycles/${id}/allowed-actions`
          : selected?.tab === 'equity-grants'
            ? `/hr/compensation/equity-grants/${id}/allowed-actions`
            : '';

  const actionsQuery = useQuery({
    queryKey: ['compensation-allowed-actions', selected?.tab, id],
    queryFn: async () => unwrap<AllowedActionsResponse>(await apiClient.get(route)),
    enabled: Boolean(route && id),
    retry: false,
  });

  const actions = actionsQuery.data?.allowedActions ?? [];
  if (!actions.length || !selected) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const enabled = SUPPORTED_ACTIONS[selected.tab]?.includes(action) ?? false;
        return (
          <Button
            key={action}
            disabled={!enabled}
            onClick={() => onRun(action, selected.record, selected.tab)}
            size="sm"
            title={enabled ? action : 'This transition is exposed by the workflow but has no command endpoint on this workspace yet.'}
            variant={enabled ? 'default' : 'outline'}
          >
            {actionLabel(action)}
          </Button>
        );
      })}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

export function AdminCompensation() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);
  const { user } = useAuth();
  const { tenantConfig } = useTenant();
  const currency = tenantConfig.currency;
  const [activeTab, setActiveTab] = React.useState<CompensationTab>('plans');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<SelectedRecord | null>(null);
  const [changeWorkerId, setChangeWorkerId] = React.useState('');
  const [equityWorkerId, setEquityWorkerId] = React.useState('');
  const planForm = useForm<PlanForm>({ resolver: zodResolver(planSchema), defaultValues: createEmptyPlanForm() });
  const bandForm = useForm<BandForm>({ resolver: zodResolver(bandSchema), defaultValues: createEmptyBandForm() });
  const changeForm = useForm<ChangeForm>({ resolver: zodResolver(changeSchema), defaultValues: createEmptyChangeForm() });
  const bonusForm = useForm<BonusCycleForm>({ resolver: zodResolver(bonusCycleSchema), defaultValues: createEmptyBonusCycleForm() });
  const equityForm = useForm<EquityGrantForm>({ resolver: zodResolver(equityGrantSchema), defaultValues: createEmptyEquityGrantForm() });
  const [actionDialog, setActionDialog] = React.useState<{ tab: CompensationTab; action: string; record: CompensationRecord } | null>(null);
  const [reviseForm, setReviseForm] = React.useState({ minSalary: '', midSalary: '', maxSalary: '' });
  const [unitsForm, setUnitsForm] = React.useState({ units: '' });

  const plansQuery = useQuery({
    queryKey: ['compensation-plans'],
    queryFn: async () => unwrap<CompensationPlan[]>(await apiClient.get('/hr/compensation/plans')),
    retry: false,
  });
  const bandsQuery = useQuery({
    queryKey: ['compensation-bands'],
    queryFn: async () => unwrap<CompensationBand[]>(await apiClient.get('/hr/compensation/bands')),
    retry: false,
  });
  const changesQuery = useQuery({
    queryKey: ['compensation-changes', changeWorkerId],
    queryFn: async () => unwrap<CompensationChange[]>(await apiClient.get(`/hr/compensation/changes/worker/${changeWorkerId}`)),
    enabled: Boolean(changeWorkerId),
    retry: false,
  });
  const bonusCyclesQuery = useQuery({
    queryKey: ['compensation-bonus-cycles'],
    queryFn: async () => unwrap<BonusCycle[]>(await apiClient.get('/hr/compensation/bonus-cycles')),
    retry: false,
  });
  const equityGrantsQuery = useQuery({
    queryKey: ['compensation-equity-grants', equityWorkerId],
    queryFn: async () => unwrap<EquityGrant[]>(await apiClient.get(`/hr/compensation/equity-grants/worker/${equityWorkerId}`)),
    enabled: Boolean(equityWorkerId),
    retry: false,
  });

  const selectedId = recordId(selected?.record);
  const selectedDetailRoute = selected?.tab === 'plans'
    ? `/hr/compensation/plans/${selectedId}`
    : selected?.tab === 'bands'
      ? `/hr/compensation/bands/${selectedId}`
      : selected?.tab === 'bonus-cycles'
        ? `/hr/compensation/bonus-cycles/${selectedId}`
        : selected?.tab === 'equity-grants'
          ? `/hr/compensation/equity-grants/${selectedId}`
          : '';

  const selectedDetailQuery = useQuery({
    queryKey: ['compensation-detail', selected?.tab, selectedId],
    queryFn: async () => unwrap<CompensationRecord>(await apiClient.get(selectedDetailRoute)),
    enabled: Boolean(selectedDetailRoute && selectedId),
    retry: false,
  });

  const currentRecord = selectedDetailQuery.data ?? selected?.record ?? null;

  const invalidateCompensation = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['compensation-plans'] });
    queryClient.invalidateQueries({ queryKey: ['compensation-bands'] });
    queryClient.invalidateQueries({ queryKey: ['compensation-changes'] });
    queryClient.invalidateQueries({ queryKey: ['compensation-bonus-cycles'] });
    queryClient.invalidateQueries({ queryKey: ['compensation-equity-grants'] });
    queryClient.invalidateQueries({ queryKey: ['compensation-detail'] });
    queryClient.invalidateQueries({ queryKey: ['compensation-allowed-actions'] });
  }, [queryClient]);

  const mutation = useMutation({
    mutationFn: async ({ url, payload }: { url: string; payload: Record<string, unknown> }) => apiClient.post(url, payload),
    onSuccess: () => {
      setDialogOpen(false);
      setActionDialog(null);
      invalidateCompensation();
      addNotification({ title: 'Compensation updated', message: 'The compensation record was saved.', type: 'success', read: false });
    },
    onError: (error: unknown) => {
      addNotification({ title: 'Compensation action failed', message: error instanceof Error ? error.message : 'Unable to complete this compensation action.', type: 'error', read: false });
    },
  });

  const openCreateDialog = (tab: CompensationTab) => {
    setActiveTab(tab);
    setDialogOpen(true);
  };

  const submitPlan = planForm.handleSubmit((values) => {
    mutation.mutate({
      url: '/hr/compensation/plans',
      payload: {
        planId: generateUUID(),
        name: values.name,
        planType: values.planType,
        currency,
        effectiveFrom: values.effectiveFrom,
      },
    });
  });

  const submitBand = bandForm.handleSubmit((values) => {
    mutation.mutate({
      url: '/hr/compensation/bands',
      payload: {
        bandId: generateUUID(),
        bandCode: values.bandCode,
        jobLevel: values.jobLevel,
        jobFamily: values.jobFamily,
        minSalary: numberValue(values.minSalary),
        midSalary: numberValue(values.midSalary),
        maxSalary: numberValue(values.maxSalary),
        currency,
      },
    });
  });

  const submitChange = changeForm.handleSubmit((values) => {
    mutation.mutate({
      url: '/hr/compensation/changes',
      payload: {
        changeId: generateUUID(),
        workerId: values.workerId,
        changeType: values.changeType,
        oldAmount: values.oldAmount ? numberValue(values.oldAmount) : undefined,
        newAmount: numberValue(values.newAmount),
        currency,
        effectiveDate: values.effectiveDate,
      },
    });
  });

  const submitBonusCycle = bonusForm.handleSubmit((values) => {
    mutation.mutate({
      url: '/hr/compensation/bonus-cycles',
      payload: {
        cycleId: generateUUID(),
        cycleName: values.cycleName,
        cycleYear: numberValue(values.cycleYear),
        eligibilityDate: values.eligibilityDate,
        paymentDate: values.paymentDate,
        totalPoolAmount: numberValue(values.totalPoolAmount),
        currency,
      },
    });
  });

  const submitEquityGrant = equityForm.handleSubmit((values) => {
    mutation.mutate({
      url: '/hr/compensation/equity-grants',
      payload: {
        grantId: generateUUID(),
        workerId: values.workerId,
        grantType: values.grantType,
        grantDate: values.grantDate,
        totalUnits: numberValue(values.totalUnits),
        strikePrice: values.strikePrice ? numberValue(values.strikePrice) : undefined,
        vestingSchedule: [
          {
            date: values.vestingDate,
            percentage: 100,
            units: numberValue(values.totalUnits),
          },
        ],
      },
    });
  });

  const submitByTab: Record<CompensationTab, () => void> = {
    plans: submitPlan,
    bands: submitBand,
    changes: submitChange,
    'bonus-cycles': submitBonusCycle,
    'equity-grants': submitEquityGrant,
  };

  const createRecord = () => submitByTab[activeTab]();

  const runAction = (action: string, record: CompensationRecord, tab: CompensationTab) => {
    if (ACTIONS_REQUIRING_INPUT.has(action)) {
      if (action === 'Revise' && 'minSalary' in record) {
        setReviseForm({ minSalary: String(record.minSalary), midSalary: String(record.midSalary), maxSalary: String(record.maxSalary) });
      }
      if ((action === 'RecordVesting' || action === 'Exercise') && 'totalUnits' in record) {
        setUnitsForm({ units: String(record.totalUnits) });
      }
      setActionDialog({ tab, action, record });
      return;
    }

    const id = recordId(record);
    const url = `/hr/compensation/${tab}/${id}/commands/${actionCommandSlug(action)}`;

    if (tab === 'changes' && action === 'Approve') {
      if (!user?.id) {
        addNotification({ title: 'Approval unavailable', message: 'A signed-in approver is required.', type: 'error', read: false });
        return;
      }
      mutation.mutate({ url, payload: { approvedBy: user.id } });
      return;
    }

    mutation.mutate({ url, payload: {} });
  };

  const submitActionDialog = () => {
    if (!actionDialog) return;
    const id = recordId(actionDialog.record);
    const url = `/hr/compensation/${actionDialog.tab}/${id}/commands/${actionCommandSlug(actionDialog.action)}`;
    const payload = actionDialog.action === 'Revise'
      ? { minSalary: numberValue(reviseForm.minSalary), midSalary: numberValue(reviseForm.midSalary), maxSalary: numberValue(reviseForm.maxSalary) }
      : { units: numberValue(unitsForm.units) };
    mutation.mutate({ url, payload });
  };

  const plans = plansQuery.data ?? [];
  const bands = bandsQuery.data ?? [];
  const changes = changesQuery.data ?? [];
  const bonusCycles = bonusCyclesQuery.data ?? [];
  const equityGrants = equityGrantsQuery.data ?? [];

  const planColumns = React.useMemo<DataTableColumn<CompensationPlan>[]>(() => [
    { key: 'name', header: 'Plan', cell: (row) => <button className="font-semibold text-primary hover:underline" onClick={() => setSelected({ tab: 'plans', record: row })}>{row.name}</button> },
    { key: 'type', header: 'Type', cell: (row) => row.planType },
    { key: 'effective', header: 'Effective', cell: (row) => formatDate(row.effectiveFrom) },
    { key: 'status', header: 'Status', cell: (row) => <Badge className={statusTone(row.status)}>{row.status}</Badge> },
  ], []);

  const bandColumns = React.useMemo<DataTableColumn<CompensationBand>[]>(() => [
    { key: 'code', header: 'Band', cell: (row) => <button className="font-semibold text-primary hover:underline" onClick={() => setSelected({ tab: 'bands', record: row })}>{row.bandCode}</button> },
    { key: 'family', header: 'Family', cell: (row) => row.jobFamily },
    { key: 'range', header: 'Range', cell: (row) => `${formatCurrency(row.minSalary, row.currency)} - ${formatCurrency(row.maxSalary, row.currency)}` },
    { key: 'status', header: 'Status', cell: (row) => <Badge className={statusTone(row.status)}>{row.status}</Badge> },
  ], []);

  const changeColumns = React.useMemo<DataTableColumn<CompensationChange>[]>(() => [
    { key: 'type', header: 'Change', cell: (row) => <button className="font-semibold text-primary hover:underline" onClick={() => setSelected({ tab: 'changes', record: row })}>{row.changeType}</button> },
    { key: 'worker', header: 'Worker', cell: (row) => workerIdValue(row.workerId).slice(0, 8) || '-' },
    { key: 'amount', header: 'New amount', cell: (row) => formatCurrency(row.newAmount, row.currency) },
    { key: 'effective', header: 'Effective', cell: (row) => formatDate(row.effectiveDate) },
    { key: 'status', header: 'Status', cell: (row) => <Badge className={statusTone(row.status)}>{row.status}</Badge> },
  ], []);

  const bonusColumns = React.useMemo<DataTableColumn<BonusCycle>[]>(() => [
    { key: 'name', header: 'Cycle', cell: (row) => <button className="font-semibold text-primary hover:underline" onClick={() => setSelected({ tab: 'bonus-cycles', record: row })}>{row.cycleName}</button> },
    { key: 'year', header: 'Year', cell: (row) => row.cycleYear },
    { key: 'pool', header: 'Pool', cell: (row) => formatCurrency(row.totalPoolAmount, row.currency) },
    { key: 'payment', header: 'Payment', cell: (row) => formatDate(row.paymentDate) },
    { key: 'status', header: 'Status', cell: (row) => <Badge className={statusTone(row.status)}>{row.status}</Badge> },
  ], []);

  const equityColumns = React.useMemo<DataTableColumn<EquityGrant>[]>(() => [
    { key: 'type', header: 'Grant', cell: (row) => <button className="font-semibold text-primary hover:underline" onClick={() => setSelected({ tab: 'equity-grants', record: row })}>{row.grantType}</button> },
    { key: 'worker', header: 'Worker', cell: (row) => workerIdValue(row.workerId).slice(0, 8) || '-' },
    { key: 'units', header: 'Units', cell: (row) => row.totalUnits.toLocaleString() },
    { key: 'date', header: 'Grant date', cell: (row) => formatDate(row.grantDate) },
    { key: 'status', header: 'Status', cell: (row) => <Badge className={statusTone(row.status)}>{row.status}</Badge> },
  ], []);

  const pageError = plansQuery.error ?? bandsQuery.error ?? bonusCyclesQuery.error;

  if (pageError) {
    return <ErrorState title="Unable to load compensation records" error={pageError} onRetry={() => {
      plansQuery.refetch();
      bandsQuery.refetch();
      bonusCyclesQuery.refetch();
    }} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-6 lg:p-8">
      <BusinessPageHeader
        eyebrow="Reward"
        icon={BadgeDollarSign}
        title="Compensation"
        subtitle="Manage compensation plans, salary bands, pay changes, bonus cycles, and equity grants."
        actions={
          <>
            <Badge variant="outline" className="h-10 rounded-xl px-3 text-sm">Tenant currency: {currency}</Badge>
            <Button onClick={() => openCreateDialog(activeTab)}>{tabCreateLabels[activeTab]}</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <BusinessMetric label="Plans" value={plans.length} />
        <BusinessMetric label="Bands" value={bands.length} />
        <BusinessMetric label="Bonus cycles" value={bonusCycles.length} />
        <BusinessMetric label="Equity grants" value={equityWorkerId ? equityGrants.length : 'Filter'} tone={equityWorkerId ? 'default' : 'warning'} />
      </div>

      <ModuleConfigureLauncher
        moduleName="Compensation"
        policyArea="PAYROLL"
        approvalCommandKeyword="Compensation"
        fieldAccessEntity="compensation"
      />

      <h2 className="sr-only">Compensation workspaces</h2>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as CompensationTab)} className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="bands">Bands</TabsTrigger>
          <TabsTrigger value="changes">Changes</TabsTrigger>
          <TabsTrigger value="bonus-cycles">Bonus Cycles</TabsTrigger>
          <TabsTrigger value="equity-grants">Equity Grants</TabsTrigger>
        </TabsList>

        <TabsContent value="plans">
          <Card className="rounded-3xl border-white/60 bg-white/75 shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2"><Layers3 className="h-5 w-5" /> Plans</CardTitle></CardHeader>
            <CardContent>
              <DataTable columns={planColumns} data={plans} keyExtractor={recordId} isLoading={plansQuery.isLoading} emptyMessage="No compensation plans found" total={plans.length} listKey="admin.compensation.plans" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bands">
          <Card className="rounded-3xl border-white/60 bg-white/75 shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5" /> Salary bands</CardTitle></CardHeader>
            <CardContent>
              <DataTable columns={bandColumns} data={bands} keyExtractor={recordId} isLoading={bandsQuery.isLoading} emptyMessage="No compensation bands found" total={bands.length} listKey="admin.compensation.bands" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="changes">
          <Card className="rounded-3xl border-white/60 bg-white/75 shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5" /> Compensation changes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:max-w-xl">
                <Label htmlFor="change-worker-filter">Filter changes by worker</Label>
                <WorkerPicker id="change-worker-filter" placeholder="Search by name or employee ID to load changes" value={changeWorkerId} onChange={(workerId) => setChangeWorkerId(workerId)} />
              </div>
              {changeWorkerId ? (
                <DataTable columns={changeColumns} data={changes} keyExtractor={recordId} isLoading={changesQuery.isLoading} emptyMessage="No compensation changes for this worker" total={changes.length} listKey="admin.compensation.changes" viewFilters={{ workerId: changeWorkerId }} />
              ) : (
                <EmptyState icon={LineChart} title="Choose a worker" description="Compensation changes are scoped to an employee record." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bonus-cycles">
          <Card className="rounded-3xl border-white/60 bg-white/75 shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2"><Award className="h-5 w-5" /> Bonus cycles</CardTitle></CardHeader>
            <CardContent>
              <DataTable columns={bonusColumns} data={bonusCycles} keyExtractor={recordId} isLoading={bonusCyclesQuery.isLoading} emptyMessage="No bonus cycles found" total={bonusCycles.length} listKey="admin.compensation.bonus-cycles" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equity-grants">
          <Card className="rounded-3xl border-white/60 bg-white/75 shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2"><BadgeDollarSign className="h-5 w-5" /> Equity grants</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:max-w-xl">
                <Label htmlFor="equity-worker-filter">Filter grants by worker</Label>
                <WorkerPicker id="equity-worker-filter" placeholder="Search by name or employee ID to load grants" value={equityWorkerId} onChange={(workerId) => setEquityWorkerId(workerId)} />
              </div>
              {equityWorkerId ? (
                <DataTable columns={equityColumns} data={equityGrants} keyExtractor={recordId} isLoading={equityGrantsQuery.isLoading} emptyMessage="No equity grants for this worker" total={equityGrants.length} listKey="admin.compensation.equity-grants" viewFilters={{ workerId: equityWorkerId }} />
              ) : (
                <EmptyState icon={BadgeDollarSign} title="Choose a worker" description="Equity grants are scoped to an employee record." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tabCreateLabels[activeTab]}</DialogTitle>
            <DialogDescription>
              Create a {tabLabels[activeTab].toLowerCase()} record using the active tenant currency.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            {activeTab === 'plans' ? (
              <>
                <FormField id="plan-name" label="Plan name" error={planForm.formState.errors.name?.message}>
                  <Input {...planForm.register('name')} />
                </FormField>
                <FormField id="plan-type" label="Plan type" error={planForm.formState.errors.planType?.message}>
                  <Input {...planForm.register('planType')} />
                </FormField>
                <FormField id="plan-effective" label="Effective from" error={planForm.formState.errors.effectiveFrom?.message}>
                  <Input type="date" {...planForm.register('effectiveFrom')} />
                </FormField>
              </>
            ) : null}
            {activeTab === 'bands' ? (
              <>
                <FormField id="band-code" label="Band code" error={bandForm.formState.errors.bandCode?.message}>
                  <Input {...bandForm.register('bandCode')} />
                </FormField>
                <FormField id="job-level" label="Job level" error={bandForm.formState.errors.jobLevel?.message}>
                  <Input {...bandForm.register('jobLevel')} />
                </FormField>
                <FormField id="job-family" label="Job family" error={bandForm.formState.errors.jobFamily?.message}>
                  <Input {...bandForm.register('jobFamily')} />
                </FormField>
                <FormField id="min-salary" label="Minimum salary" error={bandForm.formState.errors.minSalary?.message}>
                  <Input inputMode="numeric" {...bandForm.register('minSalary')} />
                </FormField>
                <FormField id="mid-salary" label="Mid salary" error={bandForm.formState.errors.midSalary?.message}>
                  <Input inputMode="numeric" {...bandForm.register('midSalary')} />
                </FormField>
                <FormField id="max-salary" label="Maximum salary" error={bandForm.formState.errors.maxSalary?.message}>
                  <Input inputMode="numeric" {...bandForm.register('maxSalary')} />
                </FormField>
              </>
            ) : null}
            {activeTab === 'changes' ? (
              <>
                <FormField id="change-worker" label="Select worker" error={changeForm.formState.errors.workerId?.message} className="md:col-span-2">
                  <Controller
                    control={changeForm.control}
                    name="workerId"
                    render={({ field }) => (
                      <WorkerPicker id="change-worker" value={field.value} onChange={(workerId) => field.onChange(workerId)} />
                    )}
                  />
                </FormField>
                <FormField id="change-type" label="Change type" error={changeForm.formState.errors.changeType?.message}>
                  <Input {...changeForm.register('changeType')} />
                </FormField>
                <FormField id="old-amount" label="Old amount" error={changeForm.formState.errors.oldAmount?.message}>
                  <Input inputMode="numeric" {...changeForm.register('oldAmount')} />
                </FormField>
                <FormField id="new-amount" label="New amount" error={changeForm.formState.errors.newAmount?.message}>
                  <Input inputMode="numeric" {...changeForm.register('newAmount')} />
                </FormField>
                <FormField id="change-effective" label="Effective date" error={changeForm.formState.errors.effectiveDate?.message}>
                  <Input type="date" {...changeForm.register('effectiveDate')} />
                </FormField>
              </>
            ) : null}
            {activeTab === 'bonus-cycles' ? (
              <>
                <FormField id="cycle-name" label="Cycle name" error={bonusForm.formState.errors.cycleName?.message} className="md:col-span-2">
                  <Input {...bonusForm.register('cycleName')} />
                </FormField>
                <FormField id="cycle-year" label="Cycle year" error={bonusForm.formState.errors.cycleYear?.message}>
                  <Input inputMode="numeric" {...bonusForm.register('cycleYear')} />
                </FormField>
                <FormField id="pool-amount" label="Pool amount" error={bonusForm.formState.errors.totalPoolAmount?.message}>
                  <Input inputMode="numeric" {...bonusForm.register('totalPoolAmount')} />
                </FormField>
                <FormField id="eligibility-date" label="Eligibility date" error={bonusForm.formState.errors.eligibilityDate?.message}>
                  <Input type="date" {...bonusForm.register('eligibilityDate')} />
                </FormField>
                <FormField id="payment-date" label="Payment date" error={bonusForm.formState.errors.paymentDate?.message}>
                  <Input type="date" {...bonusForm.register('paymentDate')} />
                </FormField>
              </>
            ) : null}
            {activeTab === 'equity-grants' ? (
              <>
                <FormField id="equity-worker" label="Select worker" error={equityForm.formState.errors.workerId?.message} className="md:col-span-2">
                  <Controller
                    control={equityForm.control}
                    name="workerId"
                    render={({ field }) => (
                      <WorkerPicker id="equity-worker" value={field.value} onChange={(workerId) => field.onChange(workerId)} />
                    )}
                  />
                </FormField>
                <FormField id="grant-type" label="Grant type" error={equityForm.formState.errors.grantType?.message}>
                  <Input {...equityForm.register('grantType')} />
                </FormField>
                <FormField id="grant-date" label="Grant date" error={equityForm.formState.errors.grantDate?.message}>
                  <Input type="date" {...equityForm.register('grantDate')} />
                </FormField>
                <FormField id="total-units" label="Total units" error={equityForm.formState.errors.totalUnits?.message}>
                  <Input inputMode="numeric" {...equityForm.register('totalUnits')} />
                </FormField>
                <FormField id="strike-price" label="Strike price" error={equityForm.formState.errors.strikePrice?.message}>
                  <Input inputMode="numeric" {...equityForm.register('strikePrice')} />
                </FormField>
                <FormField id="vesting-date" label="Vesting date" error={equityForm.formState.errors.vestingDate?.message}>
                  <Input type="date" {...equityForm.register('vestingDate')} />
                </FormField>
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button onClick={createRecord} disabled={mutation.isPending}>Save {tabLabels[activeTab].replace(/s$/, '')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(actionDialog)} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{actionDialog ? actionLabel(actionDialog.action) : ''}</DialogTitle>
            <DialogDescription>
              {actionDialog?.action === 'Revise'
                ? 'Set the new salary range for this band.'
                : 'Enter the number of units for this transition.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {actionDialog?.action === 'Revise' ? (
              <>
                <div className="space-y-2"><Label htmlFor="revise-min-salary">Minimum salary</Label><Input id="revise-min-salary" inputMode="numeric" value={reviseForm.minSalary} onChange={(event) => setReviseForm({ ...reviseForm, minSalary: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="revise-mid-salary">Mid salary</Label><Input id="revise-mid-salary" inputMode="numeric" value={reviseForm.midSalary} onChange={(event) => setReviseForm({ ...reviseForm, midSalary: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="revise-max-salary">Maximum salary</Label><Input id="revise-max-salary" inputMode="numeric" value={reviseForm.maxSalary} onChange={(event) => setReviseForm({ ...reviseForm, maxSalary: event.target.value })} /></div>
              </>
            ) : null}
            {actionDialog?.action === 'RecordVesting' || actionDialog?.action === 'Exercise' ? (
              <div className="space-y-2"><Label htmlFor="action-units">Units</Label><Input id="action-units" inputMode="numeric" value={unitsForm.units} onChange={(event) => setUnitsForm({ units: event.target.value })} /></div>
            ) : null}
          </div>
          <DialogFooter>
            <Button onClick={submitActionDialog} disabled={mutation.isPending}>{actionDialog ? actionLabel(actionDialog.action) : 'Submit'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="max-w-xl overflow-y-auto">
          {currentRecord ? (
            <>
              <SheetTitle>{titleForRecord(currentRecord)}</SheetTitle>
              <SheetDescription>{tabLabels[selected?.tab ?? 'plans']} record details and workflow actions.</SheetDescription>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                    <Badge className={`mt-2 ${statusTone(statusForRecord(currentRecord))}`}>{statusForRecord(currentRecord)}</Badge>
                  </div>
                  <RecordActions selected={selected} onRun={runAction} />
                </div>
                <div className="grid gap-3">
                  <DetailRow label="Record ID" value={recordId(currentRecord)} />
                  {'currency' in currentRecord ? <DetailRow label="Currency" value={currentRecord.currency} /> : null}
                  {'effectiveFrom' in currentRecord ? <DetailRow label="Effective from" value={formatDate(currentRecord.effectiveFrom)} /> : null}
                  {'minSalary' in currentRecord ? <DetailRow label="Range midpoint" value={formatCurrency(currentRecord.midSalary, currentRecord.currency)} /> : null}
                  {'newAmount' in currentRecord ? <DetailRow label="New amount" value={formatCurrency(currentRecord.newAmount, currentRecord.currency)} /> : null}
                  {'totalPoolAmount' in currentRecord ? <DetailRow label="Total pool" value={formatCurrency(currentRecord.totalPoolAmount, currentRecord.currency)} /> : null}
                  {'totalUnits' in currentRecord ? <DetailRow label="Total units" value={currentRecord.totalUnits.toLocaleString()} /> : null}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default AdminCompensation;
