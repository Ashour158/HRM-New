import * as React from 'react';
import { Banknote, Download, FileCheck2, FileText, ListChecks, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { apiClient } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { useUIStore } from '@/stores/ui-store';

interface PayrollExplainabilityLine {
  code?: string;
  ruleId?: string;
  label?: string;
  amount?: number;
  formula?: string;
  glAccount?: string;
  taxable?: boolean;
  insurable?: boolean;
  source?: string;
  ledgerSource?: string;
  ledgerRuleCode?: string;
}

interface PayrollCycleRow {
  workerId: string;
  employeeId?: string;
  name?: string;
  employeeName?: string;
  grossSalary?: number | null;
  taxAmount?: number | null;
  employeeInsuranceAmount?: number | null;
  netSalary?: number | null;
  currency?: string;
  explainability?: PayrollExplainabilityLine[];
}

interface PayrollReadiness {
  canClose?: boolean;
  blockingIssueCount?: number;
  warningIssueCount?: number;
  issues?: Array<{ severity?: string; message?: string; code?: string }>;
}

interface PayrollCyclePreview {
  id?: string;
  payrollCycleId?: string;
  name?: string;
  year: number;
  month: number;
  employeeCount?: number;
  totalGross?: number;
  totalTax?: number;
  totalEmployeeInsurance?: number;
  totalNet?: number;
  currency?: string;
  readiness?: PayrollReadiness;
  rows?: PayrollCycleRow[];
}

interface PaymentBatchPreview {
  ready?: boolean;
  readyCount?: number;
  blockedCount?: number;
  totalNet?: number;
  currency?: string;
  id?: string;
}

interface PayrollExportJob {
  id: string;
  type?: string;
  status?: string;
  createdAt?: string;
}

interface PayslipSummary {
  workerId: string;
  employeeId?: string;
  employeeName?: string;
  grossPay?: number;
  netPay?: number;
  currency?: string;
  status?: string;
}

interface PayrollCommandResult {
  payrollCycleId?: string;
  status?: string;
  totalNet?: number;
  currency?: string;
  allowedNextActions?: string[];
}

type PayrollCycleCommand = {
  id: string;
  command: 'start-review' | 'approve' | 'export';
};

function isUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function statusTone(status?: string) {
  if (!status) return 'bg-slate-50 text-slate-700 border-slate-200';
  if (['APPROVED', 'CLOSED', 'EXPORTED', 'PUBLISHED'].includes(status)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['BLOCKED', 'FAILED', 'CANCELLED'].includes(status)) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (['REVIEW', 'VALIDATION', 'CALCULATION'].includes(status)) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-indigo-50 text-indigo-700 border-indigo-200';
}

function periodName(year: number, month: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function downloadBlob(content: Blob, filename: string) {
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function PayrollWorkspace() {
  const today = new Date();
  const [year, setYear] = React.useState(today.getFullYear());
  const [month, setMonth] = React.useState(today.getMonth() + 1);
  const [selectedWorkerId, setSelectedWorkerId] = React.useState<string | undefined>();
  const [lastCommand, setLastCommand] = React.useState<PayrollCommandResult | null>(null);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const addNotification = useUIStore((state) => state.addNotification);

  const querySuffix = `year=${year}&month=${month}`;
  const previewQuery = useApiQuery<PayrollCyclePreview>(
    ['payroll-workspace-preview', year, month],
    `/payroll/monthly-cycle-preview?${querySuffix}`,
    { retry: false },
  );
  const paymentBatchQuery = useApiQuery<PaymentBatchPreview>(
    ['payroll-workspace-payment-batch', year, month],
    `/payroll/payment-batch-preview?${querySuffix}`,
    { retry: false },
  );
  const exportJobsQuery = useApiQuery<PayrollExportJob[]>(
    ['payroll-workspace-export-jobs'],
    '/payroll/export-jobs?limit=10',
    { retry: false },
  );

  const preview = previewQuery.data;
  const rows = React.useMemo(() => preview?.rows ?? [], [preview?.rows]);
  const selectedRow = rows.find((row) => row.workerId === selectedWorkerId) ?? rows[0];
  const cycleId = preview?.payrollCycleId ?? preview?.id;
  const cycleIsPersisted = isUuid(cycleId);

  React.useEffect(() => {
    if (!selectedWorkerId && rows[0]?.workerId) {
      setSelectedWorkerId(rows[0].workerId);
    }
  }, [rows, selectedWorkerId]);

  const payslipsQuery = useApiQuery<PayslipSummary[]>(
    ['payroll-workspace-payslips', cycleId],
    cycleId ? `/payroll/cycles/${cycleId}/payslips` : '/payroll/cycles/current/payslips',
    { enabled: cycleIsPersisted, retry: false },
  );

  const invalidateKeys = React.useMemo(
    () => [
      ['payroll-workspace-preview', year, month],
      ['payroll-workspace-payment-batch', year, month],
      ['payroll-workspace-export-jobs'],
      ['payroll-workspace-payslips', cycleId],
    ],
    [cycleId, month, year],
  );

  const closeMutation = useApiMutation<PayrollCommandResult, { year: number; month: number; closeCycle: boolean }>(
    '/payroll/monthly-cycle/close-to-pay',
    'post',
    invalidateKeys,
    {
      onSuccess: (result) => {
        setLastCommand(result);
        addNotification({ title: 'Payroll close started', message: 'The close-to-pay pipeline is running for the selected period.', type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: 'Payroll close failed', message: error.message, type: 'error', read: false }),
    },
  );

  const cycleCommandMutation = useApiMutation<PayrollCommandResult, PayrollCycleCommand>(
    (variables) => `/payroll/cycles/${variables.id}/commands/${variables.command}`,
    'post',
    invalidateKeys,
    {
      onSuccess: (result) => {
        setLastCommand(result);
        addNotification({ title: 'Payroll run updated', message: result.status ? `Cycle is now ${result.status}.` : 'Payroll command completed.', type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: 'Payroll command failed', message: error.message, type: 'error', read: false }),
    },
  );

  const runExport = async () => {
    setIsDownloading(true);
    try {
      const response = await apiClient.get(`/payroll/export.csv?${querySuffix}`, { responseType: 'blob' });
      downloadBlob(response.data as Blob, `payroll-${year}-${month}.csv`);
      addNotification({ title: 'Payroll export ready', message: 'The payroll register was downloaded.', type: 'success', read: false });
    } catch (error) {
      addNotification({ title: 'Payroll export failed', message: (error as Error).message, type: 'error', read: false });
    } finally {
      setIsDownloading(false);
    }
  };

  const columns: DataTableColumn<PayrollCycleRow>[] = [
    {
      key: 'employee',
      header: 'Employee',
      cell: (row) => (
        <button className="text-left font-semibold text-slate-900 hover:text-indigo-700" onClick={() => setSelectedWorkerId(row.workerId)}>
          {row.name || row.employeeName || row.employeeId || row.workerId}
          <span className="block text-xs font-medium text-slate-500">{row.employeeId || row.workerId}</span>
        </button>
      ),
    },
    { key: 'gross', header: 'Gross', cell: (row) => formatCurrency(row.grossSalary ?? undefined, row.currency ?? preview?.currency ?? 'EGP') },
    { key: 'tax', header: 'Tax', cell: (row) => formatCurrency(row.taxAmount ?? undefined, row.currency ?? preview?.currency ?? 'EGP') },
    { key: 'insurance', header: 'Insurance', cell: (row) => formatCurrency(row.employeeInsuranceAmount ?? undefined, row.currency ?? preview?.currency ?? 'EGP') },
    { key: 'net', header: 'Net', cell: (row) => <strong>{formatCurrency(row.netSalary ?? undefined, row.currency ?? preview?.currency ?? 'EGP')}</strong> },
  ];

  const payslipColumns: DataTableColumn<PayslipSummary>[] = [
    { key: 'employee', header: 'Employee', cell: (row) => row.employeeName || row.employeeId || row.workerId },
    { key: 'gross', header: 'Gross pay', cell: (row) => formatCurrency(row.grossPay, row.currency ?? preview?.currency ?? 'EGP') },
    { key: 'net', header: 'Net pay', cell: (row) => <strong>{formatCurrency(row.netPay, row.currency ?? preview?.currency ?? 'EGP')}</strong> },
    { key: 'status', header: 'Status', cell: (row) => <Badge className={statusTone(row.status)}>{row.status ?? 'DRAFT'}</Badge> },
  ];

  if (previewQuery.isError) {
    return <ErrorState title="Unable to load payroll workspace" error={previewQuery.error} onRetry={() => previewQuery.refetch()} />;
  }

  const currency = preview?.currency ?? paymentBatchQuery.data?.currency ?? 'EGP';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-headline text-3xl font-extrabold text-slate-950">Payroll Workspace</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Run, review, approve, post, and export payroll cycles.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input className="w-24 bg-white" type="number" value={year} onChange={(event) => setYear(Number(event.target.value || today.getFullYear()))} aria-label="Payroll year" />
          <Input className="w-20 bg-white" type="number" min={1} max={12} value={month} onChange={(event) => setMonth(Number(event.target.value || today.getMonth() + 1))} aria-label="Payroll month" />
          <Button onClick={() => closeMutation.mutateAsync({ year, month, closeCycle: true })} disabled={closeMutation.isPending}>
            <PlayCircle className="mr-2 h-4 w-4" />
            Close to pay
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-3xl border-white/60 bg-white/70 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Current run</p><p className="text-lg font-extrabold text-slate-950">{preview?.name ?? `${periodName(year, month)} payroll`}</p></div>
            <FileCheck2 className="h-8 w-8 text-indigo-500" />
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-white/60 bg-white/70 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Employees</p><p className="text-3xl font-extrabold text-slate-950">{preview?.employeeCount ?? rows.length}</p></div>
            <ListChecks className="h-8 w-8 text-violet-500" />
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-white/60 bg-white/70 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Net pay</p><p className="text-xl font-extrabold text-slate-950">{formatCurrency(preview?.totalNet ?? paymentBatchQuery.data?.totalNet, currency)}</p></div>
            <Banknote className="h-8 w-8 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-white/60 bg-white/70 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Blockers</p><p className="text-3xl font-extrabold text-slate-950">{preview?.readiness?.blockingIssueCount ?? paymentBatchQuery.data?.blockedCount ?? 0}</p></div>
            <FileText className="h-8 w-8 text-amber-500" />
          </CardContent>
        </Card>
      </div>

      {lastCommand ? (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800">
          {lastCommand.status ? `Cycle status: ${lastCommand.status}. ` : ''}{lastCommand.allowedNextActions?.length ? `Next: ${lastCommand.allowedNextActions.join(', ')}` : 'Command completed.'}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(380px,0.75fr)]">
        <Card className="rounded-3xl border-white/60 bg-white/75 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Payroll run detail</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!cycleIsPersisted} onClick={() => cycleId && cycleCommandMutation.mutateAsync({ id: cycleId, command: 'start-review' })}>Review</Button>
              <Button size="sm" variant="outline" disabled={!cycleIsPersisted} onClick={() => cycleId && cycleCommandMutation.mutateAsync({ id: cycleId, command: 'approve' })}>Approve</Button>
              <Button size="sm" variant="outline" disabled={!cycleIsPersisted} onClick={() => cycleId && cycleCommandMutation.mutateAsync({ id: cycleId, command: 'export' })}>Post</Button>
              <Button size="sm" variant="outline" onClick={runExport} disabled={isDownloading}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={rows} keyExtractor={(row) => row.workerId} isLoading={previewQuery.isLoading} emptyMessage="No payroll rows for this cycle" total={rows.length} />
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/60 bg-white/75 shadow-sm">
          <CardHeader><CardTitle>Explainability ledger</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {selectedRow?.explainability?.length ? selectedRow.explainability.map((line, index) => (
              <div key={`${line.code ?? line.ruleId ?? index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{line.label ?? line.code ?? line.ruleId ?? 'Payroll line'}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">{line.formula ?? line.source ?? line.ledgerSource ?? 'Calculated component'}</p>
                  </div>
                  <p className="font-bold text-slate-950">{formatCurrency(line.amount, selectedRow.currency ?? currency)}</p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold text-slate-600">
                  <span className="rounded-xl bg-slate-50 px-2 py-1">GL <strong>{line.glAccount ?? '-'}</strong></span>
                  <span className="rounded-xl bg-slate-50 px-2 py-1">Taxable {line.taxable ? 'Yes' : 'No'}</span>
                  <span className="rounded-xl bg-slate-50 px-2 py-1">Insurable {line.insurable ? 'Yes' : 'No'}</span>
                </div>
              </div>
            )) : (
              <EmptyState icon={ListChecks} title="No calculation lines" description="Select a payroll row after calculation to inspect pay components." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-3xl border-white/60 bg-white/75 shadow-sm">
          <CardHeader><CardTitle>Payslip drill-down</CardTitle></CardHeader>
          <CardContent>
            <DataTable columns={payslipColumns} data={payslipsQuery.data ?? []} keyExtractor={(row) => row.workerId} isLoading={payslipsQuery.isLoading} emptyMessage="Payslips appear after cycle close and publish" total={payslipsQuery.data?.length ?? 0} />
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/60 bg-white/75 shadow-sm">
          <CardHeader><CardTitle>Payment and export history</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Payment batch</span>
                <Badge className={paymentBatchQuery.data?.ready ? statusTone('APPROVED') : statusTone('BLOCKED')}>
                  {paymentBatchQuery.data?.ready ? 'Ready' : 'Needs review'}
                </Badge>
              </div>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">{formatCurrency(paymentBatchQuery.data?.totalNet, currency)}</p>
              <p className="text-xs font-medium text-slate-500">{paymentBatchQuery.data?.readyCount ?? 0} ready, {paymentBatchQuery.data?.blockedCount ?? 0} blocked</p>
            </div>
            {(exportJobsQuery.data ?? []).length ? exportJobsQuery.data?.map((job) => (
              <div key={job.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{job.type ?? 'Export job'}</p>
                  <p className="text-xs font-medium text-slate-500">{formatDate(job.createdAt)}</p>
                </div>
                <Badge className={statusTone(job.status)}>{job.status ?? 'QUEUED'}</Badge>
              </div>
            )) : (
              <EmptyState icon={Download} title="No exports yet" description="Exports triggered for payroll runs will appear here." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PayrollWorkspace;
