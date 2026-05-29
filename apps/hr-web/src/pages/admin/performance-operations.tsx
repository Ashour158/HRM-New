import * as React from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useApiQuery } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { formatDate } from '@/lib/utils';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  GitBranch,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import type { OrgUnit, Worker } from '@/types';

type Refetch = () => void | Promise<unknown>;

interface ReviewCycle {
  id: string;
  name: string;
  cycleYear: number;
  startDate: string;
  endDate: string;
  reviewType: string;
  status: string;
}

interface PerformanceReview {
  id: string;
  workerId: string;
  reviewCycleId: string;
  managerId: string;
  status: string;
  finalRating?: number;
  calibratedRating?: number;
}

interface Feedback360Cycle {
  id: string;
  name: string;
  cycleYear: number;
  startDate: string;
  endDate: string;
  status: string;
  anonymityEnabled?: boolean;
  minPeerReviews?: number;
  maxPeerReviews?: number;
}

interface Feedback360Response {
  id: string;
  cycleId: string;
  revieweeId: string;
  reviewerId: string;
  relationshipType: string;
  status: string;
  overallRating?: number;
  isAnonymous?: boolean;
}

interface CalibrationSession {
  id: string;
  reviewCycleId: string;
  facilitatorId: string;
  participants?: string[];
  status: string;
}

interface PerformanceImprovementPlan {
  id: string;
  workerId: string;
  managerId: string;
  objectives?: string[];
  startDate?: string;
  reviewDate?: string;
  endDate?: string;
  outcome?: string;
  status: string;
}

interface DevelopmentPlan {
  id: string;
  workerId: string;
  managerId?: string;
  title: string;
  description?: string;
  status: string;
  targetCompletionDate?: string;
  outcome?: string;
}

interface Objective {
  id: string;
  ownerId: string;
  orgUnitId?: string;
  reviewCycleId?: string;
  title: string;
  period: string;
  progress?: number;
  confidenceScore?: number;
  status: string;
}

interface KeyResult {
  id: string;
  objectiveId: string;
  title: string;
  targetValue: number;
  currentValue?: number;
  progress?: number;
  unit?: string;
  status: string;
}

interface Kpi {
  id: string;
  orgUnitId?: string;
  name: string;
  targetValue?: number;
  actualValue?: number;
  unit?: string;
  frequency?: string;
  ownerId?: string;
  department?: string;
  status: string;
}

interface KpiMeasurement {
  id: string;
  kpiId: string;
  periodStart: string;
  periodEnd: string;
  actualValue: number;
  targetValue?: number;
  variance?: number;
  variancePercentage?: number;
  status: string;
}

function splitValues(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function workerName(worker?: Worker): string {
  if (!worker) return 'Select employee';
  return `${worker.firstName} ${worker.lastName}`.trim() || worker.email || worker.employeeId;
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (['ACTIVE', 'IN_PROGRESS', 'ACHIEVED', 'SUBMITTED', 'VALIDATED', 'FINALIZED', 'ACKNOWLEDGED'].includes(status)) return 'default';
  if (['DRAFT', 'PENDING', 'SELF_REVIEW', 'MANAGER_REVIEW', 'CALIBRATED', 'REVIEW_PENDING', 'SCHEDULED', 'RECORDED'].includes(status)) return 'secondary';
  if (['TERMINATED', 'CANCELLED', 'MISSED', 'DISPUTED', 'WITHDRAWN', 'EXPIRED'].includes(status)) return 'destructive';
  return 'outline';
}

function flattenOrgUnits(nodes: OrgUnit[], depth = 0): Array<OrgUnit & { depth: number }> {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenOrgUnits(((node as OrgUnit & { children?: OrgUnit[] }).children ?? []), depth + 1),
  ]);
}

function readApiError(error: unknown): string {
  const responseData = (error as { response?: { data?: { message?: unknown; error?: unknown } } }).response?.data;
  if (typeof responseData?.message === 'string') return responseData.message;
  if (Array.isArray(responseData?.message)) return responseData.message.join(', ');
  if (typeof responseData?.error === 'string') return responseData.error;
  return error instanceof Error ? error.message : 'Request failed';
}

function FieldTextarea({
  id,
  label,
  value,
  onChange,
  rows = 3,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[76px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      />
    </div>
  );
}

function EmployeeSelect({
  value,
  workers,
  onChange,
  placeholder = 'Select employee',
}: {
  value: string;
  workers: Worker[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={workers.length === 0}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {workers.map((worker) => (
          <SelectItem key={worker.id} value={worker.id}>
            {workerName(worker)} - {worker.employeeId}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CycleSelect({
  value,
  cycles,
  onChange,
}: {
  value: string;
  cycles: ReviewCycle[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={cycles.length === 0}>
      <SelectTrigger>
        <SelectValue placeholder="Select review cycle" />
      </SelectTrigger>
      <SelectContent>
        {cycles.map((cycle) => (
          <SelectItem key={cycle.id} value={cycle.id}>
            {cycle.name} - {cycle.cycleYear}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">
      {text}
    </div>
  );
}

export function AdminPerformanceOperations() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? '00000000-0000-0000-0000-000000000001';
  const [section, setSection] = React.useState<'reviews' | 'feedback' | 'calibration' | 'growth' | 'okr'>('reviews');
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = React.useState('');
  const [selectedManagerId, setSelectedManagerId] = React.useState('');
  const [selectedCycleId, setSelectedCycleId] = React.useState('');
  const [selectedFeedbackCycleId, setSelectedFeedbackCycleId] = React.useState('');
  const [selectedObjectiveId, setSelectedObjectiveId] = React.useState('');
  const [selectedKpiId, setSelectedKpiId] = React.useState('');
  const [kpiCategory, setKpiCategory] = React.useState('HR');

  const [reviewForm, setReviewForm] = React.useState({ workerId: '', reviewCycleId: '', managerId: '' });
  const [feedbackCycleForm, setFeedbackCycleForm] = React.useState({
    name: '',
    cycleYear: String(new Date().getFullYear()),
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10),
    minPeerReviews: '3',
    maxPeerReviews: '5',
  });
  const [feedbackResponseForm, setFeedbackResponseForm] = React.useState({ cycleId: '', revieweeId: '', reviewerId: '', relationshipType: 'PEER' });
  const [calibrationForm, setCalibrationForm] = React.useState({ reviewCycleId: '', facilitatorId: '', participants: '' });
  const [pipForm, setPipForm] = React.useState({ workerId: '', managerId: '', objectives: '', endDate: '' });
  const [developmentForm, setDevelopmentForm] = React.useState({ workerId: '', managerId: '', title: '', description: '', objective: '', skill: '', resource: '', endDate: '' });
  const [objectiveForm, setObjectiveForm] = React.useState({ ownerId: '', orgUnitId: '', reviewCycleId: '', title: '', period: '2026-Q2' });
  const [keyResultForm, setKeyResultForm] = React.useState({ objectiveId: '', title: '', targetValue: '100', unit: '%' });
  const [kpiForm, setKpiForm] = React.useState({ orgUnitId: '', ownerId: '', name: '', category: 'HR', targetValue: '100', unit: '%', frequency: 'MONTHLY' });
  const [measurementForm, setMeasurementForm] = React.useState({ kpiId: '', period: new Date().toISOString().slice(0, 7), measuredValue: '', notes: '' });

  const { data: workers = [] } = useApiQuery<Worker[]>(['performance-ops-workers'], '/hr/core/workers?page=1&pageSize=100');
  const { data: cycles = [], refetch: refetchCycles } = useApiQuery<ReviewCycle[]>(['performance-ops-cycles', tenantId], `/performance/review-cycles/tenant/${tenantId}`, { enabled: Boolean(tenantId) });
  const { data: orgTree = [] } = useApiQuery<OrgUnit[]>(['performance-ops-org-tree'], '/hr/organization/org-units/tree');
  const orgUnits = React.useMemo(() => flattenOrgUnits(orgTree), [orgTree]);

  const effectiveWorkerId = selectedWorkerId || workers[0]?.id || '';
  const effectiveCycleId = selectedCycleId || cycles[0]?.id || '';

  const { data: reviews = [], refetch: refetchReviews, isLoading: reviewsLoading } = useApiQuery<PerformanceReview[]>(
    ['performance-ops-reviews', effectiveWorkerId],
    `/performance/reviews/worker/${effectiveWorkerId}`,
    { enabled: Boolean(effectiveWorkerId) },
  );
  const { data: feedbackCycles = [], refetch: refetchFeedbackCycles } = useApiQuery<Feedback360Cycle[]>(
    ['performance-ops-feedback-cycles', tenantId],
    `/performance/feedback-360-cycles/tenant/${tenantId}`,
    { enabled: Boolean(tenantId) },
  );
  const effectiveFeedbackCycleId = selectedFeedbackCycleId || feedbackCycles[0]?.id || '';
  const { data: feedbackResponses = [], refetch: refetchFeedbackResponses, isLoading: feedbackResponsesLoading } = useApiQuery<Feedback360Response[]>(
    ['performance-ops-feedback-responses', effectiveFeedbackCycleId],
    `/performance/feedback-360-responses/cycle/${effectiveFeedbackCycleId}`,
    { enabled: Boolean(effectiveFeedbackCycleId) },
  );
  const { data: calibrationSessions = [], refetch: refetchCalibration, isLoading: calibrationLoading } = useApiQuery<CalibrationSession[]>(
    ['performance-ops-calibration', effectiveCycleId],
    `/performance/calibration-sessions/cycle/${effectiveCycleId}`,
    { enabled: Boolean(effectiveCycleId) },
  );
  const { data: pips = [], refetch: refetchPips, isLoading: pipsLoading } = useApiQuery<PerformanceImprovementPlan[]>(
    ['performance-ops-pips', effectiveWorkerId],
    `/performance/improvement-plans/worker/${effectiveWorkerId}`,
    { enabled: Boolean(effectiveWorkerId) },
  );
  const { data: developmentPlans = [], refetch: refetchDevelopmentPlans, isLoading: developmentPlansLoading } = useApiQuery<DevelopmentPlan[]>(
    ['performance-ops-development', effectiveWorkerId],
    `/performance/development-plans/worker/${effectiveWorkerId}`,
    { enabled: Boolean(effectiveWorkerId) },
  );
  const { data: objectives = [], refetch: refetchObjectives, isLoading: objectivesLoading } = useApiQuery<Objective[]>(
    ['performance-ops-objectives', effectiveWorkerId],
    `/performance/objectives/owner/${effectiveWorkerId}`,
    { enabled: Boolean(effectiveWorkerId) },
  );
  const effectiveObjectiveId = selectedObjectiveId || objectives[0]?.id || '';
  const { data: keyResults = [], refetch: refetchKeyResults, isLoading: keyResultsLoading } = useApiQuery<KeyResult[]>(
    ['performance-ops-key-results', effectiveObjectiveId],
    `/performance/key-results/objective/${effectiveObjectiveId}`,
    { enabled: Boolean(effectiveObjectiveId) },
  );
  const { data: kpis = [], refetch: refetchKpis, isLoading: kpisLoading } = useApiQuery<Kpi[]>(
    ['performance-ops-kpis', kpiCategory],
    `/performance/kpis/department/${encodeURIComponent(kpiCategory)}`,
    { enabled: Boolean(kpiCategory) },
  );
  const effectiveKpiId = selectedKpiId || kpis[0]?.id || '';
  const { data: kpiMeasurements = [], refetch: refetchMeasurements, isLoading: measurementsLoading } = useApiQuery<KpiMeasurement[]>(
    ['performance-ops-kpi-measurements', effectiveKpiId],
    `/performance/kpi-measurements/kpi/${effectiveKpiId}`,
    { enabled: Boolean(effectiveKpiId) },
  );

  React.useEffect(() => {
    if (workers[0]?.id) {
      setSelectedWorkerId((current) => current || workers[0].id);
      setSelectedManagerId((current) => current || workers[0].id);
      setReviewForm((current) => ({
        ...current,
        workerId: current.workerId || workers[0].id,
        managerId: current.managerId || workers[0].id,
      }));
      setFeedbackResponseForm((current) => ({
        ...current,
        revieweeId: current.revieweeId || workers[0].id,
        reviewerId: current.reviewerId || workers[0].id,
      }));
      setCalibrationForm((current) => ({ ...current, facilitatorId: current.facilitatorId || workers[0].id }));
      setPipForm((current) => ({ ...current, workerId: current.workerId || workers[0].id, managerId: current.managerId || workers[0].id }));
      setDevelopmentForm((current) => ({ ...current, workerId: current.workerId || workers[0].id, managerId: current.managerId || workers[0].id }));
      setObjectiveForm((current) => ({ ...current, ownerId: current.ownerId || workers[0].id }));
      setKpiForm((current) => ({ ...current, ownerId: current.ownerId || workers[0].id }));
    }
  }, [workers]);

  React.useEffect(() => {
    if (cycles[0]?.id) {
      setSelectedCycleId((current) => current || cycles[0].id);
      setReviewForm((current) => ({ ...current, reviewCycleId: current.reviewCycleId || cycles[0].id }));
      setCalibrationForm((current) => ({ ...current, reviewCycleId: current.reviewCycleId || cycles[0].id }));
      setObjectiveForm((current) => ({ ...current, reviewCycleId: current.reviewCycleId || cycles[0].id }));
    }
  }, [cycles]);

  React.useEffect(() => {
    if (feedbackCycles[0]?.id) {
      setSelectedFeedbackCycleId((current) => current || feedbackCycles[0].id);
      setFeedbackResponseForm((current) => ({ ...current, cycleId: current.cycleId || feedbackCycles[0].id }));
    }
  }, [feedbackCycles]);

  React.useEffect(() => {
    if (objectives[0]?.id) {
      setSelectedObjectiveId((current) => current || objectives[0].id);
      setKeyResultForm((current) => ({ ...current, objectiveId: current.objectiveId || objectives[0].id }));
    }
  }, [objectives]);

  React.useEffect(() => {
    if (kpis[0]?.id) {
      setSelectedKpiId((current) => current || kpis[0].id);
      setMeasurementForm((current) => ({ ...current, kpiId: current.kpiId || kpis[0].id }));
    }
  }, [kpis]);

  React.useEffect(() => {
    if (orgUnits[0]?.id) {
      setObjectiveForm((current) => ({ ...current, orgUnitId: current.orgUnitId || orgUnits[0].id }));
      setKpiForm((current) => ({ ...current, orgUnitId: current.orgUnitId || orgUnits[0].id }));
    }
  }, [orgUnits]);

  const runCommand = React.useCallback(async (path: string, body: unknown | undefined, after?: Refetch | Refetch[]) => {
    setBusyKey(path);
    setError(null);
    try {
      await apiClient.post(`/performance/${path}`, body ?? {});
      setMessage('Workflow command completed');
      const callbacks = Array.isArray(after) ? after : after ? [after] : [];
      callbacks.forEach((callback) => callback());
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setBusyKey(null);
    }
  }, []);

  const createEntity = React.useCallback(async (path: string, body: unknown, after?: Refetch | Refetch[]) => {
    setBusyKey(path);
    setError(null);
    try {
      await apiClient.post(`/performance/${path}`, body);
      setMessage('Record created');
      const callbacks = Array.isArray(after) ? after : after ? [after] : [];
      callbacks.forEach((callback) => callback());
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setBusyKey(null);
    }
  }, []);

  const runReviewAction = React.useCallback(async (review: PerformanceReview) => {
    if (review.status === 'DRAFT') {
      const content = window.prompt('Self-review content');
      if (content) await runCommand(`reviews/${review.id}/commands/submit-self`, { content }, refetchReviews);
      return;
    }
    if (review.status === 'SELF_REVIEW') {
      const content = window.prompt('Manager review content');
      if (content) await runCommand(`reviews/${review.id}/commands/submit-manager`, { content }, refetchReviews);
      return;
    }
    if (review.status === 'MANAGER_REVIEW') {
      const rating = Number(window.prompt('Calibration rating', '3'));
      if (Number.isFinite(rating)) await runCommand(`reviews/${review.id}/commands/calibrate`, { rating }, refetchReviews);
      return;
    }
    if (review.status === 'CALIBRATED') {
      const rating = Number(window.prompt('Final rating', String(review.calibratedRating ?? 3)));
      if (Number.isFinite(rating)) await runCommand(`reviews/${review.id}/commands/finalize`, { rating }, refetchReviews);
      return;
    }
    if (review.status === 'FINALIZED') {
      const action = window.prompt('Type A to acknowledge or D to dispute', 'A')?.trim().toUpperCase();
      if (action === 'D') {
        await runCommand(`reviews/${review.id}/commands/dispute`, {}, refetchReviews);
      } else if (action === 'A') {
        await runCommand(`reviews/${review.id}/commands/acknowledge`, {}, refetchReviews);
      }
    }
  }, [refetchReviews, runCommand]);

  const runPipAction = React.useCallback(async (pip: PerformanceImprovementPlan) => {
    if (pip.status === 'DRAFT') await runCommand(`improvement-plans/${pip.id}/commands/activate`, {}, refetchPips);
    if (pip.status === 'ACTIVE' || pip.status === 'IN_PROGRESS' || pip.status === 'EXTENDED') {
      const action = window.prompt('Type REVIEW, EXTEND, or TERMINATE', 'REVIEW')?.trim().toUpperCase();
      if (action === 'EXTEND') {
        const newEndDate = window.prompt('New end date (YYYY-MM-DD)', pip.endDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
        if (newEndDate) await runCommand(`improvement-plans/${pip.id}/commands/extend`, { newEndDate }, refetchPips);
      } else if (action === 'TERMINATE') {
        await runCommand(`improvement-plans/${pip.id}/commands/terminate`, {}, refetchPips);
      } else if (action === 'REVIEW') {
        await runCommand(`improvement-plans/${pip.id}/commands/enter-review`, {}, refetchPips);
      }
    }
    if (pip.status === 'REVIEW_PENDING') {
      const action = window.prompt('Type COMPLETE, EXTEND, or TERMINATE', 'COMPLETE')?.trim().toUpperCase();
      if (action === 'COMPLETE') {
        const outcome = window.prompt('Completion outcome', 'Improvement plan completed');
        if (outcome) await runCommand(`improvement-plans/${pip.id}/commands/complete`, { outcome }, refetchPips);
      } else if (action === 'EXTEND') {
        const newEndDate = window.prompt('New end date (YYYY-MM-DD)', pip.endDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
        if (newEndDate) await runCommand(`improvement-plans/${pip.id}/commands/extend`, { newEndDate }, refetchPips);
      } else if (action === 'TERMINATE') {
        await runCommand(`improvement-plans/${pip.id}/commands/terminate`, {}, refetchPips);
      }
    }
    if (pip.status === 'COMPLETED') await runCommand(`improvement-plans/${pip.id}/commands/close`, {}, refetchPips);
  }, [refetchPips, runCommand]);

  const runDevelopmentAction = React.useCallback(async (plan: DevelopmentPlan) => {
    if (plan.status === 'DRAFT') await runCommand(`development-plans/${plan.id}/commands/activate`, {}, refetchDevelopmentPlans);
    if (plan.status === 'ACTIVE' || plan.status === 'IN_PROGRESS') {
      const action = window.prompt('Type MILESTONE or COMPLETE', 'MILESTONE')?.trim().toUpperCase();
      if (action === 'COMPLETE') {
        await runCommand(`development-plans/${plan.id}/commands/complete`, {}, refetchDevelopmentPlans);
      } else if (action === 'MILESTONE') {
        const objectiveTitle = window.prompt('Milestone or objective title', plan.title);
        if (objectiveTitle) {
          await runCommand(`development-plans/${plan.id}/commands/record-milestone`, { objectiveTitle, status: 'COMPLETED' }, refetchDevelopmentPlans);
        }
      }
    }
    if (plan.status === 'COMPLETED') await runCommand(`development-plans/${plan.id}/commands/close`, {}, refetchDevelopmentPlans);
  }, [refetchDevelopmentPlans, runCommand]);

  const runObjectiveAction = React.useCallback(async (objective: Objective) => {
    if (objective.status === 'DRAFT') await runCommand(`objectives/${objective.id}/commands/activate`, {}, refetchObjectives);
    if (objective.status === 'ACTIVE' || objective.status === 'IN_PROGRESS') {
      const action = window.prompt('Type progress percent, ACHIEVE, or CANCEL', String(objective.progress ?? 50))?.trim().toUpperCase();
      if (action === 'ACHIEVE') {
        await runCommand(`objectives/${objective.id}/commands/mark-achieved`, {}, refetchObjectives);
      } else if (action === 'CANCEL') {
        await runCommand(`objectives/${objective.id}/commands/cancel`, {}, refetchObjectives);
      } else {
        const progress = Number(action);
        if (Number.isFinite(progress)) await runCommand(`objectives/${objective.id}/commands/update-progress`, { progress, confidenceScore: 0.8 }, refetchObjectives);
      }
    }
  }, [refetchObjectives, runCommand]);

  const runKeyResultAction = React.useCallback(async (keyResult: KeyResult) => {
    if (keyResult.status === 'DRAFT') await runCommand(`key-results/${keyResult.id}/commands/activate`, {}, refetchKeyResults);
    if (keyResult.status === 'ACTIVE' || keyResult.status === 'IN_PROGRESS') {
      const action = window.prompt('Type current value, COMPLETE, or CANCEL', String(keyResult.currentValue ?? 0))?.trim().toUpperCase();
      if (action === 'COMPLETE') {
        await runCommand(`key-results/${keyResult.id}/commands/complete`, {}, refetchKeyResults);
      } else if (action === 'CANCEL') {
        await runCommand(`key-results/${keyResult.id}/commands/cancel`, {}, refetchKeyResults);
      } else {
        const currentValue = Number(action);
        if (Number.isFinite(currentValue)) await runCommand(`key-results/${keyResult.id}/commands/update-progress`, { currentValue }, refetchKeyResults);
      }
    }
  }, [refetchKeyResults, runCommand]);

  const runKpiAction = React.useCallback(async (kpi: Kpi) => {
    if (kpi.status === 'DRAFT') await runCommand(`kpis/${kpi.id}/commands/activate`, {}, refetchKpis);
    if (kpi.status === 'ACTIVE' || kpi.status === 'INACTIVE') {
      const action = window.prompt('Type actual value, ASSIGN, or ARCHIVE', String(kpi.actualValue ?? kpi.targetValue ?? 0))?.trim().toUpperCase();
      if (action === 'ARCHIVE') {
        await runCommand(`kpis/${kpi.id}/commands/archive`, {}, refetchKpis);
      } else if (action === 'ASSIGN') {
        const ownerId = window.prompt('New owner employee ID', kpi.ownerId ?? selectedWorkerId);
        if (ownerId) await runCommand(`kpis/${kpi.id}/commands/assign-owner`, { ownerId }, refetchKpis);
      } else {
        const actualValue = Number(action);
        if (Number.isFinite(actualValue)) await runCommand(`kpis/${kpi.id}/commands/update-actual`, { actualValue }, refetchKpis);
      }
    }
  }, [refetchKpis, runCommand, selectedWorkerId]);

  const reviewColumns = React.useMemo<DataTableColumn<PerformanceReview>[]>(() => [
    { key: 'cycle', header: 'Cycle', cell: (review) => cycles.find((cycle) => cycle.id === review.reviewCycleId)?.name ?? review.reviewCycleId },
    { key: 'manager', header: 'Manager', cell: (review) => workerName(workers.find((worker) => worker.id === review.managerId)) },
    { key: 'rating', header: 'Rating', cell: (review) => review.finalRating ?? review.calibratedRating ?? '-' },
    { key: 'status', header: 'Status', cell: (review) => <Badge variant={statusVariant(review.status)}>{review.status}</Badge> },
    {
      key: 'action',
      header: 'Workflow',
      cell: (review) => (
        <Button size="sm" variant="outline" disabled={busyKey?.includes(review.id)} onClick={() => runReviewAction(review)}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Next
        </Button>
      ),
    },
  ], [busyKey, cycles, runReviewAction, workers]);

  const feedbackCycleColumns = React.useMemo<DataTableColumn<Feedback360Cycle>[]>(() => [
    { key: 'name', header: 'Cycle', cell: (cycle) => <div><p className="font-medium">{cycle.name}</p><p className="text-xs text-muted-foreground">{cycle.cycleYear}</p></div> },
    { key: 'period', header: 'Period', cell: (cycle) => `${formatDate(cycle.startDate)} - ${formatDate(cycle.endDate)}` },
    { key: 'settings', header: 'Rules', cell: (cycle) => `${cycle.minPeerReviews ?? 3}-${cycle.maxPeerReviews ?? 5} peers` },
    { key: 'status', header: 'Status', cell: (cycle) => <Badge variant={statusVariant(cycle.status)}>{cycle.status}</Badge> },
    {
      key: 'action',
      header: 'Workflow',
      cell: (cycle) => {
        const path = cycle.status === 'DRAFT' ? 'activate' : cycle.status === 'ACTIVE' ? 'launch' : cycle.status === 'IN_PROGRESS' ? 'close' : cycle.status === 'CLOSED' ? 'archive' : '';
        return path ? (
          <Button size="sm" variant="outline" disabled={busyKey?.includes(cycle.id)} onClick={() => runCommand(`feedback-360-cycles/${cycle.id}/commands/${path}`, {}, [refetchFeedbackCycles, refetchFeedbackResponses])}>
            <MessageSquare className="mr-2 h-4 w-4" />
            {path}
          </Button>
        ) : <span className="text-sm text-muted-foreground">No action</span>;
      },
    },
  ], [busyKey, refetchFeedbackCycles, refetchFeedbackResponses, runCommand]);

  const feedbackResponseColumns = React.useMemo<DataTableColumn<Feedback360Response>[]>(() => [
    { key: 'reviewee', header: 'Reviewee', cell: (response) => workerName(workers.find((worker) => worker.id === response.revieweeId)) },
    { key: 'reviewer', header: 'Reviewer', cell: (response) => response.isAnonymous ? 'Anonymous' : workerName(workers.find((worker) => worker.id === response.reviewerId)) },
    { key: 'relationship', header: 'Relationship', cell: (response) => response.relationshipType },
    { key: 'rating', header: 'Rating', cell: (response) => response.overallRating ?? '-' },
    { key: 'status', header: 'Status', cell: (response) => <Badge variant={statusVariant(response.status)}>{response.status}</Badge> },
    {
      key: 'action',
      header: 'Workflow',
      cell: (response) => response.status === 'PENDING' ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busyKey?.includes(response.id)}
          onClick={() => {
            const rating = Number(window.prompt('Overall rating', '4'));
            if (Number.isFinite(rating)) {
              runCommand(`feedback-360-responses/${response.id}/commands/submit`, {
                competencyScores: { overall: rating },
                overallRating: rating,
                strengths: 'Submitted through HR admin workspace',
                improvements: 'Captured for calibration',
                comments: 'Feedback response submitted',
              }, refetchFeedbackResponses);
            }
          }}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Submit
        </Button>
      ) : <span className="text-sm text-muted-foreground">No action</span>,
    },
  ], [busyKey, refetchFeedbackResponses, runCommand, workers]);

  const calibrationColumns = React.useMemo<DataTableColumn<CalibrationSession>[]>(() => [
    { key: 'facilitator', header: 'Facilitator', cell: (session) => workerName(workers.find((worker) => worker.id === session.facilitatorId)) },
    { key: 'participants', header: 'Participants', cell: (session) => session.participants?.length ?? 0 },
    { key: 'status', header: 'Status', cell: (session) => <Badge variant={statusVariant(session.status)}>{session.status}</Badge> },
    {
      key: 'action',
      header: 'Workflow',
      cell: (session) => {
        const path = session.status === 'DRAFT' ? 'schedule' : session.status === 'SCHEDULED' ? 'start' : session.status === 'IN_PROGRESS' ? 'complete' : session.status === 'COMPLETED' ? 'finalize' : '';
        return path ? (
          <Button size="sm" variant="outline" disabled={busyKey?.includes(session.id)} onClick={() => runCommand(`calibration-sessions/${session.id}/commands/${path}`, {}, refetchCalibration)}>
            <ClipboardCheck className="mr-2 h-4 w-4" />
            {path}
          </Button>
        ) : <span className="text-sm text-muted-foreground">No action</span>;
      },
    },
  ], [busyKey, refetchCalibration, runCommand, workers]);

  const pipColumns = React.useMemo<DataTableColumn<PerformanceImprovementPlan>[]>(() => [
    { key: 'objectives', header: 'Objectives', cell: (pip) => pip.objectives?.join(', ') || '-' },
    { key: 'period', header: 'Period', cell: (pip) => `${formatDate(pip.startDate)} - ${formatDate(pip.endDate)}` },
    { key: 'status', header: 'Status', cell: (pip) => <Badge variant={statusVariant(pip.status)}>{pip.status}</Badge> },
    { key: 'action', header: 'Workflow', cell: (pip) => <Button size="sm" variant="outline" disabled={busyKey?.includes(pip.id)} onClick={() => runPipAction(pip)}>Next</Button> },
  ], [busyKey, runPipAction]);

  const developmentColumns = React.useMemo<DataTableColumn<DevelopmentPlan>[]>(() => [
    { key: 'title', header: 'Plan', cell: (plan) => <div><p className="font-medium">{plan.title}</p><p className="text-xs text-muted-foreground">{plan.description || 'No description'}</p></div> },
    { key: 'target', header: 'Target', cell: (plan) => formatDate(plan.targetCompletionDate) },
    { key: 'status', header: 'Status', cell: (plan) => <Badge variant={statusVariant(plan.status)}>{plan.status}</Badge> },
    { key: 'action', header: 'Workflow', cell: (plan) => <Button size="sm" variant="outline" disabled={busyKey?.includes(plan.id)} onClick={() => runDevelopmentAction(plan)}>Next</Button> },
  ], [busyKey, runDevelopmentAction]);

  const objectiveColumns = React.useMemo<DataTableColumn<Objective>[]>(() => [
    { key: 'title', header: 'Objective', cell: (objective) => <div><p className="font-medium">{objective.title}</p><p className="text-xs text-muted-foreground">{objective.period}</p></div> },
    { key: 'progress', header: 'Progress', cell: (objective) => `${objective.progress ?? 0}%` },
    { key: 'status', header: 'Status', cell: (objective) => <Badge variant={statusVariant(objective.status)}>{objective.status}</Badge> },
    { key: 'action', header: 'Workflow', cell: (objective) => <Button size="sm" variant="outline" disabled={busyKey?.includes(objective.id)} onClick={() => runObjectiveAction(objective)}>Next</Button> },
  ], [busyKey, runObjectiveAction]);

  const keyResultColumns = React.useMemo<DataTableColumn<KeyResult>[]>(() => [
    { key: 'title', header: 'Key Result', cell: (keyResult) => keyResult.title },
    { key: 'target', header: 'Target', cell: (keyResult) => `${keyResult.currentValue ?? 0} / ${keyResult.targetValue} ${keyResult.unit ?? ''}`.trim() },
    { key: 'progress', header: 'Progress', cell: (keyResult) => `${Math.round(keyResult.progress ?? 0)}%` },
    { key: 'status', header: 'Status', cell: (keyResult) => <Badge variant={statusVariant(keyResult.status)}>{keyResult.status}</Badge> },
    { key: 'action', header: 'Workflow', cell: (keyResult) => <Button size="sm" variant="outline" disabled={busyKey?.includes(keyResult.id)} onClick={() => runKeyResultAction(keyResult)}>Next</Button> },
  ], [busyKey, runKeyResultAction]);

  const kpiColumns = React.useMemo<DataTableColumn<Kpi>[]>(() => [
    { key: 'name', header: 'KPI', cell: (kpi) => <div><p className="font-medium">{kpi.name}</p><p className="text-xs text-muted-foreground">{kpi.department ?? '-'}</p></div> },
    { key: 'target', header: 'Target', cell: (kpi) => `${kpi.actualValue ?? 0} / ${kpi.targetValue ?? '-'} ${kpi.unit ?? ''}`.trim() },
    { key: 'frequency', header: 'Frequency', cell: (kpi) => kpi.frequency ?? '-' },
    { key: 'status', header: 'Status', cell: (kpi) => <Badge variant={statusVariant(kpi.status)}>{kpi.status}</Badge> },
    { key: 'action', header: 'Workflow', cell: (kpi) => <Button size="sm" variant="outline" disabled={busyKey?.includes(kpi.id)} onClick={() => runKpiAction(kpi)}>Next</Button> },
  ], [busyKey, runKpiAction]);

  const measurementColumns = React.useMemo<DataTableColumn<KpiMeasurement>[]>(() => [
    { key: 'period', header: 'Period', cell: (measurement) => `${formatDate(measurement.periodStart)} - ${formatDate(measurement.periodEnd)}` },
    { key: 'actual', header: 'Actual', cell: (measurement) => measurement.actualValue },
    { key: 'variance', header: 'Variance', cell: (measurement) => measurement.variance ?? '-' },
    { key: 'status', header: 'Status', cell: (measurement) => <Badge variant={statusVariant(measurement.status)}>{measurement.status}</Badge> },
    {
      key: 'action',
      header: 'Workflow',
      cell: (measurement) => measurement.status === 'RECORDED' ? (
        <Button size="sm" variant="outline" disabled={!user?.id || busyKey?.includes(measurement.id)} onClick={() => runCommand(`kpi-measurements/${measurement.id}/commands/validate`, { validatedBy: user?.id }, refetchMeasurements)}>
          Validate
        </Button>
      ) : <span className="text-sm text-muted-foreground">No action</span>,
    },
  ], [busyKey, refetchMeasurements, runCommand, user?.id]);

  const sectionButtons = [
    { id: 'reviews', label: 'Reviews', icon: UserCheck },
    { id: 'feedback', label: '360 Feedback', icon: MessageSquare },
    { id: 'calibration', label: 'Calibration', icon: ClipboardCheck },
    { id: 'growth', label: 'PIP & Development', icon: TrendingUp },
    { id: 'okr', label: 'OKR & KPI', icon: Target },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="rounded-md border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Performance Operations</h3>
            <p className="mt-1 text-sm text-slate-600">Complete performance workflows wired to command handlers, FSMs, scoped reads, and audit/outbox pipeline.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-md border bg-slate-50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Selected employee</p>
              <p className="text-sm font-medium">{workerName(workers.find((worker) => worker.id === effectiveWorkerId))}</p>
            </div>
            <div className="rounded-md border bg-slate-50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Review cycle</p>
              <p className="text-sm font-medium">{cycles.find((cycle) => cycle.id === effectiveCycleId)?.name ?? 'None'}</p>
            </div>
            <Button variant="outline" onClick={() => {
              refetchCycles();
              refetchReviews();
              refetchFeedbackCycles();
              refetchFeedbackResponses();
              refetchCalibration();
              refetchPips();
              refetchDevelopmentPlans();
              refetchObjectives();
              refetchKeyResults();
              refetchKpis();
              refetchMeasurements();
            }}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Operations
            </Button>
          </div>
        </div>
      </div>

      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div> : null}
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      <div className="flex flex-wrap gap-2 rounded-md border bg-white p-2">
        {sectionButtons.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.id}
              type="button"
              variant={section === item.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSection(item.id)}
            >
              <Icon className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </div>

      {section === 'reviews' ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="rounded-md">
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-lg">Employee Reviews</CardTitle>
                  <CardDescription>Self review, manager review, calibration, finalization, and acknowledgement.</CardDescription>
                </div>
                <EmployeeSelect value={selectedWorkerId} workers={workers} onChange={setSelectedWorkerId} />
              </div>
            </CardHeader>
            <CardContent>
              <DataTable columns={reviewColumns} data={reviews} keyExtractor={(review) => review.id} isLoading={reviewsLoading} emptyMessage="No reviews for this employee" />
            </CardContent>
          </Card>
          <Card className="rounded-md">
            <CardHeader>
              <CardTitle className="text-lg">Create Review</CardTitle>
              <CardDescription>Draft a review tied to employee, manager, and cycle.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  createEntity('reviews', reviewForm, refetchReviews);
                }}
              >
                <div className="space-y-2"><Label>Employee</Label><EmployeeSelect value={reviewForm.workerId} workers={workers} onChange={(value) => setReviewForm({ ...reviewForm, workerId: value })} /></div>
                <div className="space-y-2"><Label>Manager</Label><EmployeeSelect value={reviewForm.managerId} workers={workers} onChange={(value) => setReviewForm({ ...reviewForm, managerId: value })} placeholder="Select manager" /></div>
                <div className="space-y-2"><Label>Cycle</Label><CycleSelect value={reviewForm.reviewCycleId} cycles={cycles} onChange={(value) => setReviewForm({ ...reviewForm, reviewCycleId: value })} /></div>
                <Button className="w-full" disabled={busyKey === 'reviews' || !reviewForm.workerId || !reviewForm.managerId || !reviewForm.reviewCycleId}>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Create Review
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === 'feedback' ? (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-lg">360 Feedback Cycles</CardTitle>
                <CardDescription>Cycle launch and close workflow for peer/manager feedback collection.</CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable columns={feedbackCycleColumns} data={feedbackCycles} keyExtractor={(cycle) => cycle.id} emptyMessage="No 360 cycles yet" />
              </CardContent>
            </Card>
            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-lg">Create 360 Cycle</CardTitle>
                <CardDescription>Configure anonymous peer review rules.</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    createEntity('feedback-360-cycles', {
                      name: feedbackCycleForm.name,
                      cycleYear: Number(feedbackCycleForm.cycleYear),
                      startDate: feedbackCycleForm.startDate,
                      endDate: feedbackCycleForm.endDate,
                      anonymityEnabled: true,
                      minPeerReviews: Number(feedbackCycleForm.minPeerReviews),
                      maxPeerReviews: Number(feedbackCycleForm.maxPeerReviews),
                    }, refetchFeedbackCycles);
                  }}
                >
                  <div className="space-y-2"><Label htmlFor="feedback-cycle-name">Name</Label><Input id="feedback-cycle-name" value={feedbackCycleForm.name} onChange={(event) => setFeedbackCycleForm({ ...feedbackCycleForm, name: event.target.value })} required /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label htmlFor="feedback-cycle-year">Year</Label><Input id="feedback-cycle-year" type="number" value={feedbackCycleForm.cycleYear} onChange={(event) => setFeedbackCycleForm({ ...feedbackCycleForm, cycleYear: event.target.value })} required /></div>
                    <div className="space-y-2"><Label htmlFor="feedback-min">Min peers</Label><Input id="feedback-min" type="number" value={feedbackCycleForm.minPeerReviews} onChange={(event) => setFeedbackCycleForm({ ...feedbackCycleForm, minPeerReviews: event.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label htmlFor="feedback-start">Start</Label><Input id="feedback-start" type="date" value={feedbackCycleForm.startDate} onChange={(event) => setFeedbackCycleForm({ ...feedbackCycleForm, startDate: event.target.value })} required /></div>
                    <div className="space-y-2"><Label htmlFor="feedback-end">End</Label><Input id="feedback-end" type="date" value={feedbackCycleForm.endDate} onChange={(event) => setFeedbackCycleForm({ ...feedbackCycleForm, endDate: event.target.value })} required /></div>
                  </div>
                  <Button className="w-full" disabled={busyKey === 'feedback-360-cycles'}><MessageSquare className="mr-2 h-4 w-4" />Create 360 Cycle</Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card className="rounded-md">
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-lg">Feedback Responses</CardTitle>
                    <CardDescription>Response invitations and submission state for a selected 360 cycle.</CardDescription>
                  </div>
                  <Select
                    value={selectedFeedbackCycleId}
                    onValueChange={(value) => {
                      setSelectedFeedbackCycleId(value);
                      setFeedbackResponseForm((current) => ({ ...current, cycleId: value }));
                    }}
                    disabled={feedbackCycles.length === 0}
                  >
                    <SelectTrigger className="min-w-[260px]"><SelectValue placeholder="Select 360 cycle" /></SelectTrigger>
                    <SelectContent>{feedbackCycles.map((cycle) => <SelectItem key={cycle.id} value={cycle.id}>{cycle.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <DataTable columns={feedbackResponseColumns} data={feedbackResponses} keyExtractor={(response) => response.id} isLoading={feedbackResponsesLoading} emptyMessage="No responses for this cycle" />
              </CardContent>
            </Card>
            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-lg">Create Response</CardTitle>
                <CardDescription>Create a feedback response assignment.</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    createEntity('feedback-360-responses', feedbackResponseForm, refetchFeedbackResponses);
                  }}
                >
                  <div className="space-y-2"><Label>Cycle</Label><Select value={feedbackResponseForm.cycleId} onValueChange={(value) => setFeedbackResponseForm({ ...feedbackResponseForm, cycleId: value })}><SelectTrigger><SelectValue placeholder="Select cycle" /></SelectTrigger><SelectContent>{feedbackCycles.map((cycle) => <SelectItem key={cycle.id} value={cycle.id}>{cycle.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Reviewee</Label><EmployeeSelect value={feedbackResponseForm.revieweeId} workers={workers} onChange={(value) => setFeedbackResponseForm({ ...feedbackResponseForm, revieweeId: value })} /></div>
                  <div className="space-y-2"><Label>Reviewer</Label><EmployeeSelect value={feedbackResponseForm.reviewerId} workers={workers} onChange={(value) => setFeedbackResponseForm({ ...feedbackResponseForm, reviewerId: value })} /></div>
                  <div className="space-y-2"><Label>Relationship</Label><Select value={feedbackResponseForm.relationshipType} onValueChange={(value) => setFeedbackResponseForm({ ...feedbackResponseForm, relationshipType: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PEER">Peer</SelectItem><SelectItem value="MANAGER">Manager</SelectItem><SelectItem value="DIRECT_REPORT">Direct report</SelectItem><SelectItem value="STAKEHOLDER">Stakeholder</SelectItem></SelectContent></Select></div>
                  <Button className="w-full" disabled={busyKey === 'feedback-360-responses'}><Users className="mr-2 h-4 w-4" />Create Response</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {section === 'calibration' ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="rounded-md">
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-lg">Calibration Sessions</CardTitle>
                  <CardDescription>Schedule, start, complete, and finalize review calibration.</CardDescription>
                </div>
                <CycleSelect value={selectedCycleId} cycles={cycles} onChange={setSelectedCycleId} />
              </div>
            </CardHeader>
            <CardContent>
              <DataTable columns={calibrationColumns} data={calibrationSessions} keyExtractor={(session) => session.id} isLoading={calibrationLoading} emptyMessage="No calibration sessions for this cycle" />
            </CardContent>
          </Card>
          <Card className="rounded-md">
            <CardHeader>
              <CardTitle className="text-lg">Create Calibration</CardTitle>
              <CardDescription>Assign facilitator and participants.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  createEntity('calibration-sessions', {
                    reviewCycleId: calibrationForm.reviewCycleId,
                    facilitatorId: calibrationForm.facilitatorId,
                    participants: splitValues(calibrationForm.participants),
                  }, refetchCalibration);
                }}
              >
                <div className="space-y-2"><Label>Cycle</Label><CycleSelect value={calibrationForm.reviewCycleId} cycles={cycles} onChange={(value) => setCalibrationForm({ ...calibrationForm, reviewCycleId: value })} /></div>
                <div className="space-y-2"><Label>Facilitator</Label><EmployeeSelect value={calibrationForm.facilitatorId} workers={workers} onChange={(value) => setCalibrationForm({ ...calibrationForm, facilitatorId: value })} /></div>
                <FieldTextarea id="calibration-participants" label="Participant worker IDs" value={calibrationForm.participants} onChange={(value) => setCalibrationForm({ ...calibrationForm, participants: value })} />
                <Button className="w-full" disabled={busyKey === 'calibration-sessions'}><ClipboardCheck className="mr-2 h-4 w-4" />Create Session</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === 'growth' ? (
        <div className="space-y-5">
          <div className="rounded-md border bg-white p-4">
            <div className="grid gap-3 md:grid-cols-[260px_260px_1fr]">
              <div className="space-y-2"><Label>Employee</Label><EmployeeSelect value={selectedWorkerId} workers={workers} onChange={setSelectedWorkerId} /></div>
              <div className="space-y-2"><Label>Manager</Label><EmployeeSelect value={selectedManagerId} workers={workers} onChange={setSelectedManagerId} /></div>
              <div className="flex items-end">
                <EmptyNote text="PIPs and development plans are employee-scoped and stay governed by manager/HR access rules." />
              </div>
            </div>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-lg">Improvement Plans</CardTitle>
                <CardDescription>Formal improvement workflow for performance cases.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DataTable columns={pipColumns} data={pips} keyExtractor={(pip) => pip.id} isLoading={pipsLoading} emptyMessage="No PIPs for this employee" />
                <form
                  className="grid gap-3 rounded-md border bg-slate-50 p-3 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    createEntity('improvement-plans', {
                      workerId: pipForm.workerId,
                      managerId: pipForm.managerId,
                      objectives: splitValues(pipForm.objectives),
                      startDate: new Date().toISOString(),
                      endDate: pipForm.endDate || undefined,
                    }, refetchPips);
                  }}
                >
                  <div className="space-y-2"><Label>Employee</Label><EmployeeSelect value={pipForm.workerId} workers={workers} onChange={(value) => setPipForm({ ...pipForm, workerId: value })} /></div>
                  <div className="space-y-2"><Label>Manager</Label><EmployeeSelect value={pipForm.managerId} workers={workers} onChange={(value) => setPipForm({ ...pipForm, managerId: value })} /></div>
                  <div className="space-y-2 md:col-span-2"><Label htmlFor="pip-objectives">Objectives</Label><Input id="pip-objectives" value={pipForm.objectives} onChange={(event) => setPipForm({ ...pipForm, objectives: event.target.value })} placeholder="Improve punctuality, deliver weekly updates" required /></div>
                  <div className="space-y-2"><Label htmlFor="pip-end">End date</Label><Input id="pip-end" type="date" value={pipForm.endDate} onChange={(event) => setPipForm({ ...pipForm, endDate: event.target.value })} /></div>
                  <div className="flex items-end"><Button className="w-full" disabled={busyKey === 'improvement-plans'}>Create PIP</Button></div>
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-lg">Development Plans</CardTitle>
                <CardDescription>Growth plans for skills, resources, and career progress.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DataTable columns={developmentColumns} data={developmentPlans} keyExtractor={(plan) => plan.id} isLoading={developmentPlansLoading} emptyMessage="No development plans for this employee" />
                <form
                  className="grid gap-3 rounded-md border bg-slate-50 p-3 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    createEntity('development-plans', {
                      workerId: developmentForm.workerId,
                      managerId: developmentForm.managerId,
                      title: developmentForm.title,
                      description: developmentForm.description || undefined,
                      objectives: [{ title: developmentForm.objective, status: 'PLANNED' }],
                      skillsToDevelop: splitValues(developmentForm.skill),
                      resources: splitValues(developmentForm.resource),
                      startDate: new Date().toISOString(),
                      endDate: developmentForm.endDate || undefined,
                    }, refetchDevelopmentPlans);
                  }}
                >
                  <div className="space-y-2"><Label>Employee</Label><EmployeeSelect value={developmentForm.workerId} workers={workers} onChange={(value) => setDevelopmentForm({ ...developmentForm, workerId: value })} /></div>
                  <div className="space-y-2"><Label>Manager</Label><EmployeeSelect value={developmentForm.managerId} workers={workers} onChange={(value) => setDevelopmentForm({ ...developmentForm, managerId: value })} /></div>
                  <div className="space-y-2"><Label htmlFor="dev-title">Title</Label><Input id="dev-title" value={developmentForm.title} onChange={(event) => setDevelopmentForm({ ...developmentForm, title: event.target.value })} required /></div>
                  <div className="space-y-2"><Label htmlFor="dev-end">Target date</Label><Input id="dev-end" type="date" value={developmentForm.endDate} onChange={(event) => setDevelopmentForm({ ...developmentForm, endDate: event.target.value })} /></div>
                  <div className="space-y-2 md:col-span-2"><Label htmlFor="dev-objective">Objective</Label><Input id="dev-objective" value={developmentForm.objective} onChange={(event) => setDevelopmentForm({ ...developmentForm, objective: event.target.value })} required /></div>
                  <div className="space-y-2"><Label htmlFor="dev-skill">Skills</Label><Input id="dev-skill" value={developmentForm.skill} onChange={(event) => setDevelopmentForm({ ...developmentForm, skill: event.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="dev-resource">Resources</Label><Input id="dev-resource" value={developmentForm.resource} onChange={(event) => setDevelopmentForm({ ...developmentForm, resource: event.target.value })} /></div>
                  <div className="md:col-span-2"><Button className="w-full" disabled={busyKey === 'development-plans'}>Create Development Plan</Button></div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {section === 'okr' ? (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="rounded-md">
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-lg">Objectives</CardTitle>
                    <CardDescription>Employee-owned objectives connected to cycle and org unit.</CardDescription>
                  </div>
                  <EmployeeSelect value={selectedWorkerId} workers={workers} onChange={setSelectedWorkerId} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <DataTable columns={objectiveColumns} data={objectives} keyExtractor={(objective) => objective.id} isLoading={objectivesLoading} emptyMessage="No objectives for this employee" />
                <form
                  className="grid gap-3 rounded-md border bg-slate-50 p-3 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    createEntity('objectives', {
                      ownerId: objectiveForm.ownerId,
                      orgUnitId: objectiveForm.orgUnitId || undefined,
                      reviewCycleId: objectiveForm.reviewCycleId || undefined,
                      title: objectiveForm.title,
                      period: objectiveForm.period,
                      alignmentType: 'INDIVIDUAL',
                    }, refetchObjectives);
                  }}
                >
                  <div className="space-y-2"><Label>Owner</Label><EmployeeSelect value={objectiveForm.ownerId} workers={workers} onChange={(value) => setObjectiveForm({ ...objectiveForm, ownerId: value })} /></div>
                  <div className="space-y-2"><Label>Cycle</Label><CycleSelect value={objectiveForm.reviewCycleId} cycles={cycles} onChange={(value) => setObjectiveForm({ ...objectiveForm, reviewCycleId: value })} /></div>
                  <div className="space-y-2"><Label htmlFor="objective-title">Title</Label><Input id="objective-title" value={objectiveForm.title} onChange={(event) => setObjectiveForm({ ...objectiveForm, title: event.target.value })} required /></div>
                  <div className="space-y-2"><Label htmlFor="objective-period">Period</Label><Input id="objective-period" value={objectiveForm.period} onChange={(event) => setObjectiveForm({ ...objectiveForm, period: event.target.value })} required /></div>
                  <div className="space-y-2 md:col-span-2"><Label>Org Unit</Label><Select value={objectiveForm.orgUnitId} onValueChange={(value) => setObjectiveForm({ ...objectiveForm, orgUnitId: value })} disabled={orgUnits.length === 0}><SelectTrigger><SelectValue placeholder="Select org unit" /></SelectTrigger><SelectContent>{orgUnits.map((unit) => <SelectItem key={unit.id} value={unit.id}>{`${'  '.repeat(unit.depth)}${unit.name}`}</SelectItem>)}</SelectContent></Select></div>
                  <div className="md:col-span-2"><Button className="w-full" disabled={busyKey === 'objectives'}><Target className="mr-2 h-4 w-4" />Create Objective</Button></div>
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-md">
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-lg">Key Results</CardTitle>
                    <CardDescription>Measurable outcomes under the selected objective.</CardDescription>
                  </div>
                  <Select
                    value={selectedObjectiveId}
                    onValueChange={(value) => {
                      setSelectedObjectiveId(value);
                      setKeyResultForm((current) => ({ ...current, objectiveId: value }));
                    }}
                    disabled={objectives.length === 0}
                  >
                    <SelectTrigger className="min-w-[260px]"><SelectValue placeholder="Select objective" /></SelectTrigger>
                    <SelectContent>{objectives.map((objective) => <SelectItem key={objective.id} value={objective.id}>{objective.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <DataTable columns={keyResultColumns} data={keyResults} keyExtractor={(keyResult) => keyResult.id} isLoading={keyResultsLoading} emptyMessage="No key results for this objective" />
                <form
                  className="grid gap-3 rounded-md border bg-slate-50 p-3 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    createEntity('key-results', {
                      objectiveId: keyResultForm.objectiveId || effectiveObjectiveId,
                      title: keyResultForm.title,
                      targetValue: Number(keyResultForm.targetValue),
                      unit: keyResultForm.unit,
                    }, refetchKeyResults);
                  }}
                >
                  <div className="space-y-2 md:col-span-2"><Label htmlFor="kr-title">Title</Label><Input id="kr-title" value={keyResultForm.title} onChange={(event) => setKeyResultForm({ ...keyResultForm, title: event.target.value })} required /></div>
                  <div className="space-y-2"><Label htmlFor="kr-target">Target</Label><Input id="kr-target" type="number" value={keyResultForm.targetValue} onChange={(event) => setKeyResultForm({ ...keyResultForm, targetValue: event.target.value })} required /></div>
                  <div className="space-y-2"><Label htmlFor="kr-unit">Unit</Label><Input id="kr-unit" value={keyResultForm.unit} onChange={(event) => setKeyResultForm({ ...keyResultForm, unit: event.target.value })} /></div>
                  <div className="md:col-span-2"><Button className="w-full" disabled={busyKey === 'key-results' || !effectiveObjectiveId}><GitBranch className="mr-2 h-4 w-4" />Create Key Result</Button></div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="rounded-md">
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-lg">KPIs</CardTitle>
                    <CardDescription>Department KPIs and target/actual tracking.</CardDescription>
                  </div>
                  <Input className="max-w-[220px]" value={kpiCategory} onChange={(event) => setKpiCategory(event.target.value || 'HR')} aria-label="KPI category" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <DataTable columns={kpiColumns} data={kpis} keyExtractor={(kpi) => kpi.id} isLoading={kpisLoading} emptyMessage="No KPIs for this category" />
                <form
                  className="grid gap-3 rounded-md border bg-slate-50 p-3 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    createEntity('kpis', {
                      orgUnitId: kpiForm.orgUnitId,
                      ownerId: kpiForm.ownerId,
                      name: kpiForm.name,
                      departmentCategory: kpiForm.category,
                      targetValue: Number(kpiForm.targetValue),
                      unit: kpiForm.unit,
                      frequency: kpiForm.frequency,
                    }, refetchKpis);
                  }}
                >
                  <div className="space-y-2"><Label htmlFor="kpi-name">Name</Label><Input id="kpi-name" value={kpiForm.name} onChange={(event) => setKpiForm({ ...kpiForm, name: event.target.value })} required /></div>
                  <div className="space-y-2"><Label htmlFor="kpi-category">Category</Label><Input id="kpi-category" value={kpiForm.category} onChange={(event) => setKpiForm({ ...kpiForm, category: event.target.value })} required /></div>
                  <div className="space-y-2"><Label>Owner</Label><EmployeeSelect value={kpiForm.ownerId} workers={workers} onChange={(value) => setKpiForm({ ...kpiForm, ownerId: value })} /></div>
                  <div className="space-y-2"><Label>Org Unit</Label><Select value={kpiForm.orgUnitId} onValueChange={(value) => setKpiForm({ ...kpiForm, orgUnitId: value })} disabled={orgUnits.length === 0}><SelectTrigger><SelectValue placeholder="Select org unit" /></SelectTrigger><SelectContent>{orgUnits.map((unit) => <SelectItem key={unit.id} value={unit.id}>{`${'  '.repeat(unit.depth)}${unit.name}`}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label htmlFor="kpi-target">Target</Label><Input id="kpi-target" type="number" value={kpiForm.targetValue} onChange={(event) => setKpiForm({ ...kpiForm, targetValue: event.target.value })} required /></div>
                  <div className="space-y-2"><Label htmlFor="kpi-unit">Unit</Label><Input id="kpi-unit" value={kpiForm.unit} onChange={(event) => setKpiForm({ ...kpiForm, unit: event.target.value })} /></div>
                  <div className="md:col-span-2"><Button className="w-full" disabled={busyKey === 'kpis' || !kpiForm.orgUnitId}><Gauge className="mr-2 h-4 w-4" />Create KPI</Button></div>
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-md">
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-lg">KPI Measurements</CardTitle>
                    <CardDescription>Monthly KPI actuals and validation workflow.</CardDescription>
                  </div>
                  <Select
                    value={selectedKpiId}
                    onValueChange={(value) => {
                      setSelectedKpiId(value);
                      setMeasurementForm((current) => ({ ...current, kpiId: value }));
                    }}
                    disabled={kpis.length === 0}
                  >
                    <SelectTrigger className="min-w-[260px]"><SelectValue placeholder="Select KPI" /></SelectTrigger>
                    <SelectContent>{kpis.map((kpi) => <SelectItem key={kpi.id} value={kpi.id}>{kpi.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <DataTable columns={measurementColumns} data={kpiMeasurements} keyExtractor={(measurement) => measurement.id} isLoading={measurementsLoading} emptyMessage="No measurements for this KPI" />
                <form
                  className="grid gap-3 rounded-md border bg-slate-50 p-3 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    createEntity('kpi-measurements', {
                      kpiId: measurementForm.kpiId || effectiveKpiId,
                      period: measurementForm.period,
                      measuredValue: Number(measurementForm.measuredValue),
                      notes: measurementForm.notes || undefined,
                    }, refetchMeasurements);
                  }}
                >
                  <div className="space-y-2"><Label htmlFor="measurement-period">Period</Label><Input id="measurement-period" type="month" value={measurementForm.period} onChange={(event) => setMeasurementForm({ ...measurementForm, period: event.target.value })} required /></div>
                  <div className="space-y-2"><Label htmlFor="measurement-value">Actual</Label><Input id="measurement-value" type="number" value={measurementForm.measuredValue} onChange={(event) => setMeasurementForm({ ...measurementForm, measuredValue: event.target.value })} required /></div>
                  <div className="space-y-2 md:col-span-2"><Label htmlFor="measurement-notes">Notes</Label><Input id="measurement-notes" value={measurementForm.notes} onChange={(event) => setMeasurementForm({ ...measurementForm, notes: event.target.value })} /></div>
                  <div className="md:col-span-2"><Button className="w-full" disabled={busyKey === 'kpi-measurements' || !effectiveKpiId}><Activity className="mr-2 h-4 w-4" />Record Measurement</Button></div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border bg-white p-4 text-sm text-slate-600">
          <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck className="h-4 w-4 text-[#0b76d1]" />Access</div>
          Reads are scoped by tenant, employee, manager line, or HR performance role.
        </div>
        <div className="rounded-md border bg-white p-4 text-sm text-slate-600">
          <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900"><BarChart3 className="h-4 w-4 text-[#0b76d1]" />Lifecycle</div>
          Mutations use backend command handlers and FSM transitions instead of local-only UI state.
        </div>
        <div className="rounded-md border bg-white p-4 text-sm text-slate-600">
          <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900"><ClipboardCheck className="h-4 w-4 text-[#0b76d1]" />Audit</div>
          Command bus execution keeps idempotency, audit, transition ledger, and outbox behavior in the flow.
        </div>
      </div>
    </div>
  );
}
