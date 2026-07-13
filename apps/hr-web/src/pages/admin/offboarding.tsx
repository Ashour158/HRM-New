import * as React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { useUIStore } from '@/stores/ui-store';
import { cn, generateUUID } from '@/lib/utils';
import {
  ArrowRight,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Landmark,
  LogOut,
  MessageSquare,
  ShieldOff,
  SkipForward,
  Users2,
} from 'lucide-react';
import type { Worker } from '@/types';

type OwnerGroup = 'HR' | 'IT' | 'Finance' | 'Manager' | 'Security' | 'Facilities' | 'Employee';
type TaskCategory =
  | 'EXIT_CHECKLIST'
  | 'KNOWLEDGE_TRANSFER'
  | 'ASSET_RETURN'
  | 'ACCESS_REVOCATION_CONFIRMATION'
  | 'FINAL_SETTLEMENT_CONFIRMATION'
  | 'EXIT_INTERVIEW'
  | 'DOCUMENT'
  | 'COMPLIANCE';
type OffboardingPlanStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
type OffboardingTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'SKIPPED';
type ReasonCategory =
  | 'RESIGNATION'
  | 'INVOLUNTARY_TERMINATION'
  | 'LAYOFF_REDUNDANCY'
  | 'RETIREMENT'
  | 'END_OF_CONTRACT'
  | 'MUTUAL_AGREEMENT'
  | 'OTHER';

interface OffboardingPlan {
  id: string;
  workerId: string;
  lastWorkingDay: string;
  status: OffboardingPlanStatus;
  initiatedBy?: string;
  reasonCategory?: ReasonCategory;
  reasonNotes?: string;
  managerId?: string;
}

interface OffboardingTask {
  id: string;
  offboardingPlanId?: string;
  planId?: string;
  title: string;
  description?: string;
  assignedTo?: string;
  ownerGroup?: string;
  category?: TaskCategory;
  evidenceType?: string;
  dueDate?: string;
  completedAt?: string;
  status: OffboardingTaskStatus;
}

interface PlanForm {
  workerId: string;
  lastWorkingDay: string;
  reasonCategory: ReasonCategory;
  managerId: string;
}

interface TaskForm {
  title: string;
  description: string;
  ownerGroup: OwnerGroup;
  dueDate: string;
}

const ownerGroups: OwnerGroup[] = ['HR', 'IT', 'Finance', 'Manager', 'Security', 'Facilities', 'Employee'];
const reasonCategories: ReasonCategory[] = ['RESIGNATION', 'INVOLUNTARY_TERMINATION', 'LAYOFF_REDUNDANCY', 'RETIREMENT', 'END_OF_CONTRACT', 'MUTUAL_AGREEMENT', 'OTHER'];

const ownerStyles: Record<OwnerGroup, string> = {
  HR: 'border-secondary/30 bg-secondary/10 text-primary',
  IT: 'border-primary/30 bg-accent text-foreground',
  Finance: 'border-warning/30 bg-warning/70 text-warning-foreground',
  Manager: 'border-secondary/30 bg-secondary/10 text-secondary',
  Security: 'border-destructive/30 bg-destructive/10 text-destructive-foreground',
  Facilities: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  Employee: 'border-primary/30 bg-primary/10 text-primary',
};

const taskTemplates: Array<{
  title: string;
  ownerGroup: OwnerGroup;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: TaskCategory;
  evidenceType: string;
}> = [
  {
    title: 'Manager exit checklist confirmation',
    ownerGroup: 'Manager',
    description: 'Team handover plan, coverage during notice period, and exit logistics.',
    icon: ClipboardCheck,
    category: 'EXIT_CHECKLIST',
    evidenceType: 'MANAGER_CONFIRMATION',
  },
  {
    title: 'Knowledge transfer handover',
    ownerGroup: 'Employee',
    description: 'Document active work, credentials, ongoing projects, and handover recipients.',
    icon: Users2,
    category: 'KNOWLEDGE_TRANSFER',
    evidenceType: 'HANDOVER_NOTES',
  },
  {
    title: 'Return company assets',
    ownerGroup: 'Facilities',
    description: 'Free-text confirmation of laptop, badge, phone, and other company-owned equipment returned.',
    icon: Boxes,
    category: 'ASSET_RETURN',
    evidenceType: 'ASSET_RETURN_CONFIRMATION',
  },
  {
    title: 'IT access revocation confirmation',
    ownerGroup: 'IT',
    description: 'Email, HRM, ERP, and application accounts deactivated.',
    icon: ShieldOff,
    category: 'ACCESS_REVOCATION_CONFIRMATION',
    evidenceType: 'PROVISIONING_TICKET',
  },
  {
    title: 'Facility and badge access revocation confirmation',
    ownerGroup: 'Security',
    description: 'Building badge, parking access, and physical keys deactivated or collected.',
    icon: ShieldOff,
    category: 'ACCESS_REVOCATION_CONFIRMATION',
    evidenceType: 'SECURITY_CONFIRMATION',
  },
  {
    title: 'Exit interview',
    ownerGroup: 'HR',
    description: 'Reason for leaving, feedback, and rehire eligibility.',
    icon: MessageSquare,
    category: 'EXIT_INTERVIEW',
    evidenceType: 'EXIT_INTERVIEW_NOTES',
  },
  {
    title: 'Final settlement confirmation',
    ownerGroup: 'Finance',
    description: 'Final pay, unused leave payout, and outstanding dues settled.',
    icon: Landmark,
    category: 'FINAL_SETTLEMENT_CONFIRMATION',
    evidenceType: 'SETTLEMENT_CONFIRMATION',
  },
];

function unwrap<T>(payload: unknown): T {
  const response = payload as { data?: T; success?: boolean };
  if (response.success === true && response.data !== undefined) return response.data;
  return payload as T;
}

function mutationError(error: unknown): string {
  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  const message = response?.data?.message ?? (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : 'Please try again.';
}

function workerName(worker?: Worker) {
  if (!worker) return 'Unassigned worker';
  return `${worker.firstName} ${worker.lastName}`.trim();
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(value));
}

function inferOwnerGroup(task: Pick<OffboardingTask, 'description' | 'title' | 'ownerGroup'>): OwnerGroup {
  const structuredOwner = task.ownerGroup;
  if (structuredOwner) {
    const normalized = structuredOwner.charAt(0).toUpperCase() + structuredOwner.slice(1).toLowerCase();
    if (ownerGroups.includes(normalized as OwnerGroup)) return normalized as OwnerGroup;
  }
  const text = `${task.title} ${task.description ?? ''}`.toLowerCase();
  if (text.includes('it ') || text.includes('laptop') || text.includes('account') || text.includes('access')) return 'IT';
  if (text.includes('finance') || text.includes('settlement') || text.includes('payroll')) return 'Finance';
  if (text.includes('facility') || text.includes('desk') || text.includes('badge') || text.includes('asset')) return 'Facilities';
  if (text.includes('security')) return 'Security';
  if (text.includes('manager') || text.includes('checklist')) return 'Manager';
  if (text.includes('knowledge') || text.includes('handover') || text.includes('interview')) return 'Employee';
  return 'HR';
}

function taskPlanId(task: OffboardingTask) {
  return task.offboardingPlanId ?? task.planId ?? '';
}

function completionPercent(tasks: OffboardingTask[]) {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((task) => task.status === 'COMPLETED' || task.status === 'SKIPPED').length / tasks.length) * 100);
}

function toPlanList(payload: unknown): OffboardingPlan[] {
  return Array.isArray(payload) ? payload as OffboardingPlan[] : [];
}

function toTaskList(payload: unknown): OffboardingTask[] {
  return Array.isArray(payload) ? payload as OffboardingTask[] : [];
}

function defaultLastWorkingDay(daysFromNow: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

export function AdminOffboarding() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);
  const [selectedPlanId, setSelectedPlanId] = React.useState('');
  const [form, setForm] = React.useState<PlanForm>({
    workerId: '',
    lastWorkingDay: defaultLastWorkingDay(14),
    reasonCategory: 'RESIGNATION',
    managerId: 'none',
  });
  const [taskForm, setTaskForm] = React.useState<TaskForm>({
    title: taskTemplates[0].title,
    description: taskTemplates[0].description,
    ownerGroup: taskTemplates[0].ownerGroup,
    dueDate: defaultLastWorkingDay(0),
  });

  const { data: workers = [] } = useApiQuery<Worker[]>(['admin-offboarding-workers'], '/hr/core/workers?status=ACTIVE&pageSize=100');

  const { data: plans = [], isLoading: plansLoading, isError: plansError, error: plansErrorObj, refetch: refetchPlans } = useQuery({
    queryKey: ['admin-offboarding-plans'],
    queryFn: async () => toPlanList(unwrap<unknown>((await apiClient.get('/hr/offboarding/plans')).data)),
  });

  React.useEffect(() => {
    if (!selectedPlanId && plans[0]) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plans, selectedPlanId]);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];

  const { data: selectedTasks = [], isLoading: tasksLoading, isError: tasksError, error: tasksErrorObj, refetch: refetchTasks } = useQuery({
    queryKey: ['admin-offboarding-tasks', selectedPlan?.id],
    enabled: Boolean(selectedPlan?.id),
    queryFn: async () => toTaskList(unwrap<unknown>((await apiClient.get(`/hr/offboarding/tasks/plan/${selectedPlan?.id}`)).data)),
  });

  const createPlanMutation = useApiMutation<unknown, {
    planId: string;
    workerId: string;
    lastWorkingDay: string;
    reasonCategory?: ReasonCategory;
    managerId?: string;
  }>(
    '/hr/offboarding/plans',
    'post',
    [['admin-offboarding-plans']],
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-offboarding-plans'] });
        addNotification({ title: 'Exit plan launched', message: 'The offboarding plan was created.', type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: 'Something went wrong', message: mutationError(error), type: 'error', read: false }),
    },
  );
  const startPlanMutation = useApiMutation<unknown, { id: string }>(
    ({ id }) => `/hr/offboarding/plans/${id}/commands/start`,
    'post',
    [['admin-offboarding-plans']],
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-offboarding-plans'] });
        addNotification({ title: 'Plan started', message: 'The offboarding plan is now active.', type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: 'Something went wrong', message: mutationError(error), type: 'error', read: false }),
    },
  );
  const completePlanMutation = useApiMutation<unknown, { id: string }>(
    ({ id }) => `/hr/offboarding/plans/${id}/commands/complete`,
    'post',
    [['admin-offboarding-plans']],
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-offboarding-plans'] });
        addNotification({ title: 'Exit complete', message: 'The offboarding plan has been completed.', type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: 'Something went wrong', message: mutationError(error), type: 'error', read: false }),
    },
  );
  const createTaskMutation = useApiMutation<unknown, {
    taskId: string;
    planId: string;
    title: string;
    description?: string;
    ownerGroup?: OwnerGroup;
    category?: TaskCategory;
    evidenceType?: string;
    dueDate?: string;
  }>(
    '/hr/offboarding/tasks',
    'post',
    [['admin-offboarding-tasks']],
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ['admin-offboarding-tasks', selectedPlan?.id] });
        addNotification({ title: 'Task added', message: 'The exit task was added.', type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: 'Something went wrong', message: mutationError(error), type: 'error', read: false }),
    },
  );
  const completeTaskMutation = useApiMutation<unknown, { id: string }>(
    ({ id }) => `/hr/offboarding/tasks/${id}/commands/complete`,
    'post',
    [['admin-offboarding-tasks']],
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ['admin-offboarding-tasks', selectedPlan?.id] });
        addNotification({ title: 'Task completed', message: 'The exit task has been marked complete.', type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: 'Something went wrong', message: mutationError(error), type: 'error', read: false }),
    },
  );
  const skipTaskMutation = useApiMutation<unknown, { id: string }>(
    ({ id }) => `/hr/offboarding/tasks/${id}/commands/skip`,
    'post',
    [['admin-offboarding-tasks']],
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ['admin-offboarding-tasks', selectedPlan?.id] });
        addNotification({ title: 'Task skipped', message: 'The exit task was marked not applicable.', type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: 'Something went wrong', message: mutationError(error), type: 'error', read: false }),
    },
  );

  const workerById = React.useMemo(() => new Map(workers.map((worker) => [worker.id, worker])), [workers]);
  const selectedWorker = selectedPlan ? workerById.get(selectedPlan.workerId) : undefined;
  const completed = completionPercent(selectedTasks);
  const activePlans = plans.filter((plan) => plan.status !== 'COMPLETED' && plan.status !== 'CANCELLED').length;
  const overdueTasks = selectedTasks.filter((task) => task.status === 'OVERDUE').length;
  const averageProgress = plans.length === 0 ? 0 : completed;
  const ownerCounts = ownerGroups.map((ownerGroup) => ({
    ownerGroup,
    total: selectedTasks.filter((task) => inferOwnerGroup(task) === ownerGroup).length,
  }));

  const submitPlan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.workerId) return;
    const planId = generateUUID();
    await createPlanMutation.mutateAsync({
      planId,
      workerId: form.workerId,
      lastWorkingDay: form.lastWorkingDay,
      reasonCategory: form.reasonCategory,
      managerId: form.managerId !== 'none' ? form.managerId : undefined,
    });
    setSelectedPlanId(planId);
    setForm((current) => ({ ...current, workerId: '', managerId: 'none' }));
  };

  const submitTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPlan?.id || !taskForm.title.trim()) return;
    await createTaskMutation.mutateAsync({
      taskId: generateUUID(),
      planId: selectedPlan.id,
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      ownerGroup: taskForm.ownerGroup,
      category: taskTemplates.find((template) => template.title === taskForm.title)?.category ?? 'EXIT_CHECKLIST',
      evidenceType: taskTemplates.find((template) => template.title === taskForm.title)?.evidenceType,
      dueDate: taskForm.dueDate || undefined,
    });
  };

  const addTemplate = async (template: (typeof taskTemplates)[number]) => {
    if (!selectedPlan?.id) return;
    await createTaskMutation.mutateAsync({
      taskId: generateUUID(),
      planId: selectedPlan.id,
      title: template.title,
      description: template.description,
      ownerGroup: template.ownerGroup,
      category: template.category,
      evidenceType: template.evidenceType,
      dueDate: selectedPlan.lastWorkingDay,
    });
  };

  return (
    <div className="min-h-full">
      <div className="lumina-canvas space-y-6">
        <section className="fusion-glass overflow-hidden rounded-[2rem]">
          <div className="grid gap-5 bg-gradient-to-br from-slate-700 via-slate-800 to-rose-900 p-6 text-white lg:grid-cols-[1fr_auto]">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-white/80">Native offboarding command center</p>
              <h2 className="mt-2 font-headline text-3xl font-bold">Offboarding Operations</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/85">
                Launch exit plans, coordinate HR, IT, Finance, Manager, Security, and Facilities checklist work, and track every departing worker from initiation to final settlement.
              </p>
            </div>
            <Button asChild className="w-fit self-end bg-white text-primary hover:bg-accent">
              <Link to="/employee/offboarding">
                Employee Exit Portal
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid md:grid-cols-4">
            <Kpi label="Active exits" value={activePlans} icon={LogOut} />
            <Kpi label="Selected completion" value={`${completed}%`} icon={CheckCircle2} />
            <Kpi label="Owner groups" value={ownerGroups.length} icon={Users2} />
            <Kpi label="Overdue tasks" value={overdueTasks} icon={CalendarClock} />
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader className="p-5">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <LogOut className="h-5 w-5 text-primary" />
                  Launch Exit Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <form className="space-y-4" onSubmit={submitPlan}>
                  <div className="space-y-2">
                    <Label>Departing worker</Label>
                    <Select value={form.workerId} onValueChange={(workerId) => setForm({ ...form, workerId })}>
                      <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                      <SelectContent>
                        {workers.map((worker) => (
                          <SelectItem key={worker.id} value={worker.id}>{workerName(worker)} - {worker.employeeId}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-working-day">Last working day</Label>
                    <Input id="last-working-day" type="date" value={form.lastWorkingDay} onChange={(event) => setForm({ ...form, lastWorkingDay: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Reason category</Label>
                    <Select value={form.reasonCategory} onValueChange={(reasonCategory) => setForm({ ...form, reasonCategory: reasonCategory as ReasonCategory })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {reasonCategories.map((reason) => <SelectItem key={reason} value={reason}>{reason.replace(/_/g, ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reviewing manager</Label>
                    <Select value={form.managerId} onValueChange={(managerId) => setForm({ ...form, managerId })}>
                      <SelectTrigger><SelectValue placeholder="Assign later" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Assign later</SelectItem>
                        {workers.filter((worker) => worker.id !== form.workerId).map((worker) => (
                          <SelectItem key={worker.id} value={worker.id}>{workerName(worker)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" type="submit" disabled={!form.workerId || createPlanMutation.isPending}>Launch exit plan</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-5">
                <CardTitle className="text-lg">Exit Queue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-5 pt-0">
                {plansLoading ? <Skeleton className="h-32 w-full" /> : null}
                {!plansLoading && plansError ? (
                  <ErrorState error={plansErrorObj} onRetry={() => refetchPlans()} />
                ) : null}
                {!plansLoading && !plansError && plans.map((plan) => {
                  const worker = workerById.get(plan.workerId);
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      className={cn(
                        'fusion-hover w-full rounded-2xl border p-3 text-left transition-colors hover:border-secondary/60',
                        selectedPlan?.id === plan.id ? 'border-primary bg-secondary/10' : 'fusion-glass border-transparent',
                      )}
                      onClick={() => setSelectedPlanId(plan.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{workerName(worker)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Last day {formatDate(plan.lastWorkingDay)}</p>
                        </div>
                        <StatusBadge status={plan.status} />
                      </div>
                    </button>
                  );
                })}
                {!plansLoading && !plansError && plans.length === 0 ? (
                  <EmptyState
                    icon={LogOut}
                    title="No exit plans yet"
                    description="Launch an exit plan to start tracking a departing worker, or terminate an employee to auto-create one."
                    className="py-8"
                  />
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="text-xl">{workerName(selectedWorker)}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedWorker?.jobTitle ?? 'Role pending'} / {selectedWorker?.departmentName ?? 'Department pending'} / last day {formatDate(selectedPlan?.lastWorkingDay)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedPlan?.status === 'DRAFT' ? (
                      <Button size="sm" onClick={() => startPlanMutation.mutate({ id: selectedPlan.id })} disabled={startPlanMutation.isPending}>Start</Button>
                    ) : null}
                    {selectedPlan?.status === 'ACTIVE' ? (
                      <Button size="sm" onClick={() => completePlanMutation.mutate({ id: selectedPlan.id })} disabled={completePlanMutation.isPending}>Complete</Button>
                    ) : null}
                    {selectedPlan?.status ? <StatusBadge status={selectedPlan.status} /> : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="h-2 overflow-hidden rounded-full bg-accent">
                  <div className="h-full rounded-full bg-secondary" style={{ width: `${completed}%` }} />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <Metric label="Checklist" value={`${selectedTasks.length} tasks`} />
                  <Metric label="Reason" value={selectedPlan?.reasonCategory?.replace(/_/g, ' ') ?? 'Not set'} />
                  <Metric label="Asset return" value={selectedTasks.some((task) => task.category === 'ASSET_RETURN') ? 'Tracked' : 'Add task'} />
                  <Metric label="Final settlement" value={selectedTasks.find((task) => task.category === 'FINAL_SETTLEMENT_CONFIRMATION')?.status ?? 'Not queued'} />
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="tasks" className="space-y-4">
              <TabsList>
                <TabsTrigger value="tasks">Checklist</TabsTrigger>
                <TabsTrigger value="owners">Owner Groups</TabsTrigger>
                <TabsTrigger value="controls">Exit Controls</TabsTrigger>
              </TabsList>

              <TabsContent value="tasks">
                <Card>
                  <CardHeader className="p-5">
                    <CardTitle className="text-lg">Exit Checklist</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-5 pt-0">
                    <div className="grid gap-3 lg:grid-cols-2">
                      {taskTemplates.map((template) => {
                        const Icon = template.icon;
                        return (
                          <div key={template.title} className="fusion-glass rounded-2xl p-4">
                            <div className="flex items-start gap-3">
                              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-primary">
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-sm font-semibold text-foreground">{template.title}</h3>
                                  <OwnerBadge ownerGroup={template.ownerGroup} />
                                </div>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">{template.description}</p>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => addTemplate(template)} disabled={!selectedPlan || createTaskMutation.isPending}>Add</Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <form className="grid gap-3 fusion-glass rounded-2xl p-4 lg:grid-cols-[1fr_12rem_10rem_auto]" onSubmit={submitTask}>
                      <div className="space-y-2">
                        <Label htmlFor="task-title">Task</Label>
                        <Input id="task-title" value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Owner</Label>
                        <Select value={taskForm.ownerGroup} onValueChange={(ownerGroup) => setTaskForm({ ...taskForm, ownerGroup: ownerGroup as OwnerGroup })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ownerGroups.map((ownerGroup) => <SelectItem key={ownerGroup} value={ownerGroup}>{ownerGroup}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-due">Due</Label>
                        <Input id="task-due" type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} />
                      </div>
                      <div className="flex items-end">
                        <Button type="submit" disabled={!selectedPlan || !taskForm.title.trim() || createTaskMutation.isPending}>Create</Button>
                      </div>
                      <div className="lg:col-span-4">
                        <Input value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} placeholder="Task description, evidence, or acceptance criteria" />
                      </div>
                    </form>

                    {tasksLoading ? <Skeleton className="h-32 w-full" /> : null}
                    {!tasksLoading && tasksError ? (
                      <ErrorState error={tasksErrorObj} onRetry={() => refetchTasks()} />
                    ) : null}
                    <div className="space-y-3">
                      {!tasksLoading && !tasksError && selectedTasks.map((task) => {
                        const ownerGroup = inferOwnerGroup(task);
                        const isTerminal = task.status === 'COMPLETED' || task.status === 'SKIPPED';
                        return (
                          <div key={task.id} className="grid gap-3 fusion-glass rounded-2xl p-4 lg:grid-cols-[1fr_auto]">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold text-foreground">{task.title}</h3>
                                <OwnerBadge ownerGroup={ownerGroup} />
                                <TaskStatusBadge status={task.status} />
                              </div>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">{task.description ?? 'No description provided.'}</p>
                              <p className="mt-2 text-xs text-muted-foreground">Due {formatDate(task.dueDate)} / plan {taskPlanId(task).slice(0, 8)}</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <Button
                                size="sm"
                                variant={task.status === 'COMPLETED' ? 'outline' : 'default'}
                                onClick={() => completeTaskMutation.mutate({ id: task.id })}
                                disabled={isTerminal || completeTaskMutation.isPending}
                              >
                                Mark complete
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => skipTaskMutation.mutate({ id: task.id })}
                                disabled={isTerminal || skipTaskMutation.isPending}
                                aria-label={`Skip ${task.title}`}
                              >
                                <SkipForward className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      {!tasksLoading && !tasksError && selectedTasks.length === 0 ? (
                        <EmptyState
                          icon={ClipboardCheck}
                          title="No checklist tasks yet"
                          description="Select an exit plan and add checklist templates for this departing worker."
                          className="py-8"
                        />
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="owners">
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {ownerCounts.map((owner) => (
                    <Card key={owner.ownerGroup}>
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between gap-3">
                          <OwnerBadge ownerGroup={owner.ownerGroup} />
                          <span className="font-headline text-3xl font-bold text-foreground">{owner.total}</span>
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">{owner.ownerGroup} tasks owned for the selected exit plan.</p>
                      </CardContent>
                    </Card>
                  ))}
                </section>
              </TabsContent>

              <TabsContent value="controls">
                <div className="grid gap-4 lg:grid-cols-3">
                  <JourneyCard title="Asset Return / Access Revocation" body="Track laptop, badge, and equipment return alongside IT and facility/security access revocation confirmations." icon={ShieldOff} />
                  <JourneyCard title="Knowledge Transfer" body="Confirm active work, credentials, and ongoing projects are handed over before the last working day." icon={Users2} />
                  <JourneyCard title="Final Settlement / Exit Interview" body="Confirm final pay, unused leave payout, and outstanding dues, and capture exit interview feedback." icon={Landmark} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Average checklist completion across all exit plans: {averageProgress}%.</p>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex min-h-[88px] items-center gap-3 border-b border-border/50 px-4 py-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="lumina-label">{label}</p>
        <p className="mt-1 font-headline text-2xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="fusion-glass rounded-2xl p-3">
      <p className="lumina-label">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function OwnerBadge({ ownerGroup }: { ownerGroup: OwnerGroup }) {
  return <Badge variant="outline" className={cn('rounded-full border px-2 py-1 text-xs', ownerStyles[ownerGroup])}>{ownerGroup}</Badge>;
}

function StatusBadge({ status }: { status: OffboardingPlanStatus }) {
  const variant = status === 'COMPLETED' ? 'default' : status === 'CANCELLED' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{status.replace(/_/g, ' ')}</Badge>;
}

function TaskStatusBadge({ status }: { status: OffboardingTaskStatus }) {
  const variant = status === 'COMPLETED' ? 'default' : status === 'OVERDUE' ? 'destructive' : status === 'SKIPPED' ? 'outline' : 'secondary';
  return <Badge variant={variant}>{status.replace(/_/g, ' ')}</Badge>;
}

function JourneyCard({
  title,
  body,
  icon: Icon,
}: {
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-secondary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
