import * as React from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/common/data-table';
import { ErrorState } from '@/components/common/error-state';
import { BusinessPageHeader } from '@/components/common/business-page';
import { useUIStore } from '@/stores/ui-store';
import { formatCurrency } from '@/lib/utils';
import { DEFAULT_HCM_SETUP } from '@/lib/hcm-setup-defaults';
import { CalendarDays, CheckCircle2, Download, FileSpreadsheet, FileText, Landmark, RefreshCw, Trash2, Upload } from 'lucide-react';
import type { AttendancePolicy, DeductionPolicy, EarningPolicy, HcmSetupConfig, PayrollBlockingRule, WorkLocationOption } from '@/types';

function mutationError(error: unknown): string {
  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  const message = response?.data?.message ?? (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : 'Please try again.';
}

interface AttendanceSummary {
  workedMinutes: number;
  payableMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  absentDays: number;
  onDutyMinutes: number;
  geofenceViolations: number;
  source?: 'LOCKED_LEDGER' | 'RAW_ESTIMATE';
  lockedLedgerDays?: number;
  estimated?: boolean;
}

interface PayrollExplainabilityLine {
  code: string;
  label: string;
  amount: number;
  source: 'ATTENDANCE' | 'COMPENSATION' | 'POLICY' | 'EARNING';
  formula: string;
}

interface PayrollCycleRow {
  workerId: string;
  employeeId: string;
  name: string;
  email: string;
  department?: string;
  employmentType?: string;
  salaryBasis?: 'MONTHLY' | 'HOURLY';
  workLocationCode?: string;
  baseGrossSalary: number | null;
  earningAmount: number | null;
  taxableEarningAmount: number | null;
  nonTaxableEarningAmount: number | null;
  grossSalary: number | null;
  taxAmount: number | null;
  employeeInsuranceAmount: number | null;
  employerInsuranceAmount: number | null;
  policyDeductionAmount: number | null;
  netSalary: number | null;
  currency: string;
  attendanceSummary?: AttendanceSummary;
  explainability: PayrollExplainabilityLine[];
  taxIdentifier?: string;
  insuranceIdentifier?: string;
  policyAssignmentWarnings?: string[];
}

interface PayrollCyclePreview {
  id: string;
  name: string;
  year: number;
  month: number;
  calendarDays: number;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  employeeCount: number;
  totalGross: number;
  totalTax: number;
  totalEmployeeInsurance: number;
  totalEmployerInsurance: number;
  totalPolicyDeductions: number;
  totalNet: number;
  currency: string;
  rows: PayrollCycleRow[];
  readiness?: PayrollReadiness;
}

interface PayrollMassUpdateRow {
  employeeId?: string;
  workEmail?: string;
  grossSalary?: number;
  currency?: string;
  taxOverride?: number;
  insuranceOverride?: number;
  deductionCode?: string;
  deductionAmount?: number;
  effectiveMonth?: string;
}

interface PayrollMassUpdatePreview {
  accepted: boolean;
  rowCount: number;
  errors: Array<{ row: number; field: string; message: string }>;
  events: string[];
}

interface PayrollPaymentBatch {
  id?: string;
  batchId: string;
  payrollCycleId: string;
  batchNumber?: string;
  status?: 'READY' | 'BLOCKED' | 'APPROVED' | 'EXPORTED' | 'RECONCILED' | 'RECONCILIATION_EXCEPTION';
  periodStart: string;
  periodEnd: string;
  payDate: string;
  ready: boolean;
  readyCount: number;
  blockedCount: number;
  totalNet: number;
  currency: string;
  bankFileFormat?: string;
  reconciliationSummary?: Record<string, unknown>;
  payload?: {
    rows: Array<{
      employeeId: string;
      netSalary?: number;
    }>;
  };
}

interface PayrollGlPosting {
  id: string;
  postingNumber: string;
  status: 'DRAFT' | 'APPROVED' | 'POSTED';
  totalDebits: number;
  totalCredits: number;
  currency: string;
  lines: Array<{ accountCode: string; description: string; debit: number; credit: number; currency: string }>;
}

interface PayrollOffCycleRow {
  employeeId?: string;
  inputType?: 'OFF_CYCLE_EARNING' | 'RETRO_ADJUSTMENT' | 'OFF_CYCLE_DEDUCTION' | 'RETRO_DEDUCTION';
  amount?: number;
  currency?: string;
  description?: string;
}

interface PayrollBankExportResult {
  paymentBatch: PayrollPaymentBatch;
  fileName: string;
  contentType: string;
  content: string;
  rowCount: number;
}

interface CloseToPayResult {
  payrollCycleId: string;
  payrollCalculationRunId: string;
  paymentBatchId?: string;
  status: string;
  employeeCount: number;
  payrollInputCount: number;
  massUpdateInputCount?: number;
  resultLineCount: number;
  payslipArtifactCount?: number;
  periodStart: string;
  periodEnd: string;
  totalGross: number;
  totalNet: number;
  currency: string;
  bankReadyCount: number;
  bankMissingCount: number;
  readiness?: PayrollReadiness;
  events: string[];
}

interface PayrollReadinessIssue {
  code: string;
  severity: 'ERROR' | 'WARNING';
  blocking: boolean;
  message: string;
  employeeId?: string;
}

interface PayrollReadiness {
  canClose: boolean;
  blockingIssueCount: number;
  warningIssueCount: number;
  issues: PayrollReadinessIssue[];
}

function cloneSetup(setup: Partial<HcmSetupConfig>): HcmSetupConfig {
  const defaults = JSON.parse(JSON.stringify(DEFAULT_HCM_SETUP)) as HcmSetupConfig;
  const incoming = JSON.parse(JSON.stringify(setup)) as Partial<HcmSetupConfig>;
  return {
    ...defaults,
    ...incoming,
    employeeIdPolicy: {
      ...defaults.employeeIdPolicy,
      ...(incoming.employeeIdPolicy ?? {}),
    },
    payrollCalculationPolicy: {
      ...defaults.payrollCalculationPolicy,
      ...(incoming.payrollCalculationPolicy ?? {}),
    },
    statutoryPayrollPacks: incoming.statutoryPayrollPacks ?? defaults.statutoryPayrollPacks,
    salaryCompositionPlans: incoming.salaryCompositionPlans ?? defaults.salaryCompositionPlans,
    attendancePolicy: {
      ...defaults.attendancePolicy,
      ...(incoming.attendancePolicy ?? {}),
    },
    leavePolicies: incoming.leavePolicies ?? defaults.leavePolicies,
    earningPolicies: incoming.earningPolicies ?? defaults.earningPolicies,
    deductionPolicies: incoming.deductionPolicies ?? defaults.deductionPolicies,
    payrollBlockingRules: incoming.payrollBlockingRules ?? defaults.payrollBlockingRules,
  };
}

function clonePayload<T>(payload: T): T {
  return JSON.parse(JSON.stringify(payload)) as T;
}

function buildPayrollSetupUpdate(setup: HcmSetupConfig): PayrollSetupUpdate {
  return clonePayload({
    attendancePolicy: setup.attendancePolicy,
    payrollCalculationPolicy: setup.payrollCalculationPolicy,
    statutoryPayrollPacks: setup.statutoryPayrollPacks,
    salaryCompositionPlans: setup.salaryCompositionPlans,
    earningPolicies: setup.earningPolicies,
    deductionPolicies: setup.deductionPolicies,
    payrollBlockingRules: setup.payrollBlockingRules,
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseSimpleCsv(text: string): PayrollMassUpdateRow[] {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(',').map((item) => item.trim());
  return lines.filter(Boolean).map((line) => {
    const values = line.split(',').map((item) => item.trim());
    return headers.reduce<PayrollMassUpdateRow>((row, header, index) => {
      const value = values[index];
      if (!value) return row;
      if (['grossSalary', 'taxOverride', 'insuranceOverride', 'deductionAmount'].includes(header)) {
        return { ...row, [header]: Number(value) };
      }
      return { ...row, [header]: value };
    }, {});
  });
}

function deductionLabel(deduction: DeductionPolicy) {
  if (deduction.type === 'PER_MINUTE') return `${deduction.amount ?? 0} per ${deduction.attendanceEvent?.toLowerCase() ?? 'event'} minute`;
  if (deduction.type === 'PERCENT_OF_GROSS') return `${deduction.ratePercent ?? 0}% of gross`;
  return formatCurrency(deduction.amount ?? 0, 'EGP');
}

function earningLabel(earning: EarningPolicy) {
  if (earning.type === 'PER_MINUTE') return `${earning.amount ?? 0} per ${earning.attendanceEvent?.toLowerCase() ?? 'attendance'} minute`;
  if (earning.type === 'PERCENT_OF_BASE') return `${earning.ratePercent ?? 0}% of base gross`;
  return formatCurrency(earning.amount ?? 0, 'EGP');
}

function formatMinutes(totalMinutes = 0) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

function splitCsv(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

const weekdayOptions = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

type PayrollTab = 'cycle' | 'register' | 'exports' | 'policies' | 'composition' | 'attendance' | 'earnings' | 'deductions';
type PayrollSetupUpdate = Pick<
  HcmSetupConfig,
  'attendancePolicy'
  | 'payrollCalculationPolicy'
  | 'statutoryPayrollPacks'
  | 'salaryCompositionPlans'
  | 'earningPolicies'
  | 'deductionPolicies'
  | 'payrollBlockingRules'
>;

const payrollTabs: Array<{ value: PayrollTab; label: string }> = [
  { value: 'cycle', label: 'Run Payroll' },
  { value: 'register', label: 'Register' },
  { value: 'exports', label: 'Payments & Reports' },
  { value: 'policies', label: 'Payroll Rules' },
  { value: 'composition', label: 'Salary Composition' },
  { value: 'attendance', label: 'Attendance Rules' },
  { value: 'earnings', label: 'Earnings' },
  { value: 'deductions', label: 'Deductions' },
];

export function AdminPayroll() {
  const now = new Date();
  const [year, setYear] = React.useState(String(now.getFullYear()));
  const [month, setMonth] = React.useState(String(now.getMonth() + 1));
  const [workLocationCode, setWorkLocationCode] = React.useState('ALL');
  const [setup, setSetup] = React.useState<HcmSetupConfig>(() => cloneSetup(DEFAULT_HCM_SETUP));
  const [uploadedRows, setUploadedRows] = React.useState<PayrollMassUpdateRow[]>([]);
  const [uploadPreview, setUploadPreview] = React.useState<PayrollMassUpdatePreview | null>(null);
  const [closeResult, setCloseResult] = React.useState<CloseToPayResult | null>(null);
  const [readiness, setReadiness] = React.useState<PayrollReadiness | null>(null);
  const [activePayrollTab, setActivePayrollTab] = React.useState<PayrollTab>('cycle');
  const [selectedWorkerId, setSelectedWorkerId] = React.useState('');
  const [persistedBatch, setPersistedBatch] = React.useState<PayrollPaymentBatch | null>(null);
  const [showPayrollDiagnostics, setShowPayrollDiagnostics] = React.useState(false);
  const [bankFileFormat, setBankFileFormat] = React.useState<'CSV' | 'CBE_EGYPT_CSV' | 'SEPA_XML' | 'NACHA'>('CBE_EGYPT_CSV');
  const [glPosting, setGlPosting] = React.useState<PayrollGlPosting | null>(null);
  const [offCycleRows, setOffCycleRows] = React.useState<PayrollOffCycleRow[]>([
    { inputType: 'OFF_CYCLE_EARNING', currency: 'EGP', amount: 0 },
  ]);
  const [offCyclePreview, setOffCyclePreview] = React.useState<PayrollCyclePreview | null>(null);
  const [workflowMessage, setWorkflowMessage] = React.useState('');

  const addNotification = useUIStore((s) => s.addNotification);
  const { data: setupConfig, isLoading: setupLoading, isError: setupError } = useApiQuery<HcmSetupConfig>(['hcm-setup'], '/admin/hcm-setup');
  const previewUrl = `/payroll/monthly-cycle-preview?year=${year}&month=${month}${workLocationCode !== 'ALL' ? `&workLocationCode=${encodeURIComponent(workLocationCode)}` : ''}`;
  const paymentBatchUrl = `/payroll/payment-batch-preview?year=${year}&month=${month}${workLocationCode !== 'ALL' ? `&workLocationCode=${encodeURIComponent(workLocationCode)}` : ''}`;
  const glPreviewUrl = `/payroll/monthly-cycle-gl-preview?year=${year}&month=${month}${workLocationCode !== 'ALL' ? `&workLocationCode=${encodeURIComponent(workLocationCode)}` : ''}`;
  const { data: preview, isLoading: previewLoading, isError: previewError, error: previewErrorObj, refetch } = useApiQuery<PayrollCyclePreview>(
    ['payroll-monthly-preview', year, month, workLocationCode],
    previewUrl,
  );
  const { data: paymentBatch } = useApiQuery<PayrollPaymentBatch>(
    ['payroll-payment-batch', year, month, workLocationCode],
    paymentBatchUrl,
  );
  const { data: glPreview } = useApiQuery<PayrollGlPosting>(
    ['payroll-gl-preview', year, month, workLocationCode],
    glPreviewUrl,
  );

  React.useEffect(() => {
    if (setupConfig) {
      setSetup(cloneSetup(setupConfig));
    }
  }, [setupConfig]);

  React.useEffect(() => {
    setCloseResult(null);
    setWorkflowMessage('');
    setShowPayrollDiagnostics(false);
  }, [year, month, workLocationCode]);

  React.useEffect(() => {
    if (!closeResult) {
      setReadiness(preview?.readiness ?? null);
    }
  }, [preview?.readiness, closeResult]);

  React.useEffect(() => {
    if (!preview?.rows.length) {
      setSelectedWorkerId('');
      return;
    }
    if (!selectedWorkerId || !preview.rows.some((row) => row.workerId === selectedWorkerId)) {
      setSelectedWorkerId(preview.rows[0].workerId);
    }
  }, [preview?.rows, selectedWorkerId]);

  React.useEffect(() => {
    if (!closeResult?.payrollCycleId) {
      setPersistedBatch(null);
      setGlPosting(null);
      return;
    }
    let cancelled = false;
    const loadArtifacts = async () => {
      try {
        const [batchResponse, glResponse] = await Promise.allSettled([
          apiClient.get(`/payroll/cycles/${closeResult.payrollCycleId}/payment-batch`),
          apiClient.get(`/payroll/cycles/${closeResult.payrollCycleId}/gl-posting`),
        ]);
        if (cancelled) return;
        if (batchResponse.status === 'fulfilled') {
          setPersistedBatch(batchResponse.value.data.data as PayrollPaymentBatch);
        }
        if (glResponse.status === 'fulfilled') {
          setGlPosting(glResponse.value.data.data as PayrollGlPosting);
        }
      } catch {
        if (!cancelled) setWorkflowMessage('Payroll artifacts are not available yet.');
      }
    };
    void loadArtifacts();
    return () => {
      cancelled = true;
    };
  }, [closeResult?.payrollCycleId]);

  const massPreviewMutation = useApiMutation<PayrollMassUpdatePreview, { rows: PayrollMassUpdateRow[] }>(
    '/payroll/mass-update-preview',
    'post',
    undefined,
    {
      onError: (error) => addNotification({ title: 'Something went wrong', message: mutationError(error), type: 'error', read: false }),
    },
  );

  const closeToPayMutation = useApiMutation<CloseToPayResult, {
    year: number;
    month: number;
    workLocationCode?: string;
    massUpdateRows?: PayrollMassUpdateRow[];
  }>(
    '/payroll/monthly-cycle/close-to-pay',
    'post',
    [['payroll-monthly-preview', year, month, workLocationCode], ['payroll-payment-batch', year, month, workLocationCode], ['payroll-gl-preview', year, month, workLocationCode], ['employee-payslips']],
    {
      onError: (error) => addNotification({ title: 'Close to pay failed', message: mutationError(error), type: 'error', read: false }),
    },
  );

  const saveSetupMutation = useApiMutation<HcmSetupConfig, PayrollSetupUpdate>(
    '/admin/hcm-setup',
    'patch',
    [['hcm-setup'], ['payroll-monthly-preview', year, month, workLocationCode], ['payroll-payment-batch', year, month, workLocationCode], ['payroll-gl-preview', year, month, workLocationCode]],
    {
      onSuccess: () => addNotification({ title: 'Payroll rules saved', message: 'Payroll setup changes are now available for calculation previews.', type: 'success', read: false }),
      onError: (error) => addNotification({ title: 'Could not save payroll rules', message: mutationError(error), type: 'error', read: false }),
    },
  );

  const updateAttendancePolicy = (patch: Partial<AttendancePolicy>) => {
    setSetup((current) => ({
      ...current,
      attendancePolicy: { ...current.attendancePolicy, ...patch },
    }));
  };

  const updateWorkDay = (day: number, enabled: boolean) => {
    const currentDays = new Set(setup.attendancePolicy.workDays ?? [0, 1, 2, 3, 4]);
    if (enabled) {
      currentDays.add(day);
    } else {
      currentDays.delete(day);
    }
    updateAttendancePolicy({ workDays: [...currentDays].sort((left, right) => left - right) });
  };

  const updateHoliday = (index: number, patch: { date?: string; name?: string }) => {
    updateAttendancePolicy({
      holidays: (setup.attendancePolicy.holidays ?? []).map((holiday, rowIndex) => rowIndex === index ? { ...holiday, ...patch } : holiday),
    });
  };

  const updateHolidayCalendar = (index: number, patch: Partial<NonNullable<AttendancePolicy['holidayCalendars']>[number]>) => {
    updateAttendancePolicy({
      holidayCalendars: (setup.attendancePolicy.holidayCalendars ?? []).map((holiday, rowIndex) => rowIndex === index ? { ...holiday, ...patch } : holiday),
    });
  };

  const updateShiftRotation = (index: number, patch: Partial<NonNullable<AttendancePolicy['shiftRotations']>[number]>) => {
    updateAttendancePolicy({
      shiftRotations: (setup.attendancePolicy.shiftRotations ?? []).map((rule, rowIndex) => rowIndex === index ? { ...rule, ...patch } : rule),
    });
  };

  const updateGeofenceProfile = (index: number, patch: Partial<NonNullable<AttendancePolicy['geofenceProfiles']>[number]>) => {
    updateAttendancePolicy({
      geofenceProfiles: (setup.attendancePolicy.geofenceProfiles ?? []).map((profile, rowIndex) => rowIndex === index ? { ...profile, ...patch } : profile),
    });
  };

  const updateDeviceRule = (index: number, patch: Partial<NonNullable<AttendancePolicy['deviceTrustRules']>[number]>) => {
    updateAttendancePolicy({
      deviceTrustRules: (setup.attendancePolicy.deviceTrustRules ?? []).map((rule, rowIndex) => rowIndex === index ? { ...rule, ...patch } : rule),
    });
  };

  const updateFlexibleRule = (index: number, patch: Partial<NonNullable<AttendancePolicy['flexibleHoursRules']>[number]>) => {
    updateAttendancePolicy({
      flexibleHoursRules: (setup.attendancePolicy.flexibleHoursRules ?? []).map((rule, rowIndex) => rowIndex === index ? { ...rule, ...patch } : rule),
    });
  };

  const updatePayrollPolicy = (patch: Partial<HcmSetupConfig['payrollCalculationPolicy']>) => {
    setSetup((current) => ({
      ...current,
      payrollCalculationPolicy: { ...current.payrollCalculationPolicy, ...patch },
    }));
  };

  const updateTaxBracket = (
    index: number,
    patch: Partial<NonNullable<HcmSetupConfig['payrollCalculationPolicy']['taxBrackets']>[number]>,
  ) => {
    updatePayrollPolicy({
      taxBrackets: (setup.payrollCalculationPolicy.taxBrackets ?? []).map((bracket, rowIndex) => (
        rowIndex === index ? { ...bracket, ...patch } : bracket
      )),
    });
  };

  const updateStatutoryPack = (index: number, patch: Partial<HcmSetupConfig['statutoryPayrollPacks'][number]>) => {
    setSetup((current) => ({
      ...current,
      statutoryPayrollPacks: current.statutoryPayrollPacks.map((pack, rowIndex) => rowIndex === index ? { ...pack, ...patch } : pack),
    }));
  };

  const updateSalaryCompositionPlan = (index: number, patch: Partial<HcmSetupConfig['salaryCompositionPlans'][number]>) => {
    setSetup((current) => ({
      ...current,
      salaryCompositionPlans: current.salaryCompositionPlans.map((plan, rowIndex) => rowIndex === index ? { ...plan, ...patch } : plan),
    }));
  };

  const updateSalaryComponent = (
    planIndex: number,
    componentIndex: number,
    patch: Partial<HcmSetupConfig['salaryCompositionPlans'][number]['components'][number]>,
  ) => {
    setSetup((current) => ({
      ...current,
      salaryCompositionPlans: current.salaryCompositionPlans.map((plan, rowIndex) => (
        rowIndex === planIndex
          ? {
            ...plan,
            components: plan.components.map((component, nestedIndex) => (
              nestedIndex === componentIndex ? { ...component, ...patch } : component
            )),
          }
          : plan
      )),
    }));
  };

  const updateDeduction = (index: number, patch: Partial<DeductionPolicy>) => {
    setSetup((current) => ({
      ...current,
      deductionPolicies: current.deductionPolicies.map((deduction, rowIndex) => rowIndex === index ? { ...deduction, ...patch } : deduction),
    }));
  };

  const updateEarning = (index: number, patch: Partial<EarningPolicy>) => {
    setSetup((current) => ({
      ...current,
      earningPolicies: current.earningPolicies.map((earning, rowIndex) => rowIndex === index ? { ...earning, ...patch } : earning),
    }));
  };

  const updateBlockingRule = (index: number, patch: Partial<PayrollBlockingRule>) => {
    setSetup((current) => ({
      ...current,
      payrollBlockingRules: current.payrollBlockingRules.map((rule, rowIndex) => rowIndex === index ? { ...rule, ...patch } : rule),
    }));
  };

  const downloadCsv = async (url: string, filename: string) => {
    const response = await apiClient.get(url, { responseType: 'blob' });
    downloadBlob(response.data as Blob, filename);
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    const rows = parseSimpleCsv(await file.text());
    setUploadedRows(rows);
    const result = await massPreviewMutation.mutateAsync({ rows });
    setUploadPreview(result);
  };

  const downloadPayslip = async (workerId: string, employeeId: string) => {
    if (!closeResult?.payrollCycleId) return;
    const response = await apiClient.get(`/payroll/cycles/${closeResult.payrollCycleId}/payslips/${workerId}.html`, {
      responseType: 'blob',
    });
    downloadBlob(response.data as Blob, `payslip-${employeeId}-${year}-${month}.html`);
  };

  const hydratePayrollArtifacts = async (payrollCycleId = closeResult?.payrollCycleId) => {
    if (!payrollCycleId) return;
    const batchResponse = await apiClient.get(`/payroll/cycles/${payrollCycleId}/payment-batch`);
    setPersistedBatch(batchResponse.data.data as PayrollPaymentBatch);
    try {
      const glResponse = await apiClient.get(`/payroll/cycles/${payrollCycleId}/gl-posting`);
      setGlPosting(glResponse.data.data as PayrollGlPosting);
    } catch {
      setGlPosting(null);
    }
  };

  const approvePersistedBatch = async () => {
    if (!persistedBatch?.id) return;
    const response = await apiClient.post(`/payroll/payment-batches/${persistedBatch.id}/approve`, {});
    setPersistedBatch(response.data.data as PayrollPaymentBatch);
    setWorkflowMessage('Payment batch approved.');
  };

  const exportPersistedBatch = async () => {
    if (!persistedBatch?.id) return;
    const response = await apiClient.post(`/payroll/payment-batches/${persistedBatch.id}/export`, { format: bankFileFormat });
    const result = response.data.data as PayrollBankExportResult;
    setPersistedBatch(result.paymentBatch);
    downloadBlob(new Blob([result.content], { type: result.contentType }), result.fileName);
    setWorkflowMessage(`${result.rowCount} bank payment rows exported.`);
  };

  const reconcilePersistedBatch = async () => {
    if (!persistedBatch?.id || !persistedBatch.payload?.rows?.length) return;
    const response = await apiClient.post(`/payroll/payment-batches/${persistedBatch.id}/reconcile`, {
      rows: persistedBatch.payload.rows.map((row: { employeeId: string; netSalary?: number }) => ({
        employeeId: row.employeeId,
        amount: row.netSalary ?? 0,
        status: 'SETTLED',
        bankReference: `SIM-${row.employeeId}-${Date.now()}`,
      })),
    });
    setPersistedBatch(response.data.data as PayrollPaymentBatch);
    setWorkflowMessage('Bank reconciliation posted as settled.');
  };

  const publishPayslips = async () => {
    if (!closeResult?.payrollCycleId) return;
    const response = await apiClient.post(`/payroll/cycles/${closeResult.payrollCycleId}/payslips/publish`, {});
    setWorkflowMessage(`${response.data.data.publishedCount} payslips published.`);
    await hydratePayrollArtifacts();
  };

  const createGlPosting = async () => {
    if (!closeResult?.payrollCycleId) return;
    const response = await apiClient.post(`/payroll/cycles/${closeResult.payrollCycleId}/gl-posting`, {});
    setGlPosting(response.data.data as PayrollGlPosting);
    setWorkflowMessage('GL posting generated and balanced.');
  };

  const updateOffCycleRow = (index: number, patch: Partial<PayrollOffCycleRow>) => {
    setOffCycleRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  };

  const previewOffCycleRows = async () => {
    const response = await apiClient.post('/payroll/off-cycle-preview', {
      year: Number(year),
      month: Number(month),
      workLocationCode: workLocationCode !== 'ALL' ? workLocationCode : undefined,
      rows: offCycleRows.filter((row) => row.employeeId && row.amount && row.amount > 0),
    });
    setOffCyclePreview(response.data.data.preview as PayrollCyclePreview);
    setWorkflowMessage('Off-cycle and retro preview calculated.');
  };

  const closeToPay = async () => {
    try {
      const result = await closeToPayMutation.mutateAsync({
        year: Number(year),
        month: Number(month),
        workLocationCode: workLocationCode !== 'ALL' ? workLocationCode : undefined,
        massUpdateRows: uploadPreview?.accepted ? uploadedRows : undefined,
      });
      setCloseResult(result);
      setReadiness(result.readiness ?? null);
      setWorkflowMessage('Payroll closed to pay and artifacts generated.');
      addNotification({ title: 'Payroll closed to pay', message: 'Payroll closed and artifacts generated.', type: 'success', read: false });
      await hydratePayrollArtifacts(result.payrollCycleId);
    } catch (error) {
      const response = (error as { response?: { data?: { readiness?: PayrollReadiness; message?: { readiness?: PayrollReadiness } } } }).response;
      setReadiness(response?.data?.readiness ?? response?.data?.message?.readiness ?? null);
    }
  };

  const locations = setup.locations.filter((location): location is WorkLocationOption => location.active);
  const rows = preview?.rows ?? [];
  const currency = preview?.currency ?? setup.locations[0]?.currency ?? 'EGP';
  const selectedPayrollRow = rows.find((row) => row.workerId === selectedWorkerId) ?? rows[0];
  const tabClass = (tab: PayrollTab, className: string) => activePayrollTab === tab ? className : 'hidden';
  const isRuleTab = activePayrollTab === 'policies'
    || activePayrollTab === 'composition'
    || activePayrollTab === 'attendance'
    || activePayrollTab === 'earnings'
    || activePayrollTab === 'deductions';
  const canSaveRules = Boolean(setupConfig) && !setupLoading && !setupError && !saveSetupMutation.isPending;

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      cell: (row: PayrollCycleRow) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    { key: 'department', header: 'Department', cell: (row: PayrollCycleRow) => row.department || '-' },
    {
      key: 'attendance',
      header: 'Attendance',
      cell: (row: PayrollCycleRow) => (
        <div className="space-y-1 text-xs">
          <p>{formatMinutes(row.attendanceSummary?.payableMinutes)} payable</p>
          <p className="text-muted-foreground">
            Late {row.attendanceSummary?.lateMinutes ?? 0}m · Under {row.attendanceSummary?.undertimeMinutes ?? 0}m
          </p>
        </div>
      ),
    },
    { key: 'baseGross', header: 'Base Gross', cell: (row: PayrollCycleRow) => row.baseGrossSalary === null ? 'Masked' : formatCurrency(row.baseGrossSalary, row.currency) },
    { key: 'earnings', header: 'Earnings', cell: (row: PayrollCycleRow) => row.earningAmount === null ? 'Masked' : formatCurrency(row.earningAmount, row.currency) },
    { key: 'gross', header: 'Gross', cell: (row: PayrollCycleRow) => row.grossSalary === null ? 'Masked' : formatCurrency(row.grossSalary, row.currency) },
    { key: 'tax', header: 'Tax', cell: (row: PayrollCycleRow) => row.taxAmount === null ? 'Masked' : formatCurrency(row.taxAmount, row.currency) },
    { key: 'insurance', header: 'Insurance', cell: (row: PayrollCycleRow) => row.employeeInsuranceAmount === null ? 'Masked' : formatCurrency(row.employeeInsuranceAmount, row.currency) },
    { key: 'deductions', header: 'Policy Deductions', cell: (row: PayrollCycleRow) => row.policyDeductionAmount === null ? 'Masked' : formatCurrency(row.policyDeductionAmount, row.currency) },
    { key: 'net', header: 'Net', cell: (row: PayrollCycleRow) => row.netSalary === null ? 'Masked' : <strong>{formatCurrency(row.netSalary, row.currency)}</strong> },
  ];

  return (
    <div className="min-h-full">
      <div className="px-6 py-5">
        <BusinessPageHeader
          eyebrow="Reward Operations"
          icon={CalendarDays}
          title="Payroll"
          subtitle="Run payroll, review exceptions, prepare payments, and publish payslips."
          actions={(
            <>
              <Button onClick={() => closeToPay()} disabled={closeToPayMutation.isPending || previewLoading || rows.length === 0}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {closeToPayMutation.isPending ? 'Closing...' : 'Close to Pay'}
              </Button>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              {isRuleTab ? (
                <Button variant="outline" onClick={() => saveSetupMutation.mutate(buildPayrollSetupUpdate(setup))} disabled={!canSaveRules}>
                  {saveSetupMutation.isPending ? 'Saving...' : setupLoading ? 'Loading rules...' : 'Save Rules'}
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link to="/admin/system-console/policies">Payroll Rules</Link>
              </Button>
            </>
          )}
        />
      </div>

      <Tabs value={activePayrollTab} onValueChange={(value) => setActivePayrollTab(value as PayrollTab)}>
        <div className="fusion-glass sticky top-0 z-10 mx-6 rounded-2xl px-4 py-2">
          <TabsList className="h-auto flex-wrap justify-start bg-transparent p-0">
            {payrollTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-[#6366f1] data-[state=active]:bg-transparent data-[state=active]:text-[#6366f1] data-[state=active]:shadow-none"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <main className="px-6 pb-6">
      <section id="payroll-cycle" className={tabClass('cycle', 'fusion-glass mt-6 grid gap-4 rounded-[2rem] p-6 md:grid-cols-4')}>
        <div className="grid gap-2">
          <Label>Year</Label>
          <Input value={year} onChange={(event) => setYear(event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Month</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, index) => (
                <SelectItem key={index + 1} value={String(index + 1)}>
                  {new Date(2026, index, 1).toLocaleString('en-US', { month: 'long' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Workplace</Label>
          <Select value={workLocationCode} onValueChange={setWorkLocationCode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All workplaces</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.code} value={location.code}>{location.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Payroll Sheet</Label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => downloadCsv(`/payroll/export.csv?year=${year}&month=${month}${workLocationCode !== 'ALL' ? `&workLocationCode=${workLocationCode}` : ''}`, `payroll-${year}-${month}.csv`)}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => downloadCsv(`/payroll/bank-sheet.csv?year=${year}&month=${month}${workLocationCode !== 'ALL' ? `&workLocationCode=${workLocationCode}` : ''}`, `bank-sheet-${year}-${month}.csv`)}
            >
              <Landmark className="mr-2 h-4 w-4" />
              Bank
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => downloadCsv('/payroll/mass-update-template.csv', 'payroll-template.csv')}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Template
            </Button>
          </div>
        </div>
      </section>

      <section className={tabClass('cycle', 'fusion-glass mt-4 grid gap-4 rounded-[2rem] p-6 md:grid-cols-5')}>
        <div>
          <p className="text-xs text-muted-foreground">Cycle</p>
          <p className="font-semibold">{preview?.name ?? 'Loading cycle'}</p>
          <p className="text-xs text-muted-foreground">{preview?.periodStart} to {preview?.periodEnd}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Calendar Days</p>
          <p className="text-xl font-semibold">{preview?.calendarDays ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Employees</p>
          <p className="text-xl font-semibold">{preview?.employeeCount ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Gross</p>
          <p className="text-xl font-semibold">{formatCurrency(preview?.totalGross ?? 0, currency)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Net</p>
          <p className="text-xl font-semibold">{formatCurrency(preview?.totalNet ?? 0, currency)}</p>
        </div>
      </section>

      {paymentBatch ? (
        <section className={tabClass('cycle', 'fusion-glass mt-4 grid gap-4 rounded-[2rem] p-6 md:grid-cols-4')}>
          <div>
            <p className="text-xs text-muted-foreground">Payment Batch</p>
            <p className="font-semibold">{paymentBatch.ready ? 'Ready for bank review' : 'Needs attention'}</p>
            <Badge variant={paymentBatch.ready ? 'default' : 'secondary'}>{paymentBatch.ready ? 'Ready' : 'Blocked'}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Bank Ready</p>
            <p className="text-xl font-semibold">{paymentBatch.readyCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Blocked</p>
            <p className={paymentBatch.blockedCount > 0 ? 'text-xl font-semibold text-amber-600' : 'text-xl font-semibold'}>
              {paymentBatch.blockedCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Net</p>
            <p className="text-xl font-semibold">{formatCurrency(paymentBatch.totalNet, paymentBatch.currency)}</p>
          </div>
        </section>
      ) : null}

      {closeResult ? (
        <section className={tabClass('cycle', 'fusion-glass mt-4 grid gap-4 rounded-[2rem] p-6 md:grid-cols-4 xl:grid-cols-7')}>
          <div>
            <p className="text-xs text-muted-foreground">Closed Cycle</p>
            <p className="font-semibold">{closeResult.status}</p>
            <p className="text-xs text-muted-foreground">{closeResult.periodStart} to {closeResult.periodEnd}</p>
          </div>
          <div>
          <p className="text-xs text-muted-foreground">Payment Batch</p>
          <p className="font-semibold">{closeResult.paymentBatchId ? 'Created' : 'Pending setup'}</p>
          <p className="text-xs text-muted-foreground">{closeResult.paymentBatchId ? 'Ready for payments workflow' : 'Batch will be created after close'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Approved Inputs</p>
            <p className="text-xl font-semibold">{closeResult.payrollInputCount}</p>
            <p className="text-xs text-muted-foreground">{closeResult.massUpdateInputCount ?? 0} from upload</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Locked Result Lines</p>
            <p className="text-xl font-semibold">{closeResult.resultLineCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payslips</p>
            <p className="text-xl font-semibold">{closeResult.payslipArtifactCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">ready to publish</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Bank Ready</p>
            <p className="text-xl font-semibold">{closeResult.bankReadyCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Bank Missing</p>
            <p className={closeResult.bankMissingCount > 0 ? 'text-xl font-semibold text-amber-600' : 'text-xl font-semibold'}>
              {closeResult.bankMissingCount}
            </p>
          </div>
        </section>
      ) : null}

      {(closeResult || paymentBatch) ? (
        <section className={tabClass('cycle', 'fusion-glass mt-4 rounded-[2rem] p-4')}>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowPayrollDiagnostics((current) => !current)}>
            Diagnostics
          </Button>
          {showPayrollDiagnostics ? (
            <div className="mt-3 grid gap-3 text-xs text-muted-foreground md:grid-cols-2">
              {paymentBatch ? (
                <div className="rounded-md border bg-white p-3">
                  <p className="font-semibold text-foreground">Payment preview</p>
                  <p className="font-mono">Batch ID: {paymentBatch.batchId}</p>
                  <p className="font-mono">Cycle ID: {paymentBatch.payrollCycleId}</p>
                </div>
              ) : null}
              {closeResult ? (
                <div className="rounded-md border bg-white p-3">
                  <p className="font-semibold text-foreground">Closed payroll</p>
                  <p className="font-mono">Cycle ID: {closeResult.payrollCycleId}</p>
                  <p className="font-mono">Payment batch ID: {closeResult.paymentBatchId ?? 'Pending'}</p>
                  <p className="font-mono">Calculation run ID: {closeResult.payrollCalculationRunId}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {readiness && !readiness.canClose ? (
        <section className={tabClass('cycle', 'fusion-glass mt-4 space-y-3 rounded-[2rem] p-6')}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-semibold text-destructive">Payroll readiness blockers</p>
              <p className="text-sm text-muted-foreground">
                {readiness.blockingIssueCount} blocking issues must be fixed before close-to-pay.
              </p>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {readiness.issues.map((issue, index) => (
              <div key={`${issue.code}-${issue.employeeId ?? 'cycle'}-${index}`} className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <strong>{issue.code}</strong>
                  <Badge variant={issue.blocking ? 'destructive' : 'secondary'}>{issue.severity}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{issue.message}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className={activePayrollTab === 'cycle' ? 'hidden' : 'space-y-6 py-6'}>
        <section className="space-y-6">
          <Card id="payroll-register" className={tabClass('register', '')}>
            <CardHeader>
              <CardTitle className="text-lg">Payroll Register</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {previewError ? (
                <ErrorState error={previewErrorObj} onRetry={() => refetch()} />
              ) : (
                <DataTable
                  columns={columns}
                  data={rows}
                  keyExtractor={(row) => row.workerId}
                  isLoading={previewLoading}
                  emptyMessage="No employees found for this payroll cycle"
                />
              )}
              <div className="grid gap-4 rounded-md border bg-slate-50 p-4 lg:grid-cols-[18rem_1fr]">
                <div className="space-y-2">
                  <Label>Net Salary Calculator</Label>
                  <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId} disabled={rows.length === 0}>
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      {rows.map((row) => (
                        <SelectItem key={row.workerId} value={row.workerId}>{row.name} - {row.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Review the selected employee's pay components for this cycle.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!closeResult?.payrollCycleId || !selectedPayrollRow}
                    onClick={() => selectedPayrollRow && downloadPayslip(selectedPayrollRow.workerId, selectedPayrollRow.employeeId)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Payslip
                  </Button>
                </div>
                {selectedPayrollRow ? (
                  <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
                    <div>
                      <p className="text-xs text-muted-foreground">Base</p>
                      <p className="font-semibold">{selectedPayrollRow.baseGrossSalary === null ? 'Masked' : formatCurrency(selectedPayrollRow.baseGrossSalary, selectedPayrollRow.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Earnings</p>
                      <p className="font-semibold">{selectedPayrollRow.earningAmount === null ? 'Masked' : formatCurrency(selectedPayrollRow.earningAmount, selectedPayrollRow.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Taxable Earn.</p>
                      <p className="font-semibold">{selectedPayrollRow.taxableEarningAmount === null ? 'Masked' : formatCurrency(selectedPayrollRow.taxableEarningAmount, selectedPayrollRow.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Non-tax Earn.</p>
                      <p className="font-semibold">{selectedPayrollRow.nonTaxableEarningAmount === null ? 'Masked' : formatCurrency(selectedPayrollRow.nonTaxableEarningAmount, selectedPayrollRow.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Gross</p>
                      <p className="font-semibold">{selectedPayrollRow.grossSalary === null ? 'Masked' : formatCurrency(selectedPayrollRow.grossSalary, selectedPayrollRow.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tax</p>
                      <p className="font-semibold">{selectedPayrollRow.taxAmount === null ? 'Masked' : formatCurrency(selectedPayrollRow.taxAmount, selectedPayrollRow.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Insurance</p>
                      <p className="font-semibold">{selectedPayrollRow.employeeInsuranceAmount === null ? 'Masked' : formatCurrency(selectedPayrollRow.employeeInsuranceAmount, selectedPayrollRow.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Deductions</p>
                      <p className="font-semibold">{selectedPayrollRow.policyDeductionAmount === null ? 'Masked' : formatCurrency(selectedPayrollRow.policyDeductionAmount, selectedPayrollRow.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Net</p>
                      <p className="font-semibold text-[#6366f1]">{selectedPayrollRow.netSalary === null ? 'Masked' : formatCurrency(selectedPayrollRow.netSalary, selectedPayrollRow.currency)}</p>
                    </div>
                    <div className="md:col-span-4 xl:col-span-8">
                      {selectedPayrollRow.policyAssignmentWarnings?.length ? (
                        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                          {selectedPayrollRow.policyAssignmentWarnings.join(', ')}
                        </div>
                      ) : null}
                      <div className="grid gap-2 md:grid-cols-2">
                        {selectedPayrollRow.explainability.map((line) => (
                          <div key={`${line.code}-${line.formula}`} className="fusion-glass rounded-xl p-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <strong>{line.label}</strong>
                              <span>{formatCurrency(line.amount, selectedPayrollRow.currency)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card id="payroll-exports" className={tabClass('exports', '')}>
            <CardHeader>
              <CardTitle className="text-lg">Payments & Reports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Label className="inline-flex cursor-pointer items-center rounded-md border px-4 py-2 text-sm font-medium">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload CSV
                  <Input className="hidden" type="file" accept=".csv,text/csv" onChange={(event) => handleUpload(event.target.files?.[0])} />
                </Label>
                {uploadPreview ? (
                  <Badge variant={uploadPreview.accepted ? 'default' : 'destructive'}>
                    {uploadPreview.accepted ? `${uploadPreview.rowCount} rows accepted` : `${uploadPreview.errors.length} validation errors`}
                  </Badge>
                ) : null}
                {uploadPreview?.accepted ? (
                  <Badge variant="secondary">Included in next close-to-pay run</Badge>
                ) : null}
              </div>
              {paymentBatch ? (
                <div className="grid gap-3 rounded-md border bg-slate-50 p-3 md:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Payment Batch</p>
                    <p className="font-semibold">{paymentBatch.ready ? 'Ready for bank review' : 'Needs attention'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ready Transfers</p>
                    <p className="font-semibold">{paymentBatch.readyCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Blocked Transfers</p>
                    <p className={paymentBatch.blockedCount ? 'font-semibold text-amber-600' : 'font-semibold'}>{paymentBatch.blockedCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Net Payroll</p>
                    <p className="font-semibold">{formatCurrency(paymentBatch.totalNet, paymentBatch.currency)}</p>
                  </div>
                </div>
              ) : null}
              {glPreview && !closeResult?.paymentBatchId ? (
                <div className="space-y-3 rounded-md border bg-slate-50 p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold">GL Preview</p>
                      <p className="text-xs text-muted-foreground">Balanced journal preview for the selected payroll period.</p>
                    </div>
                    <Badge variant={glPreview.totalDebits === glPreview.totalCredits ? 'default' : 'destructive'}>
                      {glPreview.totalDebits === glPreview.totalCredits ? 'Balanced' : 'Out of balance'}
                    </Badge>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {glPreview.lines.map((line) => (
                      <div key={`${line.accountCode}-${line.description}`} className="rounded-md border bg-white p-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{line.accountCode}</span>
                          <span>{formatCurrency(line.debit || line.credit, line.currency)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{line.description}</p>
                        <p className="text-xs text-muted-foreground">{line.debit > 0 ? 'Debit' : 'Credit'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {closeResult?.paymentBatchId ? (
                <div className="fusion-glass space-y-3 rounded-2xl p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-semibold">Enterprise payment workflow</p>
                      <p className="text-xs text-muted-foreground">
                        Batch approval, bank file export, reconciliation, payslip publication, and GL handoff.
                      </p>
                    </div>
                    <Badge variant={persistedBatch?.status === 'RECONCILED' ? 'default' : 'secondary'}>
                      {persistedBatch?.status ?? 'Loading'}
                    </Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Batch</p>
                      <p className="font-semibold">{persistedBatch?.batchNumber ?? persistedBatch?.status ?? 'Created'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Net to Bank</p>
                      <p className="font-semibold">{formatCurrency(persistedBatch?.totalNet ?? closeResult.totalNet, persistedBatch?.currency ?? closeResult.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">GL Posting</p>
                      <p className="font-semibold">{glPosting ? `${glPosting.postingNumber} ${glPosting.status}` : 'Not generated'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className={glPosting && glPosting.totalDebits === glPosting.totalCredits ? 'font-semibold text-emerald-700' : 'font-semibold'}>
                        {glPosting ? `${formatCurrency(glPosting.totalDebits, glPosting.currency)} / ${formatCurrency(glPosting.totalCredits, glPosting.currency)}` : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <Button type="button" variant="outline" disabled={!persistedBatch?.id || persistedBatch.status !== 'READY'} onClick={approvePersistedBatch}>
                      Approve Batch
                    </Button>
                    <div className="grid gap-1">
                      <Label className="text-xs">Bank format</Label>
                      <Select value={bankFileFormat} onValueChange={(value) => setBankFileFormat(value as typeof bankFileFormat)}>
                        <SelectTrigger className="w-[12rem]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CSV">CSV</SelectItem>
                          <SelectItem value="CBE_EGYPT_CSV">CBE Egypt CSV</SelectItem>
                          <SelectItem value="SEPA_XML">SEPA XML</SelectItem>
                          <SelectItem value="NACHA">NACHA</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" variant="outline" disabled={!persistedBatch?.id || persistedBatch.status !== 'APPROVED'} onClick={exportPersistedBatch}>
                      Export Bank File
                    </Button>
                    <Button type="button" variant="outline" disabled={!persistedBatch?.id || persistedBatch.status !== 'EXPORTED'} onClick={reconcilePersistedBatch}>
                      Reconcile Settled
                    </Button>
                    <Button type="button" variant="outline" disabled={!closeResult.payrollCycleId} onClick={publishPayslips}>
                      Publish Payslips
                    </Button>
                    <Button type="button" variant="outline" disabled={!closeResult.payrollCycleId} onClick={createGlPosting}>
                      Build GL Posting
                    </Button>
                  </div>
                  {workflowMessage ? <p className="text-sm text-muted-foreground">{workflowMessage}</p> : null}
                </div>
              ) : null}
              <div className="space-y-3 rounded-md border bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Off-cycle and retro preview</p>
                    <p className="text-xs text-muted-foreground">Preview governed earning or deduction adjustments before they enter the payroll input lifecycle.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOffCycleRows((current) => [...current, { inputType: 'RETRO_ADJUSTMENT', currency }])}
                  >
                    Add Row
                  </Button>
                </div>
                {offCycleRows.map((row, index) => (
                  <div key={`off-cycle-${index}`} className="grid gap-2 md:grid-cols-[1fr_12rem_9rem_7rem_2rem]">
                    <Input value={row.employeeId ?? ''} placeholder="Employee number" onChange={(event) => updateOffCycleRow(index, { employeeId: event.target.value })} />
                    <Select value={row.inputType ?? 'OFF_CYCLE_EARNING'} onValueChange={(value) => updateOffCycleRow(index, { inputType: value as PayrollOffCycleRow['inputType'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OFF_CYCLE_EARNING">Off-cycle earning</SelectItem>
                        <SelectItem value="RETRO_ADJUSTMENT">Retro adjustment</SelectItem>
                        <SelectItem value="OFF_CYCLE_DEDUCTION">Off-cycle deduction</SelectItem>
                        <SelectItem value="RETRO_DEDUCTION">Retro deduction</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" value={row.amount ?? ''} placeholder="Amount" onChange={(event) => updateOffCycleRow(index, { amount: Number(event.target.value || 0) })} />
                    <Input value={row.currency ?? currency} placeholder="Currency" onChange={(event) => updateOffCycleRow(index, { currency: event.target.value.toUpperCase() })} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setOffCycleRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" onClick={previewOffCycleRows}>Preview Off-cycle</Button>
                  {offCyclePreview ? (
                    <span className="text-sm text-muted-foreground">
                      Projected net {formatCurrency(offCyclePreview.totalNet, offCyclePreview.currency)} for {offCyclePreview.employeeCount} employees.
                    </span>
                  ) : null}
                </div>
              </div>
              {uploadPreview && uploadPreview.errors.length > 0 ? (
                <div className="divide-y border-y text-sm">
                  {uploadPreview.errors.map((error) => (
                    <div key={`${error.row}-${error.field}-${error.message}`} className="grid gap-3 py-2 md:grid-cols-[5rem_10rem_1fr]">
                      <span>Row {error.row}</span>
                      <span className="text-muted-foreground">{error.field}</span>
                      <span>{error.message}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6">
          <Card id="payroll-composition" className={tabClass('composition', '')}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Salary Composition</CardTitle>
                  <CardDescription>Define the salary items employees see on payslips.</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSetup((current) => ({
                    ...current,
                    salaryCompositionPlans: [...current.salaryCompositionPlans, {
                      code: `SALARY_PLAN_${Date.now().toString().slice(-5)}`,
                      label: 'New salary structure',
                      active: true,
                      countryCode: 'EG',
                      currency,
                      locationCodes: locations[0]?.code ? [locations[0].code] : [],
                      employeeTypes: ['FULL_TIME'],
                      components: [
                        {
                          code: 'BASIC_SALARY',
                          label: 'Basic salary',
                          active: true,
                          componentType: 'BASIC',
                          valueType: 'REMAINDER_OF_GROSS',
                          taxable: true,
                          insurable: true,
                          includedInGross: true,
                          displayOnPayslip: true,
                          priority: 10,
                          payslipLineType: 'GROSS',
                        },
                      ],
                    }],
                  }))}
                >
                  Add Plan
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {setup.salaryCompositionPlans.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Add a salary structure to split gross pay into payslip items such as basic salary, housing, transport, or flexible allowance.
                </div>
              ) : null}
              {setup.salaryCompositionPlans.map((plan, planIndex) => (
                <div key={`${plan.code}-${planIndex}`} className="space-y-4 rounded-lg border p-4">
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="grid gap-2">
                      <Label>Plan Name</Label>
                      <Input value={plan.label} onChange={(event) => updateSalaryCompositionPlan(planIndex, { label: event.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Code</Label>
                      <Input value={plan.code} onChange={(event) => updateSalaryCompositionPlan(planIndex, { code: event.target.value.toUpperCase() })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Status</Label>
                      <Select value={plan.active ? 'ACTIVE' : 'INACTIVE'} onValueChange={(value) => updateSalaryCompositionPlan(planIndex, { active: value === 'ACTIVE' })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="INACTIVE">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Country</Label>
                      <Input value={plan.countryCode ?? ''} onChange={(event) => updateSalaryCompositionPlan(planIndex, { countryCode: event.target.value.toUpperCase() || undefined })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Currency</Label>
                      <Input value={plan.currency ?? ''} onChange={(event) => updateSalaryCompositionPlan(planIndex, { currency: event.target.value.toUpperCase() || undefined })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Workplaces</Label>
                      <Input value={(plan.locationCodes ?? []).join(',')} onChange={(event) => updateSalaryCompositionPlan(planIndex, { locationCodes: splitCsv(event.target.value) })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Employee Types</Label>
                      <Input value={(plan.employeeTypes ?? []).join(',')} onChange={(event) => updateSalaryCompositionPlan(planIndex, { employeeTypes: splitCsv(event.target.value) })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Departments</Label>
                      <Input value={(plan.departmentCodes ?? []).join(',')} onChange={(event) => updateSalaryCompositionPlan(planIndex, { departmentCodes: splitCsv(event.target.value) })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Workers</Label>
                      <Input value={(plan.workerIds ?? []).join(',')} onChange={(event) => updateSalaryCompositionPlan(planIndex, { workerIds: splitCsv(event.target.value) })} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Components</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateSalaryCompositionPlan(planIndex, {
                          components: [...plan.components, {
                            code: `COMPONENT_${Date.now().toString().slice(-5)}`,
                            label: 'New component',
                            active: true,
                            componentType: 'ALLOWANCE',
                            valueType: 'PERCENT_OF_GROSS',
                            ratePercent: 0,
                            taxable: true,
                            insurable: false,
                            includedInGross: true,
                            displayOnPayslip: true,
                            priority: (plan.components.length + 1) * 10,
                            payslipLineType: 'GROSS',
                          }],
                        })}
                      >
                        Add Component
                      </Button>
                    </div>
                    {plan.components.map((component, componentIndex) => (
                      <div key={`${component.code}-${componentIndex}`} className="grid gap-2 rounded-md border-t pt-3 first:border-t-0 first:pt-0 md:grid-cols-4">
                        <Input value={component.label} placeholder="Component name" onChange={(event) => updateSalaryComponent(planIndex, componentIndex, { label: event.target.value })} />
                        <Input value={component.code} placeholder="Code" onChange={(event) => updateSalaryComponent(planIndex, componentIndex, { code: event.target.value.toUpperCase() })} />
                        <Select value={component.componentType} onValueChange={(value) => updateSalaryComponent(planIndex, componentIndex, { componentType: value as HcmSetupConfig['salaryCompositionPlans'][number]['components'][number]['componentType'] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BASIC">Basic</SelectItem>
                            <SelectItem value="ALLOWANCE">Allowance</SelectItem>
                            <SelectItem value="BENEFIT">Benefit</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={component.valueType} onValueChange={(value) => updateSalaryComponent(planIndex, componentIndex, { valueType: value as HcmSetupConfig['salaryCompositionPlans'][number]['components'][number]['valueType'] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PERCENT_OF_GROSS">% of gross</SelectItem>
                            <SelectItem value="FIXED_AMOUNT">Fixed amount</SelectItem>
                            <SelectItem value="REMAINDER_OF_GROSS">Remainder</SelectItem>
                          </SelectContent>
                        </Select>
                        {component.valueType === 'PERCENT_OF_GROSS' ? (
                          <Input type="number" value={component.ratePercent ?? ''} placeholder="Rate %" onChange={(event) => updateSalaryComponent(planIndex, componentIndex, { ratePercent: Number(event.target.value || 0) })} />
                        ) : component.valueType === 'FIXED_AMOUNT' ? (
                          <Input type="number" value={component.amount ?? ''} placeholder="Amount" onChange={(event) => updateSalaryComponent(planIndex, componentIndex, { amount: Number(event.target.value || 0) })} />
                        ) : (
                          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-muted-foreground">Uses remaining gross pay</div>
                        )}
                        <Input type="number" value={component.priority ?? ''} placeholder="Sort order" onChange={(event) => updateSalaryComponent(planIndex, componentIndex, { priority: event.target.value ? Number(event.target.value) : undefined })} />
                        <Input value={component.glAccount ?? ''} placeholder="GL account" onChange={(event) => updateSalaryComponent(planIndex, componentIndex, { glAccount: event.target.value || undefined })} />
                        <Input value={component.payslipLineType ?? 'GROSS'} placeholder="Payslip group" onChange={(event) => updateSalaryComponent(planIndex, componentIndex, { payslipLineType: event.target.value.toUpperCase() || 'GROSS' })} />
                        <div className="flex flex-wrap items-center gap-3 text-sm md:col-span-3">
                          <label className="flex items-center gap-2">
                            <Input type="checkbox" className="h-4 w-4" checked={component.active} onChange={(event) => updateSalaryComponent(planIndex, componentIndex, { active: event.target.checked })} />
                            Active
                          </label>
                          <label className="flex items-center gap-2">
                            <Input type="checkbox" className="h-4 w-4" checked={component.taxable ?? false} onChange={(event) => updateSalaryComponent(planIndex, componentIndex, { taxable: event.target.checked })} />
                            Taxable
                          </label>
                          <label className="flex items-center gap-2">
                            <Input type="checkbox" className="h-4 w-4" checked={component.insurable ?? false} onChange={(event) => updateSalaryComponent(planIndex, componentIndex, { insurable: event.target.checked })} />
                            Insurance base
                          </label>
                          <label className="flex items-center gap-2">
                            <Input type="checkbox" className="h-4 w-4" checked={component.displayOnPayslip !== false} onChange={(event) => updateSalaryComponent(planIndex, componentIndex, { displayOnPayslip: event.target.checked })} />
                            Show on payslip
                          </label>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => updateSalaryCompositionPlan(planIndex, { components: plan.components.filter((_, rowIndex) => rowIndex !== componentIndex) })}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSetup((current) => ({ ...current, salaryCompositionPlans: current.salaryCompositionPlans.filter((_, rowIndex) => rowIndex !== planIndex) }))}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove Plan
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card id="payroll-policies" className={tabClass('policies', '')}>
            <CardHeader>
              <CardTitle className="text-lg">Gross-to-Net Policy</CardTitle>
              <CardDescription>Statutory percentages used by payroll calculations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                <Label>Tax Engine</Label>
                <Select
                  value={setup.payrollCalculationPolicy.taxMode ?? 'FLAT_PERCENT'}
                  onValueChange={(value) => updatePayrollPolicy({ taxMode: value as HcmSetupConfig['payrollCalculationPolicy']['taxMode'] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FLAT_PERCENT">Flat percent</SelectItem>
                    <SelectItem value="PROGRESSIVE_BRACKETS">Progressive brackets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Tax %</Label>
                <Input type="number" value={setup.payrollCalculationPolicy.taxRatePercent} onChange={(event) => updatePayrollPolicy({ taxRatePercent: Number(event.target.value || 0) })} />
              </div>
              <div className="grid gap-2">
                <Label>Employee Insurance %</Label>
                <Input type="number" value={setup.payrollCalculationPolicy.employeeInsuranceRatePercent} onChange={(event) => updatePayrollPolicy({ employeeInsuranceRatePercent: Number(event.target.value || 0) })} />
              </div>
              <div className="grid gap-2">
                <Label>Employee Insurance Cap</Label>
                <Input type="number" value={setup.payrollCalculationPolicy.employeeInsuranceCap ?? ''} onChange={(event) => updatePayrollPolicy({ employeeInsuranceCap: event.target.value ? Number(event.target.value) : undefined })} />
              </div>
              <div className="grid gap-2">
                <Label>Employer Insurance %</Label>
                <Input type="number" value={setup.payrollCalculationPolicy.employerInsuranceRatePercent ?? ''} onChange={(event) => updatePayrollPolicy({ employerInsuranceRatePercent: event.target.value ? Number(event.target.value) : undefined })} />
              </div>
              <div className="grid gap-2">
                <Label>Employer Insurance Cap</Label>
                <Input type="number" value={setup.payrollCalculationPolicy.employerInsuranceCap ?? ''} onChange={(event) => updatePayrollPolicy({ employerInsuranceCap: event.target.value ? Number(event.target.value) : undefined })} />
              </div>
              {setup.payrollCalculationPolicy.taxMode === 'PROGRESSIVE_BRACKETS' ? (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Tax Brackets</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updatePayrollPolicy({
                        taxBrackets: [...(setup.payrollCalculationPolicy.taxBrackets ?? []), {
                          code: `BRACKET_${Date.now().toString().slice(-5)}`,
                          label: 'New bracket',
                          thresholdFrom: 0,
                          ratePercent: 0,
                        }],
                      })}
                    >
                      Add Bracket
                    </Button>
                  </div>
                  {(setup.payrollCalculationPolicy.taxBrackets ?? []).map((bracket, index) => (
                    <div key={`${bracket.code}-${index}`} className="grid grid-cols-2 gap-2 border-t pt-3 first:border-t-0 first:pt-0">
                      <Input value={bracket.code} onChange={(event) => updateTaxBracket(index, { code: event.target.value.toUpperCase() })} />
                      <Input value={bracket.label ?? ''} placeholder="Label" onChange={(event) => updateTaxBracket(index, { label: event.target.value })} />
                      <Input type="number" value={bracket.thresholdFrom} onChange={(event) => updateTaxBracket(index, { thresholdFrom: Number(event.target.value || 0) })} />
                      <Input type="number" value={bracket.thresholdTo ?? ''} placeholder="No upper limit" onChange={(event) => updateTaxBracket(index, { thresholdTo: event.target.value ? Number(event.target.value) : undefined })} />
                      <Input type="number" value={bracket.ratePercent} onChange={(event) => updateTaxBracket(index, { ratePercent: Number(event.target.value || 0) })} />
                      <Button type="button" variant="ghost" onClick={() => updatePayrollPolicy({ taxBrackets: (setup.payrollCalculationPolicy.taxBrackets ?? []).filter((_, rowIndex) => rowIndex !== index) })}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>Statutory Payroll Packs</Label>
                    <p className="text-xs text-muted-foreground">Country, workplace, and employee-type specific tax and insurance engines.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSetup((current) => ({
                      ...current,
                      statutoryPayrollPacks: [...current.statutoryPayrollPacks, {
                        code: `PACK_${Date.now().toString().slice(-5)}`,
                        label: 'New statutory pack',
                        active: true,
                        countryCode: 'EG',
                        calculationPolicy: current.payrollCalculationPolicy,
                        bankFileFormats: ['CSV'],
                      }],
                    }))}
                  >
                    Add Pack
                  </Button>
                </div>
                {setup.statutoryPayrollPacks.map((pack, index) => (
                  <div key={`${pack.code}-${index}`} className="grid gap-2 border-t pt-3 first:border-t-0 first:pt-0 md:grid-cols-2">
                    <Input value={pack.label} placeholder="Pack name" onChange={(event) => updateStatutoryPack(index, { label: event.target.value })} />
                    <Input value={pack.code} placeholder="Code" onChange={(event) => updateStatutoryPack(index, { code: event.target.value.toUpperCase() })} />
                    <Input value={pack.countryCode} placeholder="Country code" onChange={(event) => updateStatutoryPack(index, { countryCode: event.target.value.toUpperCase() })} />
                    <Input value={pack.currency ?? ''} placeholder="Currency" onChange={(event) => updateStatutoryPack(index, { currency: event.target.value.toUpperCase() || undefined })} />
                    <Input value={(pack.locationCodes ?? []).join(',')} placeholder="Workplace codes" onChange={(event) => updateStatutoryPack(index, { locationCodes: splitCsv(event.target.value) })} />
                    <Input value={(pack.employeeTypes ?? []).join(',')} placeholder="Employee types" onChange={(event) => updateStatutoryPack(index, { employeeTypes: splitCsv(event.target.value) })} />
                    <Input type="number" value={pack.calculationPolicy.employeeInsuranceRatePercent} placeholder="Employee insurance %" onChange={(event) => updateStatutoryPack(index, { calculationPolicy: { ...pack.calculationPolicy, employeeInsuranceRatePercent: Number(event.target.value || 0) } })} />
                    <Input type="number" value={pack.calculationPolicy.employerInsuranceRatePercent ?? ''} placeholder="Employer insurance %" onChange={(event) => updateStatutoryPack(index, { calculationPolicy: { ...pack.calculationPolicy, employerInsuranceRatePercent: Number(event.target.value || 0) } })} />
                    <Input value={pack.glAccountMapping?.salaryExpenseAccount ?? ''} placeholder="Salary expense account" onChange={(event) => updateStatutoryPack(index, { glAccountMapping: { ...pack.glAccountMapping, salaryExpenseAccount: event.target.value } })} />
                    <Input value={pack.glAccountMapping?.employerInsuranceExpenseAccount ?? ''} placeholder="Employer insurance expense account" onChange={(event) => updateStatutoryPack(index, { glAccountMapping: { ...pack.glAccountMapping, employerInsuranceExpenseAccount: event.target.value } })} />
                    <Input value={pack.glAccountMapping?.taxPayableAccount ?? ''} placeholder="Tax payable account" onChange={(event) => updateStatutoryPack(index, { glAccountMapping: { ...pack.glAccountMapping, taxPayableAccount: event.target.value } })} />
                    <Input value={pack.glAccountMapping?.insurancePayableAccount ?? ''} placeholder="Insurance payable account" onChange={(event) => updateStatutoryPack(index, { glAccountMapping: { ...pack.glAccountMapping, insurancePayableAccount: event.target.value } })} />
                    <Input value={pack.glAccountMapping?.deductionPayableAccount ?? ''} placeholder="Deduction payable account" onChange={(event) => updateStatutoryPack(index, { glAccountMapping: { ...pack.glAccountMapping, deductionPayableAccount: event.target.value } })} />
                    <Input value={pack.glAccountMapping?.bankClearingAccount ?? ''} placeholder="Bank clearing account" onChange={(event) => updateStatutoryPack(index, { glAccountMapping: { ...pack.glAccountMapping, bankClearingAccount: event.target.value } })} />
                    <Input value={(pack.bankFileFormats ?? []).join(',')} placeholder="Bank formats" onChange={(event) => updateStatutoryPack(index, { bankFileFormats: splitCsv(event.target.value) as HcmSetupConfig['statutoryPayrollPacks'][number]['bankFileFormats'] })} />
                  </div>
                ))}
              </div>
              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>Payroll Blocking Rules</Label>
                    <p className="text-xs text-muted-foreground">Tenant-controlled conditions that stop or warn before close-to-pay.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSetup((current) => ({
                      ...current,
                      payrollBlockingRules: [...current.payrollBlockingRules, {
                        code: `BLOCK_${Date.now().toString().slice(-5)}`,
                        label: 'New blocker',
                        active: true,
                        condition: 'MISSING_BANK_ACCOUNT',
                        severity: 'ERROR',
                        blocking: true,
                      }],
                    }))}
                  >
                    Add Rule
                  </Button>
                </div>
                {setup.payrollBlockingRules.map((rule, index) => (
                  <div key={`${rule.code}-${index}`} className="grid gap-2 border-t pt-3 first:border-t-0 first:pt-0 md:grid-cols-2">
                    <Input value={rule.label} placeholder="Rule name" onChange={(event) => updateBlockingRule(index, { label: event.target.value })} />
                    <Input value={rule.code} placeholder="Code" onChange={(event) => updateBlockingRule(index, { code: event.target.value.toUpperCase() })} />
                    <Select value={rule.condition} onValueChange={(value) => updateBlockingRule(index, { condition: value as PayrollBlockingRule['condition'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DUPLICATE_PAYROLL_CYCLE">Duplicate cycle</SelectItem>
                        <SelectItem value="MISSING_BANK_ACCOUNT">Missing bank account</SelectItem>
                        <SelectItem value="MISSING_PAYROLL_COMPENSATION">Missing compensation</SelectItem>
                        <SelectItem value="ATTENDANCE_BLOCKER">Attendance blocker</SelectItem>
                        <SelectItem value="ZERO_OR_NEGATIVE_NET_PAY">Zero or negative net</SelectItem>
                        <SelectItem value="MISSING_TAX_IDENTIFIER">Missing tax identifier</SelectItem>
                        <SelectItem value="MISSING_POLICY_ASSIGNMENT">Missing policy assignment</SelectItem>
                        <SelectItem value="NET_BELOW_MINIMUM">Net below minimum</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={rule.severity} onValueChange={(value) => updateBlockingRule(index, { severity: value as PayrollBlockingRule['severity'], blocking: value === 'ERROR' ? rule.blocking : false })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ERROR">Error</SelectItem>
                        <SelectItem value="WARNING">Warning</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input value={(rule.workerIds ?? []).join(',')} placeholder="Specific people (optional)" onChange={(event) => updateBlockingRule(index, { workerIds: splitCsv(event.target.value) })} />
                    <Input value={(rule.employeeIds ?? []).join(',')} placeholder="Employee numbers (optional)" onChange={(event) => updateBlockingRule(index, { employeeIds: splitCsv(event.target.value) })} />
                    <Input value={(rule.employeeTypes ?? []).join(',')} placeholder="Employee types" onChange={(event) => updateBlockingRule(index, { employeeTypes: splitCsv(event.target.value) })} />
                    <Input value={(rule.departmentCodes ?? []).join(',')} placeholder="Department codes" onChange={(event) => updateBlockingRule(index, { departmentCodes: splitCsv(event.target.value) })} />
                    <Input value={(rule.locationCodes ?? []).join(',')} placeholder="Workplace codes" onChange={(event) => updateBlockingRule(index, { locationCodes: splitCsv(event.target.value) })} />
                    {rule.condition === 'NET_BELOW_MINIMUM' ? (
                      <Input type="number" value={rule.minNetSalary ?? ''} placeholder="Minimum net salary" onChange={(event) => updateBlockingRule(index, { minNetSalary: event.target.value ? Number(event.target.value) : undefined })} />
                    ) : null}
                    <Input value={rule.message ?? ''} placeholder="Custom message" onChange={(event) => updateBlockingRule(index, { message: event.target.value || undefined })} />
                    <label className="flex items-center gap-2 text-sm">
                      <Input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={rule.blocking}
                        onChange={(event) => updateBlockingRule(index, { blocking: event.target.checked })}
                      />
                      Blocks close-to-pay
                    </label>
                    <Button type="button" variant="ghost" onClick={() => setSetup((current) => ({ ...current, payrollBlockingRules: current.payrollBlockingRules.filter((_, rowIndex) => rowIndex !== index) }))}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card id="payroll-attendance" className={tabClass('attendance', '')}>
            <CardHeader>
              <CardTitle className="text-lg">Attendance Policy</CardTitle>
              <CardDescription>Flexible hours, grace, overtime, and geofence rules.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Daily Minutes</Label>
                  <Input type="number" value={setup.attendancePolicy.standardDailyMinutes} onChange={(event) => updateAttendancePolicy({ standardDailyMinutes: Number(event.target.value || 0) })} />
                </div>
                <div className="grid gap-2">
                  <Label>Grace Minutes</Label>
                  <Input type="number" value={setup.attendancePolicy.lateGraceMinutes} onChange={(event) => updateAttendancePolicy({ lateGraceMinutes: Number(event.target.value || 0) })} />
                </div>
                <div className="grid gap-2">
                  <Label>Flex Start</Label>
                  <Input value={setup.attendancePolicy.flexibleWindowStart ?? ''} onChange={(event) => updateAttendancePolicy({ flexibleWindowStart: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Flex End</Label>
                  <Input value={setup.attendancePolicy.flexibleWindowEnd ?? ''} onChange={(event) => updateAttendancePolicy({ flexibleWindowEnd: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Core Start</Label>
                  <Input value={setup.attendancePolicy.coreStartTime ?? ''} onChange={(event) => updateAttendancePolicy({ coreStartTime: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Core End</Label>
                  <Input value={setup.attendancePolicy.coreEndTime ?? ''} onChange={(event) => updateAttendancePolicy({ coreEndTime: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Overtime After</Label>
                  <Input type="number" value={setup.attendancePolicy.overtimeAfterMinutes} onChange={(event) => updateAttendancePolicy({ overtimeAfterMinutes: Number(event.target.value || 0) })} />
                </div>
                <div className="grid gap-2">
                  <Label>Radius Meters</Label>
                  <Input type="number" value={setup.attendancePolicy.allowedRadiusMeters ?? ''} onChange={(event) => updateAttendancePolicy({ allowedRadiusMeters: event.target.value ? Number(event.target.value) : undefined })} />
                </div>
                <div className="grid gap-2">
                  <Label>Rounding Minutes</Label>
                  <Input type="number" value={setup.attendancePolicy.roundingIncrementMinutes ?? ''} onChange={(event) => updateAttendancePolicy({ roundingIncrementMinutes: event.target.value ? Number(event.target.value) : undefined })} />
                </div>
                <div className="grid gap-2">
                  <Label>Unpaid Break Minutes</Label>
                  <Input type="number" value={setup.attendancePolicy.unpaidBreakMinutes ?? ''} onChange={(event) => updateAttendancePolicy({ unpaidBreakMinutes: event.target.value ? Number(event.target.value) : undefined })} />
                </div>
                <div className="grid gap-2">
                  <Label>Minimum Trust Score</Label>
                  <Input type="number" value={setup.attendancePolicy.minClockTrustScore ?? ''} onChange={(event) => updateAttendancePolicy({ minClockTrustScore: event.target.value ? Number(event.target.value) : undefined })} />
                </div>
                <div className="grid gap-2">
                  <Label>Minimum Payable Day</Label>
                  <Input type="number" value={setup.attendancePolicy.minimumPayableDayMinutes ?? ''} onChange={(event) => updateAttendancePolicy({ minimumPayableDayMinutes: event.target.value ? Number(event.target.value) : undefined })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Workdays</Label>
                <div className="flex flex-wrap gap-2">
                  {weekdayOptions.map((day) => {
                    const active = (setup.attendancePolicy.workDays ?? [0, 1, 2, 3, 4]).includes(day.value);
                    return (
                      <Button
                        key={day.value}
                        type="button"
                        variant={active ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateWorkDay(day.value, !active)}
                      >
                        {day.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Holiday Calendar</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateAttendancePolicy({
                      holidays: [...(setup.attendancePolicy.holidays ?? []), { date: new Date().toISOString().slice(0, 10), name: 'Holiday' }],
                    })}
                  >
                    Add Holiday
                  </Button>
                </div>
                <div className="space-y-2">
                  {(setup.attendancePolicy.holidays ?? []).map((holiday, index) => (
                    <div key={`${holiday.date}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <Input type="date" value={holiday.date} onChange={(event) => updateHoliday(index, { date: event.target.value })} />
                      <Input value={holiday.name} onChange={(event) => updateHoliday(index, { name: event.target.value })} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => updateAttendancePolicy({
                          holidays: (setup.attendancePolicy.holidays ?? []).filter((_, rowIndex) => rowIndex !== index),
                        })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2 rounded-md border p-3">
                <Label>Payroll Blocking Rules</Label>
                <label className="flex items-center gap-2 text-sm">
                  <Input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={setup.attendancePolicy.missingCheckoutBlocksPayroll ?? true}
                    onChange={(event) => updateAttendancePolicy({ missingCheckoutBlocksPayroll: event.target.checked })}
                  />
                  Missing check-out blocks payroll
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={setup.attendancePolicy.duplicatePunchBlocksPayroll ?? true}
                    onChange={(event) => updateAttendancePolicy({ duplicatePunchBlocksPayroll: event.target.checked })}
                  />
                  Duplicate punch blocks payroll
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={setup.attendancePolicy.lowTrustPunchBlocksPayroll ?? true}
                    onChange={(event) => updateAttendancePolicy({ lowTrustPunchBlocksPayroll: event.target.checked })}
                  />
                  Low-trust punch blocks payroll
                </label>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Shift Rotations</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateAttendancePolicy({
                      shiftRotations: [...(setup.attendancePolicy.shiftRotations ?? []), {
                        code: `SHIFT_${Date.now().toString().slice(-5)}`,
                        label: 'New rotation',
                        active: true,
                        anchorDate: new Date().toISOString().slice(0, 10),
                        cycleDays: 7,
                        workDayOffsets: [0, 1, 2, 3, 4],
                        dailyMinutes: setup.attendancePolicy.standardDailyMinutes,
                        locationCodes: locations[0]?.code ? [locations[0].code] : [],
                      }],
                    })}
                  >
                    Add Rotation
                  </Button>
                </div>
                {(setup.attendancePolicy.shiftRotations ?? []).map((rule, index) => (
                  <div key={`${rule.code}-${index}`} className="space-y-2 border-t pt-3 first:border-t-0 first:pt-0">
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={rule.label} onChange={(event) => updateShiftRotation(index, { label: event.target.value })} />
                      <Input value={rule.code} onChange={(event) => updateShiftRotation(index, { code: event.target.value.toUpperCase() })} />
                      <Input type="date" value={rule.anchorDate} onChange={(event) => updateShiftRotation(index, { anchorDate: event.target.value })} />
                      <Input type="number" value={rule.cycleDays} onChange={(event) => updateShiftRotation(index, { cycleDays: Number(event.target.value || 1) })} />
                      <Input value={rule.workDayOffsets.join(',')} onChange={(event) => updateShiftRotation(index, { workDayOffsets: event.target.value.split(',').map((item) => Number(item.trim())).filter((item) => Number.isInteger(item)) })} />
                      <Input type="number" value={rule.dailyMinutes ?? ''} onChange={(event) => updateShiftRotation(index, { dailyMinutes: event.target.value ? Number(event.target.value) : undefined })} />
                      <Input value={rule.startTime ?? ''} placeholder="Start time" onChange={(event) => updateShiftRotation(index, { startTime: event.target.value })} />
                      <Input value={rule.endTime ?? ''} placeholder="End time" onChange={(event) => updateShiftRotation(index, { endTime: event.target.value })} />
                      <Input value={(rule.locationCodes ?? []).join(',')} placeholder="Workplace codes" onChange={(event) => updateShiftRotation(index, { locationCodes: splitCsv(event.target.value) })} />
                      <Input value={(rule.departmentCodes ?? []).join(',')} placeholder="Department codes" onChange={(event) => updateShiftRotation(index, { departmentCodes: splitCsv(event.target.value) })} />
                      <Input value={(rule.workerIds ?? []).join(',')} placeholder="Specific people (optional)" onChange={(event) => updateShiftRotation(index, { workerIds: splitCsv(event.target.value) })} />
                      <Button type="button" variant="ghost" onClick={() => updateAttendancePolicy({ shiftRotations: (setup.attendancePolicy.shiftRotations ?? []).filter((_, rowIndex) => rowIndex !== index) })}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Geofence Profiles</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateAttendancePolicy({
                      geofenceProfiles: [...(setup.attendancePolicy.geofenceProfiles ?? []), {
                        code: `GEOFENCE_${Date.now().toString().slice(-5)}`,
                        label: 'New geofence',
                        active: true,
                        locationCode: locations[0]?.code ?? 'LOCATION',
                        radiusMeters: setup.attendancePolicy.allowedRadiusMeters ?? 250,
                        requireGeolocation: true,
                      }],
                    })}
                  >
                    Add Geofence
                  </Button>
                </div>
                {(setup.attendancePolicy.geofenceProfiles ?? []).map((profile, index) => (
                  <div key={`${profile.code}-${index}`} className="grid gap-2 border-t pt-3 first:border-t-0 first:pt-0">
                    <Input value={profile.label} onChange={(event) => updateGeofenceProfile(index, { label: event.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={profile.locationCode} onValueChange={(value) => updateGeofenceProfile(index, { locationCode: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {locations.map((location) => <SelectItem key={location.code} value={location.code}>{location.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="number" value={profile.radiusMeters} onChange={(event) => updateGeofenceProfile(index, { radiusMeters: Number(event.target.value || 0) })} />
                      <Input type="number" value={profile.highAccuracyRequiredMeters ?? ''} placeholder="Accuracy meters" onChange={(event) => updateGeofenceProfile(index, { highAccuracyRequiredMeters: event.target.value ? Number(event.target.value) : undefined })} />
                      <Button type="button" variant="ghost" onClick={() => updateAttendancePolicy({ geofenceProfiles: (setup.attendancePolicy.geofenceProfiles ?? []).filter((_, rowIndex) => rowIndex !== index) })}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Device Trust Rules</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateAttendancePolicy({
                      deviceTrustRules: [...(setup.attendancePolicy.deviceTrustRules ?? []), {
                        code: `DEVICE_${Date.now().toString().slice(-5)}`,
                        label: 'New device rule',
                        active: true,
                        deviceIdPattern: 'device-*',
                        trustLevel: 'STANDARD',
                      }],
                    })}
                  >
                    Add Device Rule
                  </Button>
                </div>
                {(setup.attendancePolicy.deviceTrustRules ?? []).map((rule, index) => (
                  <div key={`${rule.code}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 border-t pt-3 first:border-t-0 first:pt-0">
                    <Input value={rule.deviceIdPattern} onChange={(event) => updateDeviceRule(index, { deviceIdPattern: event.target.value })} />
                    <Select value={rule.trustLevel} onValueChange={(value) => updateDeviceRule(index, { trustLevel: value as NonNullable<AttendancePolicy['deviceTrustRules']>[number]['trustLevel'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRUSTED">Trusted</SelectItem>
                        <SelectItem value="STANDARD">Standard</SelectItem>
                        <SelectItem value="UNTRUSTED">Untrusted</SelectItem>
                        <SelectItem value="BLOCKED">Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="icon" onClick={() => updateAttendancePolicy({ deviceTrustRules: (setup.attendancePolicy.deviceTrustRules ?? []).filter((_, rowIndex) => rowIndex !== index) })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Annual Holiday Calendar</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateAttendancePolicy({
                      holidayCalendars: [...(setup.attendancePolicy.holidayCalendars ?? []), {
                        date: new Date().toISOString().slice(0, 10),
                        name: 'Holiday',
                        countryCode: locations[0]?.countryCode,
                        locationCodes: locations[0]?.code ? [locations[0].code] : [],
                        paid: true,
                      }],
                    })}
                  >
                    Add Holiday
                  </Button>
                </div>
                {(setup.attendancePolicy.holidayCalendars ?? []).map((holiday, index) => (
                  <div key={`${holiday.date}-${holiday.name}-${index}`} className="grid gap-2 border-t pt-3 first:border-t-0 first:pt-0 md:grid-cols-[1fr_1fr_8rem_1fr_8rem_auto]">
                    <Input type="date" value={holiday.date} onChange={(event) => updateHolidayCalendar(index, { date: event.target.value })} />
                    <Input value={holiday.name} onChange={(event) => updateHolidayCalendar(index, { name: event.target.value })} />
                    <Input value={holiday.countryCode ?? ''} placeholder="Country" onChange={(event) => updateHolidayCalendar(index, { countryCode: event.target.value.toUpperCase() || undefined })} />
                    <Input value={(holiday.locationCodes ?? []).join(',')} placeholder="Workplace codes" onChange={(event) => updateHolidayCalendar(index, { locationCodes: splitCsv(event.target.value) })} />
                    <Select value={holiday.paid === false ? 'UNPAID' : 'PAID'} onValueChange={(value) => updateHolidayCalendar(index, { paid: value === 'PAID' })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PAID">Paid</SelectItem>
                        <SelectItem value="UNPAID">Unpaid</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="icon" onClick={() => updateAttendancePolicy({ holidayCalendars: (setup.attendancePolicy.holidayCalendars ?? []).filter((_, rowIndex) => rowIndex !== index) })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Flexible Hour Overrides</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateAttendancePolicy({
                      flexibleHoursRules: [...(setup.attendancePolicy.flexibleHoursRules ?? []), {
                        code: `FLEX_${Date.now().toString().slice(-5)}`,
                        label: 'New flexible rule',
                        active: true,
                        locationCodes: locations[0]?.code ? [locations[0].code] : [],
                        flexibleWindowStart: setup.attendancePolicy.flexibleWindowStart,
                        flexibleWindowEnd: setup.attendancePolicy.flexibleWindowEnd,
                        coreStartTime: setup.attendancePolicy.coreStartTime,
                        coreEndTime: setup.attendancePolicy.coreEndTime,
                        minimumPayableDayMinutes: setup.attendancePolicy.minimumPayableDayMinutes,
                      }],
                    })}
                  >
                    Add Flex Rule
                  </Button>
                </div>
                {(setup.attendancePolicy.flexibleHoursRules ?? []).map((rule, index) => (
                  <div key={`${rule.code}-${index}`} className="grid grid-cols-2 gap-2 border-t pt-3 first:border-t-0 first:pt-0">
                    <Input value={rule.label} onChange={(event) => updateFlexibleRule(index, { label: event.target.value })} />
                    <Input value={(rule.locationCodes ?? []).join(',')} placeholder="Workplace codes" onChange={(event) => updateFlexibleRule(index, { locationCodes: splitCsv(event.target.value) })} />
                    <Input value={(rule.departmentCodes ?? []).join(',')} placeholder="Department codes" onChange={(event) => updateFlexibleRule(index, { departmentCodes: splitCsv(event.target.value) })} />
                    <Input value={(rule.workerIds ?? []).join(',')} placeholder="Specific people (optional)" onChange={(event) => updateFlexibleRule(index, { workerIds: splitCsv(event.target.value) })} />
                    <Input value={rule.flexibleWindowStart ?? ''} placeholder="Flex start" onChange={(event) => updateFlexibleRule(index, { flexibleWindowStart: event.target.value })} />
                    <Input value={rule.flexibleWindowEnd ?? ''} placeholder="Flex end" onChange={(event) => updateFlexibleRule(index, { flexibleWindowEnd: event.target.value })} />
                    <Input value={rule.coreStartTime ?? ''} placeholder="Core start" onChange={(event) => updateFlexibleRule(index, { coreStartTime: event.target.value })} />
                    <Input value={rule.coreEndTime ?? ''} placeholder="Core end" onChange={(event) => updateFlexibleRule(index, { coreEndTime: event.target.value })} />
                    <Input type="number" value={rule.minimumPayableDayMinutes ?? ''} placeholder="Minimum payable" onChange={(event) => updateFlexibleRule(index, { minimumPayableDayMinutes: event.target.value ? Number(event.target.value) : undefined })} />
                    <Button type="button" variant="ghost" onClick={() => updateAttendancePolicy({ flexibleHoursRules: (setup.attendancePolicy.flexibleHoursRules ?? []).filter((_, rowIndex) => rowIndex !== index) })}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card id="payroll-earnings" className={tabClass('earnings', '')}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Earning & Allowance Policies</CardTitle>
                  <CardDescription>Recurring and attendance-driven earnings applied before tax, insurance, and deductions.</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSetup((current) => ({
                    ...current,
                    earningPolicies: [...current.earningPolicies, {
                      code: `EARNING_${Date.now().toString().slice(-5)}`,
                      label: 'New earning',
                      active: true,
                      type: 'FIXED_AMOUNT',
                      amount: 0,
                      taxable: true,
                      insurable: true,
                      recurring: true,
                    }],
                  }))}
                >
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {setup.earningPolicies.map((earning, index) => (
                <div key={`${earning.code}-${index}`} className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Name</Label>
                      <Input value={earning.label} onChange={(event) => updateEarning(index, { label: event.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Code</Label>
                      <Input value={earning.code} onChange={(event) => updateEarning(index, { code: event.target.value.toUpperCase() })} />
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <Select value={earning.type} onValueChange={(value) => updateEarning(index, { type: value as EarningPolicy['type'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIXED_AMOUNT">Fixed amount</SelectItem>
                        <SelectItem value="PERCENT_OF_BASE">% of base salary</SelectItem>
                        <SelectItem value="PER_MINUTE">Per attendance minute</SelectItem>
                      </SelectContent>
                    </Select>
                    {earning.type === 'PER_MINUTE' ? (
                      <Select value={earning.attendanceEvent ?? 'OVERTIME'} onValueChange={(value) => updateEarning(index, { attendanceEvent: value as EarningPolicy['attendanceEvent'] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OVERTIME">Overtime minutes</SelectItem>
                          <SelectItem value="ON_DUTY">On-duty minutes</SelectItem>
                          <SelectItem value="WORKED">Worked minutes</SelectItem>
                          <SelectItem value="PAYABLE">Payable minutes</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div />
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setSetup((current) => ({ ...current, earningPolicies: current.earningPolicies.filter((_, rowIndex) => rowIndex !== index) }))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <Input
                      type="number"
                      value={earning.type === 'PERCENT_OF_BASE' ? earning.ratePercent ?? '' : earning.amount ?? ''}
                      placeholder={earning.type === 'PERCENT_OF_BASE' ? 'Rate %' : 'Amount'}
                      onChange={(event) => {
                        const value = Number(event.target.value || 0);
                        updateEarning(index, earning.type === 'PERCENT_OF_BASE' ? { ratePercent: value } : { amount: value });
                      }}
                    />
                    <Input type="number" value={earning.maxAmount ?? ''} placeholder="Max amount cap" onChange={(event) => updateEarning(index, { maxAmount: event.target.value ? Number(event.target.value) : undefined })} />
                    <Input type="number" value={earning.priority ?? ''} placeholder="Priority" onChange={(event) => updateEarning(index, { priority: event.target.value ? Number(event.target.value) : undefined })} />
                    <Select value={earning.active ? 'ACTIVE' : 'INACTIVE'} onValueChange={(value) => updateEarning(index, { active: value === 'ACTIVE' })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <label className="flex items-center gap-2 text-sm">
                      <Input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={earning.taxable}
                        onChange={(event) => updateEarning(index, { taxable: event.target.checked })}
                      />
                      Taxable
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={earning.insurable ?? false}
                        onChange={(event) => updateEarning(index, { insurable: event.target.checked })}
                      />
                      Included in insurance base
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={earning.recurring ?? false}
                        onChange={(event) => updateEarning(index, { recurring: event.target.checked })}
                      />
                      Recurring
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={(earning.workerIds ?? []).join(',')} placeholder="Specific people (optional)" onChange={(event) => updateEarning(index, { workerIds: splitCsv(event.target.value) })} />
                    <Input value={(earning.employeeIds ?? []).join(',')} placeholder="Employee numbers (optional)" onChange={(event) => updateEarning(index, { employeeIds: splitCsv(event.target.value) })} />
                    <Input value={(earning.appliesToEmployeeTypes ?? []).join(',')} placeholder="Employee types: FULL_TIME,HOURLY" onChange={(event) => updateEarning(index, { appliesToEmployeeTypes: splitCsv(event.target.value) })} />
                    <Input value={(earning.departmentCodes ?? []).join(',')} placeholder="Department codes" onChange={(event) => updateEarning(index, { departmentCodes: splitCsv(event.target.value) })} />
                    <Input value={(earning.locationCodes ?? []).join(',')} placeholder="Workplace codes" onChange={(event) => updateEarning(index, { locationCodes: splitCsv(event.target.value) })} />
                    <Input type="date" value={earning.effectiveFrom ?? ''} onChange={(event) => updateEarning(index, { effectiveFrom: event.target.value || undefined })} />
                    <Input type="date" value={earning.effectiveUntil ?? ''} onChange={(event) => updateEarning(index, { effectiveUntil: event.target.value || undefined })} />
                  </div>
                  <p className="text-xs text-muted-foreground">{earningLabel(earning)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card id="payroll-deductions" className={tabClass('deductions', '')}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Deduction Rules</CardTitle>
                  <CardDescription>Rules applied to payroll deductions.</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSetup((current) => ({
                    ...current,
                    deductionPolicies: [...current.deductionPolicies, {
                      code: `DEDUCTION_${Date.now().toString().slice(-5)}`,
                      label: '',
                      active: true,
                      type: 'FIXED_AMOUNT',
                      amount: 0,
                      timing: 'POST_TAX',
                    }],
                  }))}
                >
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {setup.deductionPolicies.map((deduction, index) => (
                <div key={`${deduction.code}-${index}`} className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Name</Label>
                      <Input value={deduction.label} onChange={(event) => updateDeduction(index, { label: event.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Code</Label>
                      <Input value={deduction.code} onChange={(event) => updateDeduction(index, { code: event.target.value.toUpperCase() })} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Timing</Label>
                    <Select value={deduction.timing ?? 'POST_TAX'} onValueChange={(value) => updateDeduction(index, { timing: value as DeductionPolicy['timing'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRE_TAX">Pre-tax</SelectItem>
                        <SelectItem value="POST_TAX">Post-tax</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Select value={deduction.type} onValueChange={(value) => updateDeduction(index, { type: value as DeductionPolicy['type'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIXED_AMOUNT">Fixed amount</SelectItem>
                        <SelectItem value="PERCENT_OF_GROSS">% of gross</SelectItem>
                        <SelectItem value="PER_MINUTE">Per attendance minute</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" onClick={() => setSetup((current) => ({ ...current, deductionPolicies: current.deductionPolicies.filter((_, rowIndex) => rowIndex !== index) }))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {deduction.type === 'PER_MINUTE' ? (
                    <Select value={deduction.attendanceEvent ?? 'LATE'} onValueChange={(value) => updateDeduction(index, { attendanceEvent: value as DeductionPolicy['attendanceEvent'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LATE">Late minutes</SelectItem>
                        <SelectItem value="UNDERTIME">Undertime minutes</SelectItem>
                        <SelectItem value="ABSENCE">Absent days</SelectItem>
                        <SelectItem value="GEOFENCE_VIOLATION">Geofence violations</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : null}
                  <Input
                    type="number"
                    value={deduction.type === 'PERCENT_OF_GROSS' ? deduction.ratePercent ?? '' : deduction.amount ?? ''}
                    onChange={(event) => {
                      const value = Number(event.target.value || 0);
                      updateDeduction(index, deduction.type === 'PERCENT_OF_GROSS' ? { ratePercent: value } : { amount: value });
                    }}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" value={deduction.maxAmount ?? ''} placeholder="Max amount cap" onChange={(event) => updateDeduction(index, { maxAmount: event.target.value ? Number(event.target.value) : undefined })} />
                    <Input type="number" value={deduction.priority ?? ''} placeholder="Priority" onChange={(event) => updateDeduction(index, { priority: event.target.value ? Number(event.target.value) : undefined })} />
                    <Input value={(deduction.workerIds ?? []).join(',')} placeholder="Specific people (optional)" onChange={(event) => updateDeduction(index, { workerIds: splitCsv(event.target.value) })} />
                    <Input value={(deduction.employeeIds ?? []).join(',')} placeholder="Employee numbers (optional)" onChange={(event) => updateDeduction(index, { employeeIds: splitCsv(event.target.value) })} />
                    <Input value={(deduction.appliesToEmployeeTypes ?? []).join(',')} placeholder="Employee types: FULL_TIME,HOURLY" onChange={(event) => updateDeduction(index, { appliesToEmployeeTypes: splitCsv(event.target.value) })} />
                    <Input value={(deduction.departmentCodes ?? []).join(',')} placeholder="Department codes" onChange={(event) => updateDeduction(index, { departmentCodes: splitCsv(event.target.value) })} />
                    <Input value={(deduction.locationCodes ?? []).join(',')} placeholder="Workplace codes" onChange={(event) => updateDeduction(index, { locationCodes: splitCsv(event.target.value) })} />
                    <Input type="date" value={deduction.effectiveFrom ?? ''} onChange={(event) => updateDeduction(index, { effectiveFrom: event.target.value || undefined })} />
                    <Input type="date" value={deduction.effectiveUntil ?? ''} onChange={(event) => updateDeduction(index, { effectiveUntil: event.target.value || undefined })} />
                  </div>
                  <p className="text-xs text-muted-foreground">{deductionLabel(deduction)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
      </main>
    </div>
  );
}
