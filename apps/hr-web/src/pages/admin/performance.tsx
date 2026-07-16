import * as React from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { useUIStore } from '@/stores/ui-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { formatDate } from '@/lib/utils';
import { AdminPerformanceOperations } from '@/pages/admin/performance-operations';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gauge,
  Goal,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import type { Worker } from '@/types';

type LifecycleStatus =
  | 'DRAFT'
  | 'SETUP'
  | 'ACTIVE'
  | 'IN_PROGRESS'
  | 'CALIBRATION'
  | 'REVIEW'
  | 'CLOSED'
  | 'ARCHIVED'
  | 'INACTIVE'
  | 'ACHIEVED'
  | 'MISSED'
  | 'CANCELLED';

interface PerformanceReviewCycle {
  id: string;
  name: string;
  cycleYear: number;
  startDate: string;
  endDate: string;
  reviewType: string;
  templateId?: string;
  weightings?: Record<string, number>;
  periods?: Array<{ name: string; startDate: string; endDate: string }>;
  status: LifecycleStatus;
}

interface ReviewTemplateSection {
  title: string;
  questions: string[];
  competencyIds: string[];
  weight: number;
}

interface ReviewTemplate {
  id: string;
  name: string;
  description?: string;
  sections?: ReviewTemplateSection[];
  ratingScale?: { min: number; max: number; labels: Record<string, string> };
  applicableRoles?: string[];
  status: LifecycleStatus;
}

interface Competency {
  id: string;
  name: string;
  description?: string;
  category: string;
  behavioralIndicators?: string[];
  proficiencyLevels?: Array<{ level: number; description: string; expectedBehaviors: string[] }>;
  status: LifecycleStatus;
}

interface PerformanceGoal {
  id: string;
  workerId: string;
  title: string;
  description?: string;
  metricName?: string;
  smartCriteria?: {
    specific?: string;
    measurable?: string;
    achievable?: string;
    relevant?: string;
    timeBound?: string;
  };
  baselineValue?: number;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  startDate?: string;
  dueDate?: string;
  weight?: number;
  reviewCadence?: string;
  evidenceRequired?: boolean;
  status: LifecycleStatus;
}

interface ManagerPerformanceDashboard {
  managerId: string;
  managerName: string;
  reportCount: number;
  analytics: {
    ratingDistribution?: Array<{ rating: number; count: number }>;
    goalMetrics?: { total: number; active: number; achieved: number; atRisk: number; averageProgress: number };
    peerFeedback?: { submitted: number; anonymousSubmitted: number; averageRating: number | null };
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

interface ReviewCycleForm {
  name: string;
  cycleYear: string;
  startDate: string;
  endDate: string;
  reviewType: string;
  templateId: string;
  selfWeight: string;
  managerWeight: string;
  peerWeight: string;
  selfReviewEnd: string;
  managerReviewEnd: string;
}

interface TemplateForm {
  name: string;
  description: string;
  sectionTitle: string;
  questions: string;
  applicableRoles: string;
}

interface CompetencyForm {
  name: string;
  category: string;
  description: string;
  behavioralIndicators: string;
}

interface GoalForm {
  workerId: string;
  title: string;
  description: string;
  metricName: string;
  baselineValue: string;
  targetValue: string;
  unit: string;
  startDate: string;
  dueDate: string;
  weight: string;
  reviewCadence: string;
  evidenceRequired: string;
  smartSpecific: string;
  smartMeasurable: string;
  smartAchievable: string;
  smartRelevant: string;
  smartTimeBound: string;
}

const EMPTY_CYCLE: ReviewCycleForm = {
  name: '',
  cycleYear: String(new Date().getFullYear()),
  startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
  endDate: new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10),
  reviewType: 'ANNUAL',
  templateId: '',
  selfWeight: '20',
  managerWeight: '50',
  peerWeight: '30',
  selfReviewEnd: new Date(new Date().getFullYear(), 0, 31).toISOString().slice(0, 10),
  managerReviewEnd: new Date(new Date().getFullYear(), 1, 28).toISOString().slice(0, 10),
};

const EMPTY_TEMPLATE: TemplateForm = {
  name: '',
  description: '',
  sectionTitle: 'Core performance',
  questions: 'What outcomes did the employee deliver?\nWhere did the employee demonstrate growth?\nWhat support is needed next?',
  applicableRoles: 'EMPLOYEE,MANAGER',
};

const EMPTY_COMPETENCY: CompetencyForm = {
  name: '',
  category: 'Leadership',
  description: '',
  behavioralIndicators: 'Owns outcomes\nGives clear feedback\nBuilds trust across teams',
};

const EMPTY_GOAL: GoalForm = {
  workerId: '',
  title: '',
  description: '',
  metricName: 'Performance outcome',
  baselineValue: '0',
  targetValue: '100',
  unit: '%',
  startDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10),
  weight: '100',
  reviewCadence: 'MONTHLY',
  evidenceRequired: 'Manager checkpoint\nWork samples',
  smartSpecific: '',
  smartMeasurable: '',
  smartAchievable: '',
  smartRelevant: '',
  smartTimeBound: '',
};

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function employeeName(worker: Worker): string {
  return `${worker.firstName} ${worker.lastName}`.trim() || worker.email || worker.employeeId;
}

function statusVariant(status: LifecycleStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ACTIVE':
    case 'IN_PROGRESS':
    case 'ACHIEVED':
      return 'default';
    case 'DRAFT':
    case 'SETUP':
    case 'CALIBRATION':
    case 'REVIEW':
      return 'secondary';
    case 'CLOSED':
    case 'ARCHIVED':
    case 'INACTIVE':
    case 'MISSED':
    case 'CANCELLED':
      return 'outline';
    default:
      return 'outline';
  }
}

function nextCycleCommand(status: LifecycleStatus): { label: string; path: string } | null {
  switch (status) {
    case 'DRAFT':
      return { label: 'Set Up', path: 'setup' };
    case 'SETUP':
      return { label: 'Activate', path: 'activate' };
    case 'ACTIVE':
      return { label: 'Start', path: 'start' };
    case 'IN_PROGRESS':
      return { label: 'Calibrate', path: 'enter-calibration' };
    case 'CALIBRATION':
      return { label: 'Review', path: 'enter-review' };
    case 'REVIEW':
      return { label: 'Close', path: 'close' };
    default:
      return null;
  }
}

function templateCommand(status: LifecycleStatus): { label: string; path: string } | null {
  if (status === 'DRAFT') return { label: 'Publish', path: 'publish' };
  if (status === 'ACTIVE') return { label: 'Archive', path: 'archive' };
  return null;
}

function competencyCommand(status: LifecycleStatus): { label: string; path: string } | null {
  if (status === 'DRAFT') return { label: 'Activate', path: 'activate' };
  if (status === 'ACTIVE') return { label: 'Deactivate', path: 'deactivate' };
  return null;
}

function goalProgress(goal: PerformanceGoal): string {
  if (goal.targetValue === undefined || goal.currentValue === undefined || goal.targetValue === 0) return '-';
  return `${Math.round((goal.currentValue / goal.targetValue) * 100)}%`;
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="fusion-glass fusion-hover rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-accent text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
        </div>
      </div>
    </div>
  );
}

function FieldTextarea({
  id,
  label,
  value,
  onChange,
  rows = 4,
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
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      />
    </div>
  );
}

export function AdminPerformance() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? '00000000-0000-0000-0000-000000000001';
  const [activeTab, setActiveTab] = React.useState<'cycles' | 'templates' | 'competencies' | 'goals' | 'manager' | 'operations'>('cycles');
  const [cycleForm, setCycleForm] = React.useState<ReviewCycleForm>(EMPTY_CYCLE);
  const [templateForm, setTemplateForm] = React.useState<TemplateForm>(EMPTY_TEMPLATE);
  const [competencyForm, setCompetencyForm] = React.useState<CompetencyForm>(EMPTY_COMPETENCY);
  const [goalForm, setGoalForm] = React.useState<GoalForm>(EMPTY_GOAL);
  const [selectedManagerId, setSelectedManagerId] = React.useState('');
  const [busyCommand, setBusyCommand] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const addNotification = useUIStore((state) => state.addNotification);

  const notifySuccess = React.useCallback((title: string, msg: string) =>
    addNotification({ title, message: msg, type: 'success', read: false }), [addNotification]);
  const notifyFailure = React.useCallback((title: string, err: unknown) =>
    addNotification({
      title,
      message: err instanceof Error ? err.message : 'The request could not be completed.',
      type: 'error',
      read: false,
    }), [addNotification]);

  const {
    data: cycles = [],
    isLoading: cyclesLoading,
    refetch: refetchCycles,
  } = useApiQuery<PerformanceReviewCycle[]>(
    ['performance-cycles', tenantId],
    `/performance/review-cycles/tenant/${tenantId}`,
    { enabled: Boolean(tenantId) },
  );

  const {
    data: templates = [],
    isLoading: templatesLoading,
    refetch: refetchTemplates,
  } = useApiQuery<ReviewTemplate[]>(
    ['performance-templates', tenantId],
    `/performance/review-templates/tenant/${tenantId}`,
    { enabled: Boolean(tenantId) },
  );

  const {
    data: competencies = [],
    isLoading: competenciesLoading,
    refetch: refetchCompetencies,
  } = useApiQuery<Competency[]>(
    ['performance-competencies', tenantId],
    `/performance/competencies/tenant/${tenantId}`,
    { enabled: Boolean(tenantId) },
  );

  const {
    data: workers = [],
    isLoading: workersLoading,
  } = useApiQuery<Worker[]>(
    ['performance-workers'],
    '/hr/core/workers?page=1&pageSize=100',
  );

  const selectedWorkerId = goalForm.workerId || workers[0]?.id || '';
  const selectedManagerWorkerId = selectedManagerId || workers[0]?.id || '';

  const {
    data: goals = [],
    isLoading: goalsLoading,
    refetch: refetchGoals,
  } = useApiQuery<PerformanceGoal[]>(
    ['performance-goals', selectedWorkerId],
    `/performance/goals/worker/${selectedWorkerId}`,
    { enabled: Boolean(selectedWorkerId) },
  );

  const {
    data: managerDashboard,
    isLoading: managerDashboardLoading,
    refetch: refetchManagerDashboard,
  } = useApiQuery<ManagerPerformanceDashboard>(
    ['performance-manager-dashboard', selectedManagerWorkerId],
    `/performance/analytics/manager/${selectedManagerWorkerId}`,
    { enabled: Boolean(selectedManagerWorkerId) },
  );

  React.useEffect(() => {
    if (!goalForm.workerId && workers[0]?.id) {
      setGoalForm((current) => ({ ...current, workerId: workers[0].id }));
    }
  }, [goalForm.workerId, workers]);

  React.useEffect(() => {
    if (!selectedManagerId && workers[0]?.id) {
      setSelectedManagerId(workers[0].id);
    }
  }, [selectedManagerId, workers]);

  const createCycleMutation = useApiMutation<unknown, {
    name: string;
    cycleYear: number;
    startDate: string;
    endDate: string;
    reviewType: string;
    templateId?: string;
    weightings?: Record<string, number>;
    periods?: Array<{ name: string; startDate: string; endDate: string }>;
  }>('/performance/review-cycles', 'post', [['performance-cycles']]);

  const createTemplateMutation = useApiMutation<unknown, {
    name: string;
    description?: string;
    sections: ReviewTemplateSection[];
    ratingScale: { min: number; max: number; labels: Record<string, string> };
    applicableRoles: string[];
  }>('/performance/review-templates', 'post', [['performance-templates']]);

  const createCompetencyMutation = useApiMutation<unknown, {
    name: string;
    category: string;
    description?: string;
    behavioralIndicators: string[];
    proficiencyLevels: Array<{ level: number; description: string; expectedBehaviors: string[] }>;
  }>('/performance/competencies', 'post', [['performance-competencies']]);

  const createGoalMutation = useApiMutation<unknown, {
    workerId: string;
    title: string;
    description?: string;
    metricName: string;
    smartCriteria: {
      specific: string;
      measurable: string;
      achievable: string;
      relevant: string;
      timeBound: string;
    };
    baselineValue?: number;
    targetValue: number;
    unit?: string;
    startDate: string;
    dueDate: string;
    weight?: number;
    reviewCadence?: string;
    evidenceRequired?: boolean;
  }>('/performance/goals', 'post', [['performance-goals']]);

  const selectedWorker = React.useMemo(
    () => workers.find((worker) => worker.id === selectedWorkerId),
    [selectedWorkerId, workers],
  );

  const selectedManager = React.useMemo(
    () => workers.find((worker) => worker.id === selectedManagerWorkerId),
    [selectedManagerWorkerId, workers],
  );

  const templateById = React.useMemo(
    () => new Map(templates.map((template) => [template.id, template])),
    [templates],
  );

  const activeTemplates = React.useMemo(
    () => templates.filter((template) => template.status === 'ACTIVE'),
    [templates],
  );

  const activeCycleCount = React.useMemo(
    () => cycles.filter((cycle) => ['ACTIVE', 'IN_PROGRESS', 'CALIBRATION', 'REVIEW'].includes(cycle.status)).length,
    [cycles],
  );

  const publishedTemplateCount = React.useMemo(
    () => templates.filter((template) => template.status === 'ACTIVE').length,
    [templates],
  );

  const activeCompetencyCount = React.useMemo(
    () => competencies.filter((competency) => competency.status === 'ACTIVE').length,
    [competencies],
  );

  const submitCycle = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selfEnd = cycleForm.selfReviewEnd || cycleForm.endDate;
    const managerEnd = cycleForm.managerReviewEnd || cycleForm.endDate;
    try {
      await createCycleMutation.mutateAsync({
        name: cycleForm.name,
        cycleYear: Number(cycleForm.cycleYear),
        startDate: cycleForm.startDate,
        endDate: cycleForm.endDate,
        reviewType: cycleForm.reviewType,
        templateId: cycleForm.templateId || undefined,
        weightings: {
          self: Number(cycleForm.selfWeight || 0),
          manager: Number(cycleForm.managerWeight || 0),
          peer: Number(cycleForm.peerWeight || 0),
        },
        periods: [
          { name: 'Self review', startDate: cycleForm.startDate, endDate: selfEnd },
          { name: 'Manager review', startDate: selfEnd, endDate: managerEnd },
          { name: 'Calibration and final review', startDate: managerEnd, endDate: cycleForm.endDate },
        ],
      });
      setCycleForm(EMPTY_CYCLE);
      setMessage('Review cycle created');
      notifySuccess('Review cycle created', 'The review cycle was created successfully.');
      refetchCycles();
    } catch (err) {
      notifyFailure('Could not create review cycle', err);
    }
  };

  const submitTemplate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createTemplateMutation.mutateAsync({
        name: templateForm.name,
        description: templateForm.description || undefined,
        sections: [{
          title: templateForm.sectionTitle,
          questions: splitLines(templateForm.questions),
          competencyIds: [],
          weight: 100,
        }],
        ratingScale: {
          min: 1,
          max: 5,
          labels: {
            '1': 'Needs improvement',
            '2': 'Partially meets',
            '3': 'Meets expectations',
            '4': 'Exceeds expectations',
            '5': 'Exceptional',
          },
        },
        applicableRoles: splitLines(templateForm.applicableRoles),
      });
      setTemplateForm(EMPTY_TEMPLATE);
      setMessage('Review template created');
      notifySuccess('Review template created', 'The review template was created successfully.');
      refetchTemplates();
    } catch (err) {
      notifyFailure('Could not create review template', err);
    }
  };

  const submitCompetency = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const indicators = splitLines(competencyForm.behavioralIndicators);
    try {
      await createCompetencyMutation.mutateAsync({
        name: competencyForm.name,
        category: competencyForm.category,
        description: competencyForm.description || undefined,
        behavioralIndicators: indicators,
        proficiencyLevels: [1, 2, 3, 4, 5].map((level) => ({
          level,
          description: `Level ${level}`,
          expectedBehaviors: indicators,
        })),
      });
      setCompetencyForm(EMPTY_COMPETENCY);
      setMessage('Competency created');
      notifySuccess('Competency created', 'The competency was created successfully.');
      refetchCompetencies();
    } catch (err) {
      notifyFailure('Could not create competency', err);
    }
  };

  const submitGoal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createGoalMutation.mutateAsync({
        workerId: goalForm.workerId,
        title: goalForm.title,
        description: goalForm.description || undefined,
        metricName: goalForm.metricName,
        smartCriteria: {
          specific: goalForm.smartSpecific,
          measurable: goalForm.smartMeasurable,
          achievable: goalForm.smartAchievable,
          relevant: goalForm.smartRelevant,
          timeBound: goalForm.smartTimeBound,
        },
        baselineValue: goalForm.baselineValue ? Number(goalForm.baselineValue) : undefined,
        targetValue: Number(goalForm.targetValue),
        unit: goalForm.unit || undefined,
        startDate: goalForm.startDate,
        dueDate: goalForm.dueDate,
        weight: goalForm.weight ? Number(goalForm.weight) : undefined,
        reviewCadence: goalForm.reviewCadence || undefined,
        evidenceRequired: splitLines(goalForm.evidenceRequired).length > 0,
      });
      setGoalForm((current) => ({ ...EMPTY_GOAL, workerId: current.workerId }));
      setMessage('Employee goal created');
      notifySuccess('Employee goal created', 'The employee goal was created successfully.');
      refetchGoals();
    } catch (err) {
      notifyFailure('Could not create employee goal', err);
    }
  };

  const runWorkflowCommand = React.useCallback(async (id: string, path: string, refetch: () => void) => {
    const commandKey = `${id}:${path}`;
    setBusyCommand(commandKey);
    try {
      const response = await apiClient.post(`/performance/${path}`);
      const notificationsCreated = (response.data?.data as { notificationsCreated?: number } | undefined)?.notificationsCreated;
      const successMessage = notificationsCreated ? `Workflow command completed. ${notificationsCreated} employee notifications sent.` : 'Workflow command completed';
      setMessage(successMessage);
      notifySuccess('Workflow command completed', successMessage);
      refetch();
    } catch (err) {
      notifyFailure('Workflow command failed', err);
    } finally {
      setBusyCommand(null);
    }
  }, [notifyFailure, notifySuccess]);

  const cycleColumns = React.useMemo<DataTableColumn<PerformanceReviewCycle>[]>(() => [
    {
      key: 'name',
      header: 'Cycle',
      cell: (cycle) => (
        <div>
          <p className="font-medium text-slate-950">{cycle.name}</p>
          <p className="text-xs text-muted-foreground">{cycle.reviewType} · {cycle.cycleYear}</p>
          {cycle.templateId ? (
            <p className="mt-1 text-xs text-slate-500">Template: {templateById.get(cycle.templateId)?.name ?? cycle.templateId}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'period',
      header: 'Period',
      cell: (cycle) => `${formatDate(cycle.startDate)} - ${formatDate(cycle.endDate)}`,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (cycle) => <Badge variant={statusVariant(cycle.status)}>{cycle.status}</Badge>,
    },
    {
      key: 'weightings',
      header: 'Weights',
      cell: (cycle) => cycle.weightings ? Object.entries(cycle.weightings).map(([key, value]) => `${key} ${value}%`).join(' / ') : '-',
    },
    {
      key: 'action',
      header: 'Workflow',
      cell: (cycle) => {
        const command = nextCycleCommand(cycle.status);
        if (!command) return <span className="text-sm text-muted-foreground">No action</span>;
        const commandKey = `${cycle.id}:review-cycles/${cycle.id}/commands/${command.path}`;
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={busyCommand === commandKey}
            onClick={() => runWorkflowCommand(cycle.id, `review-cycles/${cycle.id}/commands/${command.path}`, refetchCycles)}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {command.label}
          </Button>
        );
      },
    },
  ], [busyCommand, refetchCycles, runWorkflowCommand, templateById]);

  const templateColumns = React.useMemo<DataTableColumn<ReviewTemplate>[]>(() => [
    {
      key: 'name',
      header: 'Template',
      cell: (template) => (
        <div>
          <p className="font-medium text-slate-950">{template.name}</p>
          <p className="text-xs text-muted-foreground">{template.description || 'No description'}</p>
        </div>
      ),
    },
    {
      key: 'structure',
      header: 'Structure',
      cell: (template) => `${template.sections?.length ?? 0} sections · ${template.applicableRoles?.join(', ') || 'No roles'}`,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (template) => <Badge variant={statusVariant(template.status)}>{template.status}</Badge>,
    },
    {
      key: 'action',
      header: 'Workflow',
      cell: (template) => {
        const command = templateCommand(template.status);
        if (!command) return <span className="text-sm text-muted-foreground">No action</span>;
        const commandKey = `${template.id}:review-templates/${template.id}/commands/${command.path}`;
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={busyCommand === commandKey}
            onClick={() => runWorkflowCommand(template.id, `review-templates/${template.id}/commands/${command.path}`, refetchTemplates)}
          >
            <FileText className="mr-2 h-4 w-4" />
            {command.label}
          </Button>
        );
      },
    },
  ], [busyCommand, refetchTemplates, runWorkflowCommand]);

  const competencyColumns = React.useMemo<DataTableColumn<Competency>[]>(() => [
    {
      key: 'name',
      header: 'Competency',
      cell: (competency) => (
        <div>
          <p className="font-medium text-slate-950">{competency.name}</p>
          <p className="text-xs text-muted-foreground">{competency.description || 'No description'}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Category', cell: (competency) => competency.category },
    {
      key: 'depth',
      header: 'Definition',
      cell: (competency) => `${competency.behavioralIndicators?.length ?? 0} indicators · ${competency.proficiencyLevels?.length ?? 0} levels`,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (competency) => <Badge variant={statusVariant(competency.status)}>{competency.status}</Badge>,
    },
    {
      key: 'action',
      header: 'Workflow',
      cell: (competency) => {
        const command = competencyCommand(competency.status);
        if (!command) return <span className="text-sm text-muted-foreground">No action</span>;
        const commandKey = `${competency.id}:competencies/${competency.id}/commands/${command.path}`;
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={busyCommand === commandKey}
            onClick={() => runWorkflowCommand(competency.id, `competencies/${competency.id}/commands/${command.path}`, refetchCompetencies)}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {command.label}
          </Button>
        );
      },
    },
  ], [busyCommand, refetchCompetencies, runWorkflowCommand]);

  const goalColumns = React.useMemo<DataTableColumn<PerformanceGoal>[]>(() => [
    {
      key: 'title',
      header: 'Goal',
      cell: (goal) => (
        <div>
          <p className="font-medium text-slate-950">{goal.title}</p>
          <p className="text-xs text-muted-foreground">{goal.description || 'No description'}</p>
          <p className="mt-1 text-xs text-slate-500">{goal.metricName || 'Metric not set'}{goal.reviewCadence ? ` - ${goal.reviewCadence}` : ''}</p>
        </div>
      ),
    },
    {
      key: 'smart',
      header: 'SMART',
      cell: (goal) => (
        <div className="space-y-1 text-xs text-slate-600">
          <p>S: {goal.smartCriteria?.specific || '-'}</p>
          <p>M: {goal.smartCriteria?.measurable || '-'}</p>
        </div>
      ),
    },
    {
      key: 'target',
      header: 'Target',
      cell: (goal) => goal.targetValue === undefined ? '-' : `${goal.currentValue ?? goal.baselineValue ?? 0} / ${goal.targetValue} ${goal.unit ?? ''}`.trim(),
    },
    { key: 'progress', header: 'Progress', cell: goalProgress },
    { key: 'dueDate', header: 'Due', cell: (goal) => formatDate(goal.dueDate) },
    {
      key: 'status',
      header: 'Status',
      cell: (goal) => <Badge variant={statusVariant(goal.status)}>{goal.status}</Badge>,
    },
    {
      key: 'action',
      header: 'Workflow',
      cell: (goal) => goal.status === 'DRAFT' ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busyCommand === `${goal.id}:goals/${goal.id}/commands/activate`}
          onClick={() => runWorkflowCommand(goal.id, `goals/${goal.id}/commands/activate`, refetchGoals)}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Activate
        </Button>
      ) : <span className="text-sm text-muted-foreground">No action</span>,
    },
  ], [busyCommand, refetchGoals, runWorkflowCommand]);

  return (
    <div className="space-y-6">
      <section className="fusion-glass rounded-[2rem]">
        <div className="flex flex-col gap-4 border-b border-white/40 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white">Performance</Badge>
              <Badge variant="secondary">RBAC scoped</Badge>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                <span className="fusion-pulse h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <h2 className="fusion-gradient-text mt-3 text-2xl font-semibold">Performance Management</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Build review cycles, templates, competency libraries, and employee goals through the command pipeline.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              refetchCycles();
              refetchTemplates();
              refetchCompetencies();
              refetchGoals();
              refetchManagerDashboard();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile icon={BarChart3} label="Review Cycles" value={cycles.length} />
          <StatTile icon={Gauge} label="Active Cycles" value={activeCycleCount} />
          <StatTile icon={ClipboardCheck} label="Published Templates" value={publishedTemplateCount} />
          <StatTile icon={Sparkles} label="Active Competencies" value={activeCompetencyCount} />
        </div>
      </section>

      {message ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="h-4 w-4" />
          <span>{message}</span>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="h-auto flex-wrap justify-start fusion-glass p-1">
          <TabsTrigger value="cycles" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Cycles
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="competencies" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Competencies
          </TabsTrigger>
          <TabsTrigger value="goals" className="gap-2">
            <Goal className="h-4 w-4" />
            Goals
          </TabsTrigger>
          <TabsTrigger value="manager" className="gap-2">
            <Users className="h-4 w-4" />
            Manager Dashboard
          </TabsTrigger>
          <TabsTrigger value="operations" className="gap-2">
            <Activity className="h-4 w-4" />
            Operations
          </TabsTrigger>
        </TabsList>

      <TabsContent value="cycles">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Review Cycles</CardTitle>
              <CardDescription>Cycles move through draft, setup, active, review, and close states.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={cycleColumns}
                data={cycles}
                keyExtractor={(cycle) => cycle.id}
                isLoading={cyclesLoading}
                emptyMessage="No review cycles yet"
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Create Cycle</CardTitle>
              <CardDescription>Define the calendar window for a review period.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={submitCycle}>
                <div className="space-y-2">
                  <Label htmlFor="cycle-name">Name</Label>
                  <Input id="cycle-name" value={cycleForm.name} onChange={(event) => setCycleForm({ ...cycleForm, name: event.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="cycle-year">Year</Label>
                    <Input id="cycle-year" type="number" value={cycleForm.cycleYear} onChange={(event) => setCycleForm({ ...cycleForm, cycleYear: event.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={cycleForm.reviewType} onValueChange={(value) => setCycleForm({ ...cycleForm, reviewType: value })}>
                      <SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ANNUAL">Annual</SelectItem>
                        <SelectItem value="MID_YEAR">Mid Year</SelectItem>
                        <SelectItem value="PROBATION">Probation</SelectItem>
                        <SelectItem value="PROJECT">Project</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="cycle-start">Start</Label>
                    <Input id="cycle-start" type="date" value={cycleForm.startDate} onChange={(event) => setCycleForm({ ...cycleForm, startDate: event.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cycle-end">End</Label>
                    <Input id="cycle-end" type="date" value={cycleForm.endDate} onChange={(event) => setCycleForm({ ...cycleForm, endDate: event.target.value })} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Review Template</Label>
                  <Select value={cycleForm.templateId || 'none'} onValueChange={(value) => setCycleForm({ ...cycleForm, templateId: value === 'none' ? '' : value })}>
                    <SelectTrigger aria-label="Review Template"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No template</SelectItem>
                      {activeTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="cycle-self-weight">Self %</Label>
                    <Input id="cycle-self-weight" type="number" value={cycleForm.selfWeight} onChange={(event) => setCycleForm({ ...cycleForm, selfWeight: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cycle-manager-weight">Manager %</Label>
                    <Input id="cycle-manager-weight" type="number" value={cycleForm.managerWeight} onChange={(event) => setCycleForm({ ...cycleForm, managerWeight: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cycle-peer-weight">Peer %</Label>
                    <Input id="cycle-peer-weight" type="number" value={cycleForm.peerWeight} onChange={(event) => setCycleForm({ ...cycleForm, peerWeight: event.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="cycle-self-review-end">Self Review End</Label>
                    <Input id="cycle-self-review-end" type="date" value={cycleForm.selfReviewEnd} onChange={(event) => setCycleForm({ ...cycleForm, selfReviewEnd: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cycle-manager-review-end">Manager Review End</Label>
                    <Input id="cycle-manager-review-end" type="date" value={cycleForm.managerReviewEnd} onChange={(event) => setCycleForm({ ...cycleForm, managerReviewEnd: event.target.value })} />
                  </div>
                </div>
                <Button className="w-full" disabled={createCycleMutation.isPending}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Create Cycle
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="templates">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Review Templates</CardTitle>
              <CardDescription>Templates hold questions, rating scale, and role applicability.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={templateColumns}
                data={templates}
                keyExtractor={(template) => template.id}
                isLoading={templatesLoading}
                emptyMessage="No review templates yet"
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Create Template</CardTitle>
              <CardDescription>Build a reusable review form.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={submitTemplate}>
                <div className="space-y-2">
                  <Label htmlFor="template-name">Name</Label>
                  <Input id="template-name" value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-description">Description</Label>
                  <Input id="template-description" value={templateForm.description} onChange={(event) => setTemplateForm({ ...templateForm, description: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-section">Section</Label>
                  <Input id="template-section" value={templateForm.sectionTitle} onChange={(event) => setTemplateForm({ ...templateForm, sectionTitle: event.target.value })} required />
                </div>
                <FieldTextarea
                  id="template-questions"
                  label="Questions"
                  value={templateForm.questions}
                  onChange={(value) => setTemplateForm({ ...templateForm, questions: value })}
                />
                <div className="space-y-2">
                  <Label htmlFor="template-roles">Applicable Roles</Label>
                  <Input id="template-roles" value={templateForm.applicableRoles} onChange={(event) => setTemplateForm({ ...templateForm, applicableRoles: event.target.value })} required />
                </div>
                <Button className="w-full" disabled={createTemplateMutation.isPending}>
                  <FileText className="mr-2 h-4 w-4" />
                  Create Template
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="competencies">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Competency Library</CardTitle>
              <CardDescription>Competencies become active before they are used by templates and reviews.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={competencyColumns}
                data={competencies}
                keyExtractor={(competency) => competency.id}
                isLoading={competenciesLoading}
                emptyMessage="No competencies yet"
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Create Competency</CardTitle>
              <CardDescription>Define behavior indicators and proficiency levels.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={submitCompetency}>
                <div className="space-y-2">
                  <Label htmlFor="competency-name">Name</Label>
                  <Input id="competency-name" value={competencyForm.name} onChange={(event) => setCompetencyForm({ ...competencyForm, name: event.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="competency-category">Category</Label>
                  <Input id="competency-category" value={competencyForm.category} onChange={(event) => setCompetencyForm({ ...competencyForm, category: event.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="competency-description">Description</Label>
                  <Input id="competency-description" value={competencyForm.description} onChange={(event) => setCompetencyForm({ ...competencyForm, description: event.target.value })} />
                </div>
                <FieldTextarea
                  id="competency-indicators"
                  label="Behavioral Indicators"
                  value={competencyForm.behavioralIndicators}
                  onChange={(value) => setCompetencyForm({ ...competencyForm, behavioralIndicators: value })}
                />
                <Button className="w-full" disabled={createCompetencyMutation.isPending}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Create Competency
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="goals">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="rounded-2xl">
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-lg">Employee Goals</CardTitle>
                  <CardDescription>{selectedWorker ? employeeName(selectedWorker) : 'Select an employee'} goal plan.</CardDescription>
                </div>
                <div className="min-w-[260px]">
                  <Select
                    value={selectedWorkerId}
                    onValueChange={(value) => setGoalForm((current) => ({ ...current, workerId: value }))}
                    disabled={workersLoading || workers.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {workers.map((worker) => (
                        <SelectItem key={worker.id} value={worker.id}>
                          {employeeName(worker)} · {worker.employeeId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={goalColumns}
                data={goals}
                keyExtractor={(goal) => goal.id}
                isLoading={goalsLoading}
                emptyMessage="No goals for this employee"
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Create SMART Goal</CardTitle>
              <CardDescription>Assign a specific, measurable, achievable, relevant, and time-bound goal.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={submitGoal}>
                <div className="space-y-2">
                  <Label htmlFor="goal-title">Title</Label>
                  <Input id="goal-title" value={goalForm.title} onChange={(event) => setGoalForm({ ...goalForm, title: event.target.value })} required />
                </div>
                <FieldTextarea
                  id="goal-description"
                  label="Goal Description"
                  value={goalForm.description}
                  onChange={(value) => setGoalForm({ ...goalForm, description: value })}
                  rows={3}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="goal-metric">Metric Name</Label>
                    <Input id="goal-metric" value={goalForm.metricName} onChange={(event) => setGoalForm({ ...goalForm, metricName: event.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Review Cadence</Label>
                    <Select value={goalForm.reviewCadence} onValueChange={(value) => setGoalForm({ ...goalForm, reviewCadence: value })}>
                      <SelectTrigger aria-label="Review Cadence"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="BIWEEKLY">Biweekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-3 fusion-glass rounded-2xl p-3">
                  <p className="text-sm font-semibold text-slate-900">SMART Definition</p>
                  <FieldTextarea id="goal-smart-specific" label="Specific" value={goalForm.smartSpecific} onChange={(value) => setGoalForm({ ...goalForm, smartSpecific: value })} rows={2} />
                  <FieldTextarea id="goal-smart-measurable" label="Measurable" value={goalForm.smartMeasurable} onChange={(value) => setGoalForm({ ...goalForm, smartMeasurable: value })} rows={2} />
                  <FieldTextarea id="goal-smart-achievable" label="Achievable" value={goalForm.smartAchievable} onChange={(value) => setGoalForm({ ...goalForm, smartAchievable: value })} rows={2} />
                  <FieldTextarea id="goal-smart-relevant" label="Relevant" value={goalForm.smartRelevant} onChange={(value) => setGoalForm({ ...goalForm, smartRelevant: value })} rows={2} />
                  <FieldTextarea id="goal-smart-time-bound" label="Time Bound" value={goalForm.smartTimeBound} onChange={(value) => setGoalForm({ ...goalForm, smartTimeBound: value })} rows={2} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="goal-baseline">Baseline</Label>
                    <Input id="goal-baseline" type="number" value={goalForm.baselineValue} onChange={(event) => setGoalForm({ ...goalForm, baselineValue: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goal-target">Target</Label>
                    <Input id="goal-target" type="number" value={goalForm.targetValue} onChange={(event) => setGoalForm({ ...goalForm, targetValue: event.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goal-unit">Unit</Label>
                    <Input id="goal-unit" value={goalForm.unit} onChange={(event) => setGoalForm({ ...goalForm, unit: event.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="goal-start">Start Date</Label>
                    <Input id="goal-start" type="date" value={goalForm.startDate} onChange={(event) => setGoalForm({ ...goalForm, startDate: event.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goal-due">Due Date</Label>
                    <Input id="goal-due" type="date" value={goalForm.dueDate} onChange={(event) => setGoalForm({ ...goalForm, dueDate: event.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goal-weight">Weight</Label>
                    <Input id="goal-weight" type="number" value={goalForm.weight} onChange={(event) => setGoalForm({ ...goalForm, weight: event.target.value })} />
                  </div>
                </div>
                <FieldTextarea id="goal-evidence" label="Evidence Required" value={goalForm.evidenceRequired} onChange={(value) => setGoalForm({ ...goalForm, evidenceRequired: value })} rows={3} />
                <Button className="w-full" disabled={createGoalMutation.isPending || !goalForm.workerId || !goalForm.metricName || !goalForm.targetValue || !goalForm.dueDate}>
                  <Goal className="mr-2 h-4 w-4" />
                  Create SMART Goal
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="manager">
        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Manager Scope</CardTitle>
              <CardDescription>Dashboard analytics are built from direct reports only.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Manager</Label>
                <Select
                  value={selectedManagerWorkerId}
                  onValueChange={setSelectedManagerId}
                  disabled={workersLoading || workers.length === 0}
                >
                  <SelectTrigger aria-label="Manager"><SelectValue placeholder="Select manager" /></SelectTrigger>
                  <SelectContent>
                    {workers.map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {employeeName(worker)} · {worker.employeeId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="fusion-glass rounded-2xl p-3">
                <p className="text-sm font-semibold text-slate-950">{selectedManager ? employeeName(selectedManager) : 'No manager selected'}</p>
                <p className="mt-1 text-sm text-slate-600">{managerDashboard?.reportCount ?? 0} direct reports in the current tenant scope.</p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => refetchManagerDashboard()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Dashboard
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile icon={Users} label="Direct Reports" value={managerDashboardLoading ? '-' : managerDashboard?.reportCount ?? 0} />
              <StatTile icon={Goal} label="Avg Goal Progress" value={`${Math.round(managerDashboard?.analytics.goalMetrics?.averageProgress ?? 0)}%`} />
              <StatTile icon={Sparkles} label="Recognitions" value={managerDashboard?.analytics.recognitions?.length ?? 0} />
              <StatTile icon={Gauge} label="At Risk Goals" value={managerDashboard?.analytics.goalMetrics?.atRisk ?? 0} />
            </div>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Talent Grid</CardTitle>
                <CardDescription>Nine-box placement and performance actions from reviews, goals, objectives, and feedback.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(managerDashboard?.analytics.nineBox ?? []).length ? managerDashboard?.analytics.nineBox?.map((item) => (
                  <div key={item.workerId} className="grid gap-3 fusion-glass rounded-2xl p-3 md:grid-cols-[1fr_140px_140px_160px] md:items-center">
                    <div>
                      <p className="font-medium text-slate-950">{item.employeeName}</p>
                      <p className="text-xs text-muted-foreground">{item.workerId}</p>
                    </div>
                    <p className="text-sm text-slate-700">Performance {Math.round(item.performanceScore)}%</p>
                    <p className="text-sm text-slate-700">Potential {Math.round(item.potentialScore)}%</p>
                    <Badge variant="outline">{item.box}</Badge>
                  </div>
                )) : (
                  <p className="rounded-md border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">No direct-report analytics available yet.</p>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg">Action Plans</CardTitle>
                  <CardDescription>Manager-owned coaching actions generated from performance signals.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(managerDashboard?.analytics.actionPlans ?? []).slice(0, 5).map((plan) => (
                    <div key={plan.workerId} className="fusion-glass rounded-2xl p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-950">{plan.employeeName}</p>
                        <Badge variant={plan.riskLevel === 'HIGH' ? 'destructive' : plan.riskLevel === 'MEDIUM' ? 'secondary' : 'outline'}>{plan.riskLevel}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Trend: {plan.progressTrend}</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-700">
                        {plan.recommendedActions.slice(0, 2).map((action) => <li key={action}>- {action}</li>)}
                      </ul>
                    </div>
                  ))}
                  {managerDashboard?.analytics.actionPlans?.length ? null : (
                    <p className="rounded-md border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">No action plans generated yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg">Recognition</CardTitle>
                  <CardDescription>Best employee signals from the performance analytics engine.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(managerDashboard?.analytics.recognitions ?? []).slice(0, 5).map((recognition) => (
                    <div key={recognition.workerId} className="fusion-glass rounded-2xl p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-950">{recognition.employeeName}</p>
                        <Badge>{Math.round(recognition.score)}%</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{recognition.reason}</p>
                    </div>
                  ))}
                  {managerDashboard?.analytics.recognitions?.length ? null : (
                    <p className="rounded-md border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">No recognition candidates yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="operations">
        <AdminPerformanceOperations />
      </TabsContent>
      </Tabs>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="fusion-glass fusion-hover rounded-2xl p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Governance
          </div>
          <p className="mt-2 text-sm text-slate-600">Tenant, role, and manager scope are enforced by the API before data is returned.</p>
        </div>
        <div className="fusion-glass fusion-hover rounded-2xl p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Users className="h-4 w-4 text-primary" />
            Employee Scope
          </div>
          <p className="mt-2 text-sm text-slate-600">Goals and reviews stay tied to employee records and reporting-line access.</p>
        </div>
        <div className="fusion-glass fusion-hover rounded-2xl p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Workflow Ledger
          </div>
          <p className="mt-2 text-sm text-slate-600">Create and lifecycle actions run through command bus, FSM, audit, and outbox handling.</p>
        </div>
      </section>
    </div>
  );
}
