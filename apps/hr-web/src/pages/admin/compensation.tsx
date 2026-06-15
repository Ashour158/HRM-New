import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

interface PlanForm {
  name: string;
  planType: string;
  effectiveFrom: string;
}

interface BandForm {
  bandCode: string;
  jobLevel: string;
  jobFamily: string;
  minSalary: string;
  midSalary: string;
  maxSalary: string;
}

interface ChangeForm {
  workerId: string;
  changeType: string;
  oldAmount: string;
  newAmount: string;
  effectiveDate: string;
}

interface BonusCycleForm {
  cycleName: string;
  cycleYear: string;
  eligibilityDate: string;
  paymentDate: string;
  totalPoolAmount: string;
}

interface EquityGrantForm {
  workerId: string;
  grantType: string;
  grantDate: string;
  totalUnits: string;
  strikePrice: string;
  vestingDate: string;
}

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
        const enabled = (selected.tab === 'plans' && action === 'Activate') || (selected.tab === 'changes' && action === 'Approve');
        return (
          <Button
            key={action}
            disabled={!enabled}
            onClick={() => onRun(action, selected.record, selected.tab)}
            size="sm"
            title={enabled ? action : 'This transition is exposed by the workflow but has no command endpoint on this workspace yet.'}
            variant={enabled ? 'default' : 'outline'}
          >
            {action.replace(/([A-Z])/g, ' $1').trim()}
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
  const [planForm, setPlanForm] = React.useState<PlanForm>(() => createEmptyPlanForm());
  const [bandForm, setBandForm] = React.useState<BandForm>(() => createEmptyBandForm());
  const [changeForm, setChangeForm] = React.useState<ChangeForm>(() => createEmptyChangeForm());
  const [bonusForm, setBonusForm] = React.useState<BonusCycleForm>(() => createEmptyBonusCycleForm());
  const [equityForm, setEquityForm] = React.useState<EquityGrantForm>(() => createEmptyEquityGrantForm());

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

  const createRecord = () => {
    if (activeTab === 'plans') {
      mutation.mutate({
        url: '/hr/compensation/plans',
        payload: {
          planId: generateUUID(),
          name: planForm.name,
          planType: planForm.planType,
          currency,
          effectiveFrom: planForm.effectiveFrom,
        },
      });
      return;
    }
    if (activeTab === 'bands') {
      mutation.mutate({
        url: '/hr/compensation/bands',
        payload: {
          bandId: generateUUID(),
          bandCode: bandForm.bandCode,
          jobLevel: bandForm.jobLevel,
          jobFamily: bandForm.jobFamily,
          minSalary: numberValue(bandForm.minSalary),
          midSalary: numberValue(bandForm.midSalary),
          maxSalary: numberValue(bandForm.maxSalary),
          currency,
        },
      });
      return;
    }
    if (activeTab === 'changes') {
      mutation.mutate({
        url: '/hr/compensation/changes',
        payload: {
          changeId: generateUUID(),
          workerId: changeForm.workerId,
          changeType: changeForm.changeType,
          oldAmount: changeForm.oldAmount ? numberValue(changeForm.oldAmount) : undefined,
          newAmount: numberValue(changeForm.newAmount),
          currency,
          effectiveDate: changeForm.effectiveDate,
        },
      });
      return;
    }
    if (activeTab === 'bonus-cycles') {
      mutation.mutate({
        url: '/hr/compensation/bonus-cycles',
        payload: {
          cycleId: generateUUID(),
          cycleName: bonusForm.cycleName,
          cycleYear: numberValue(bonusForm.cycleYear),
          eligibilityDate: bonusForm.eligibilityDate,
          paymentDate: bonusForm.paymentDate,
          totalPoolAmount: numberValue(bonusForm.totalPoolAmount),
          currency,
        },
      });
      return;
    }
    mutation.mutate({
      url: '/hr/compensation/equity-grants',
      payload: {
        grantId: generateUUID(),
        workerId: equityForm.workerId,
        grantType: equityForm.grantType,
        grantDate: equityForm.grantDate,
        totalUnits: numberValue(equityForm.totalUnits),
        strikePrice: equityForm.strikePrice ? numberValue(equityForm.strikePrice) : undefined,
        vestingSchedule: [
          {
            date: equityForm.vestingDate,
            percentage: 100,
            units: numberValue(equityForm.totalUnits),
          },
        ],
      },
    });
  };

  const runAction = (action: string, record: CompensationRecord, tab: CompensationTab) => {
    const id = recordId(record);
    if (tab === 'plans' && action === 'Activate') {
      mutation.mutate({ url: `/hr/compensation/plans/${id}/commands/activate`, payload: {} });
      return;
    }
    if (tab === 'changes' && action === 'Approve') {
      if (!user?.id) {
        addNotification({ title: 'Approval unavailable', message: 'A signed-in approver is required.', type: 'error', read: false });
        return;
      }
      mutation.mutate({ url: `/hr/compensation/changes/${id}/commands/approve`, payload: { approvedBy: user.id } });
    }
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
                <Label htmlFor="change-worker-filter">Worker ID</Label>
                <Input id="change-worker-filter" placeholder="Enter worker UUID to load changes" value={changeWorkerId} onChange={(event) => setChangeWorkerId(event.target.value)} />
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
                <Label htmlFor="equity-worker-filter">Worker ID</Label>
                <Input id="equity-worker-filter" placeholder="Enter worker UUID to load grants" value={equityWorkerId} onChange={(event) => setEquityWorkerId(event.target.value)} />
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
                <div className="space-y-2"><Label htmlFor="plan-name">Plan name</Label><Input id="plan-name" value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="plan-type">Plan type</Label><Input id="plan-type" value={planForm.planType} onChange={(event) => setPlanForm({ ...planForm, planType: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="plan-effective">Effective from</Label><Input id="plan-effective" type="date" value={planForm.effectiveFrom} onChange={(event) => setPlanForm({ ...planForm, effectiveFrom: event.target.value })} /></div>
              </>
            ) : null}
            {activeTab === 'bands' ? (
              <>
                <div className="space-y-2"><Label htmlFor="band-code">Band code</Label><Input id="band-code" value={bandForm.bandCode} onChange={(event) => setBandForm({ ...bandForm, bandCode: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="job-level">Job level</Label><Input id="job-level" value={bandForm.jobLevel} onChange={(event) => setBandForm({ ...bandForm, jobLevel: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="job-family">Job family</Label><Input id="job-family" value={bandForm.jobFamily} onChange={(event) => setBandForm({ ...bandForm, jobFamily: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="min-salary">Minimum salary</Label><Input id="min-salary" inputMode="numeric" value={bandForm.minSalary} onChange={(event) => setBandForm({ ...bandForm, minSalary: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="mid-salary">Mid salary</Label><Input id="mid-salary" inputMode="numeric" value={bandForm.midSalary} onChange={(event) => setBandForm({ ...bandForm, midSalary: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="max-salary">Maximum salary</Label><Input id="max-salary" inputMode="numeric" value={bandForm.maxSalary} onChange={(event) => setBandForm({ ...bandForm, maxSalary: event.target.value })} /></div>
              </>
            ) : null}
            {activeTab === 'changes' ? (
              <>
                <div className="space-y-2 md:col-span-2"><Label htmlFor="change-worker">Worker ID</Label><Input id="change-worker" value={changeForm.workerId} onChange={(event) => setChangeForm({ ...changeForm, workerId: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="change-type">Change type</Label><Input id="change-type" value={changeForm.changeType} onChange={(event) => setChangeForm({ ...changeForm, changeType: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="old-amount">Old amount</Label><Input id="old-amount" inputMode="numeric" value={changeForm.oldAmount} onChange={(event) => setChangeForm({ ...changeForm, oldAmount: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="new-amount">New amount</Label><Input id="new-amount" inputMode="numeric" value={changeForm.newAmount} onChange={(event) => setChangeForm({ ...changeForm, newAmount: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="change-effective">Effective date</Label><Input id="change-effective" type="date" value={changeForm.effectiveDate} onChange={(event) => setChangeForm({ ...changeForm, effectiveDate: event.target.value })} /></div>
              </>
            ) : null}
            {activeTab === 'bonus-cycles' ? (
              <>
                <div className="space-y-2 md:col-span-2"><Label htmlFor="cycle-name">Cycle name</Label><Input id="cycle-name" value={bonusForm.cycleName} onChange={(event) => setBonusForm({ ...bonusForm, cycleName: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="cycle-year">Cycle year</Label><Input id="cycle-year" inputMode="numeric" value={bonusForm.cycleYear} onChange={(event) => setBonusForm({ ...bonusForm, cycleYear: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="pool-amount">Pool amount</Label><Input id="pool-amount" inputMode="numeric" value={bonusForm.totalPoolAmount} onChange={(event) => setBonusForm({ ...bonusForm, totalPoolAmount: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="eligibility-date">Eligibility date</Label><Input id="eligibility-date" type="date" value={bonusForm.eligibilityDate} onChange={(event) => setBonusForm({ ...bonusForm, eligibilityDate: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="payment-date">Payment date</Label><Input id="payment-date" type="date" value={bonusForm.paymentDate} onChange={(event) => setBonusForm({ ...bonusForm, paymentDate: event.target.value })} /></div>
              </>
            ) : null}
            {activeTab === 'equity-grants' ? (
              <>
                <div className="space-y-2 md:col-span-2"><Label htmlFor="equity-worker">Worker ID</Label><Input id="equity-worker" value={equityForm.workerId} onChange={(event) => setEquityForm({ ...equityForm, workerId: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="grant-type">Grant type</Label><Input id="grant-type" value={equityForm.grantType} onChange={(event) => setEquityForm({ ...equityForm, grantType: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="grant-date">Grant date</Label><Input id="grant-date" type="date" value={equityForm.grantDate} onChange={(event) => setEquityForm({ ...equityForm, grantDate: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="total-units">Total units</Label><Input id="total-units" inputMode="numeric" value={equityForm.totalUnits} onChange={(event) => setEquityForm({ ...equityForm, totalUnits: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="strike-price">Strike price</Label><Input id="strike-price" inputMode="numeric" value={equityForm.strikePrice} onChange={(event) => setEquityForm({ ...equityForm, strikePrice: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="vesting-date">Vesting date</Label><Input id="vesting-date" type="date" value={equityForm.vestingDate} onChange={(event) => setEquityForm({ ...equityForm, vestingDate: event.target.value })} /></div>
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
