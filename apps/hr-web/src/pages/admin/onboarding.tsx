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
import { cn, generateUUID } from '@/lib/utils';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileSignature,
  Laptop,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import type { Worker } from '@/types';

type OwnerGroup = 'HR' | 'IT' | 'Finance' | 'Admin' | 'Manager' | 'Security' | 'Facilities';
type TaskCategory =
  | 'PREBOARDING'
  | 'DOCUMENT'
  | 'SIGNATURE'
  | 'IT_PROVISIONING'
  | 'FACILITY_ACCESS'
  | 'FINANCE_SETUP'
  | 'MANAGER_CHECKIN'
  | 'COMPLIANCE'
  | 'MILESTONE_30'
  | 'MILESTONE_60'
  | 'MILESTONE_90'
  | 'PROBATION';
type OnboardingPlanStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type OnboardingTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'SKIPPED';

interface OnboardingPlan {
  id: string;
  workerId: string;
  startDate: string;
  status: OnboardingPlanStatus;
  assignedBuddyId?: string;
  mentorId?: string;
  roleTrack?: string;
  preboardingPortalStatus?: 'NOT_INVITED' | 'INVITED' | 'ACTIVE' | 'COMPLETED';
  probationReviewDate?: string;
  probationStatus?: 'NOT_REQUIRED' | 'PENDING_REVIEW' | 'CONFIRMED' | 'EXTENDED' | 'TERMINATION_RECOMMENDED';
}

interface OnboardingTask {
  id: string;
  onboardingPlanId?: string;
  planId?: string;
  title: string;
  description?: string;
  assignedTo?: string;
  ownerGroup?: string;
  category?: TaskCategory;
  evidenceType?: string;
  provisioningTarget?: string;
  dueDate?: string;
  completedAt?: string;
  status: OnboardingTaskStatus;
}

interface PlanForm {
  workerId: string;
  startDate: string;
  assignedBuddyId: string;
}

interface TaskForm {
  title: string;
  description: string;
  ownerGroup: OwnerGroup;
  dueDate: string;
}

const ownerGroups: OwnerGroup[] = ['HR', 'IT', 'Finance', 'Admin', 'Manager', 'Security', 'Facilities'];

const ownerStyles: Record<OwnerGroup, string> = {
  HR: 'border-[#8b5cf6]/30 bg-[#8b5cf6]/10 text-[#4f46e5]',
  IT: 'border-[#6366f1]/30 bg-[#e0e7ff] text-[#1e1b4b]',
  Finance: 'border-[#f59e0b]/30 bg-[#fde68a]/70 text-[#92400e]',
  Admin: 'border-[#6366f1]/30 bg-[#6366f1]/10 text-[#6366f1]',
  Manager: 'border-[#7c3aed]/30 bg-[#ede9fe] text-[#5b21b6]',
  Security: 'border-[#e11d48]/30 bg-[#ffe4e6] text-[#9f1239]',
  Facilities: 'border-[#64748b]/30 bg-[#f1f5f9] text-[#334155]',
};

const taskTemplates: Array<{
  title: string;
  ownerGroup: OwnerGroup;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: TaskCategory;
  evidenceType: string;
  provisioningTarget?: string;
}> = [
  {
    title: 'Preboarding checklist',
    ownerGroup: 'HR',
    description: 'Welcome message, personal data, emergency contacts, and first-day readiness.',
    icon: ClipboardCheck,
    category: 'PREBOARDING',
    evidenceType: 'HR_REVIEW',
  },
  {
    title: 'Document signing and evidence upload',
    ownerGroup: 'HR',
    description: 'Contracts, policy acknowledgements, identity files, tax, and bank evidence.',
    icon: FileSignature,
    category: 'SIGNATURE',
    evidenceType: 'E_SIGNATURE',
  },
  {
    title: 'IT provisioning',
    ownerGroup: 'IT',
    description: 'Account, email, laptop, MFA, role groups, and app access before day one.',
    icon: Laptop,
    category: 'IT_PROVISIONING',
    evidenceType: 'PROVISIONING_TICKET',
    provisioningTarget: 'IAM',
  },
  {
    title: '30/60/90 plan',
    ownerGroup: 'Manager',
    description: 'Role outcomes, first milestones, learning goals, and checkpoint cadence.',
    icon: CalendarClock,
    category: 'MILESTONE_30',
    evidenceType: 'CHECKPOINT_NOTES',
  },
  {
    title: 'Buddy and mentor assignment',
    ownerGroup: 'Manager',
    description: 'Buddy intro, mentor pairing, team welcome, and first-week agenda.',
    icon: UserRoundCheck,
    category: 'MANAGER_CHECKIN',
    evidenceType: 'BUDDY_CONFIRMATION',
  },
  {
    title: 'Compliance onboarding',
    ownerGroup: 'Security',
    description: 'Code of conduct, security awareness, work authorization, and mandatory learning.',
    icon: ShieldCheck,
    category: 'COMPLIANCE',
    evidenceType: 'TRAINING_COMPLETION',
  },
  {
    title: 'Probation management',
    ownerGroup: 'HR',
    description: 'Probation dates, manager review window, confirmation, extension, or action plan.',
    icon: BadgeCheck,
    category: 'PROBATION',
    evidenceType: 'PROBATION_REVIEW',
  },
];

function unwrap<T>(payload: unknown): T {
  const response = payload as { data?: T; success?: boolean };
  if (response.success === true && response.data !== undefined) return response.data;
  return payload as T;
}

function workerName(worker?: Worker) {
  if (!worker) return 'Unassigned worker';
  return `${worker.firstName} ${worker.lastName}`.trim();
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(value));
}

function inferOwnerGroup(task: Pick<OnboardingTask, 'description' | 'title'>): OwnerGroup {
  const structuredOwner = (task as OnboardingTask).ownerGroup;
  if (structuredOwner) {
    const normalized = structuredOwner.charAt(0).toUpperCase() + structuredOwner.slice(1).toLowerCase();
    if (ownerGroups.includes(normalized as OwnerGroup)) return normalized as OwnerGroup;
  }
  const text = `${task.title} ${task.description ?? ''}`.toLowerCase();
  if (text.includes('it ') || text.includes('laptop') || text.includes('account') || text.includes('access')) return 'IT';
  if (text.includes('finance') || text.includes('payroll') || text.includes('bank')) return 'Finance';
  if (text.includes('facility') || text.includes('desk') || text.includes('badge')) return 'Facilities';
  if (text.includes('security') || text.includes('compliance') || text.includes('policy')) return 'Security';
  if (text.includes('manager') || text.includes('30/60/90') || text.includes('buddy') || text.includes('mentor')) return 'Manager';
  if (text.includes('admin')) return 'Admin';
  return 'HR';
}

function taskPlanId(task: OnboardingTask) {
  return task.onboardingPlanId ?? task.planId ?? '';
}

function completionPercent(tasks: OnboardingTask[]) {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((task) => task.status === 'COMPLETED' || task.status === 'SKIPPED').length / tasks.length) * 100);
}

function toPlanList(payload: unknown): OnboardingPlan[] {
  return Array.isArray(payload) ? payload as OnboardingPlan[] : [];
}

function toTaskList(payload: unknown): OnboardingTask[] {
  return Array.isArray(payload) ? payload as OnboardingTask[] : [];
}

function defaultDueDate(daysFromNow: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

export function AdminOnboarding() {
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = React.useState('');
  const [form, setForm] = React.useState<PlanForm>({
    workerId: '',
    startDate: new Date().toISOString().slice(0, 10),
    assignedBuddyId: 'none',
  });
  const [taskForm, setTaskForm] = React.useState<TaskForm>({
    title: taskTemplates[0].title,
    description: taskTemplates[0].description,
    ownerGroup: taskTemplates[0].ownerGroup,
    dueDate: defaultDueDate(3),
  });

  const { data: workers = [] } = useApiQuery<Worker[]>(['admin-onboarding-workers'], '/hr/core/workers?status=ACTIVE&pageSize=100');

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['admin-onboarding-plans'],
    queryFn: async () => toPlanList(unwrap<unknown>((await apiClient.get('/hr/onboarding/plans')).data)),
  });

  React.useEffect(() => {
    if (!selectedPlanId && plans[0]) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plans, selectedPlanId]);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];

  const { data: selectedTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['admin-onboarding-tasks', selectedPlan?.id],
    enabled: Boolean(selectedPlan?.id),
    queryFn: async () => toTaskList(unwrap<unknown>((await apiClient.get(`/hr/onboarding/tasks/plan/${selectedPlan?.id}`)).data)),
  });

  const createPlanMutation = useApiMutation<unknown, {
    planId: string;
    workerId: string;
    startDate: string;
    assignedBuddyId?: string;
    roleTrack?: string;
    preboardingPortalStatus?: string;
  }>(
    '/hr/onboarding/plans',
    'post',
    [['admin-onboarding-plans']],
  );
  const startPlanMutation = useApiMutation<unknown, { id: string }>(
    ({ id }) => `/hr/onboarding/plans/${id}/commands/start`,
    'post',
    [['admin-onboarding-plans']],
  );
  const completePlanMutation = useApiMutation<unknown, { id: string }>(
    ({ id }) => `/hr/onboarding/plans/${id}/commands/complete`,
    'post',
    [['admin-onboarding-plans']],
  );
  const createTaskMutation = useApiMutation<unknown, {
    taskId: string;
    planId: string;
    title: string;
    description?: string;
    ownerGroup?: OwnerGroup;
    category?: TaskCategory;
    evidenceType?: string;
    provisioningTarget?: string;
    dueDate?: string;
  }>(
    '/hr/onboarding/tasks',
    'post',
    [['admin-onboarding-tasks']],
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ['admin-onboarding-tasks', selectedPlan?.id] });
      },
    },
  );
  const completeTaskMutation = useApiMutation<unknown, { id: string }>(
    ({ id }) => `/hr/onboarding/tasks/${id}/commands/complete`,
    'post',
    [['admin-onboarding-tasks']],
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ['admin-onboarding-tasks', selectedPlan?.id] });
      },
    },
  );

  const workerById = React.useMemo(() => new Map(workers.map((worker) => [worker.id, worker])), [workers]);
  const selectedWorker = selectedPlan ? workerById.get(selectedPlan.workerId) : undefined;
  const completed = completionPercent(selectedTasks);
  const activePlans = plans.filter((plan) => plan.status !== 'COMPLETED' && plan.status !== 'CANCELLED').length;
  const overdueTasks = selectedTasks.filter((task) => task.status === 'OVERDUE').length;
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
      startDate: form.startDate,
      assignedBuddyId: form.assignedBuddyId !== 'none' ? form.assignedBuddyId : undefined,
      roleTrack: 'STANDARD_EMPLOYEE',
      preboardingPortalStatus: 'INVITED',
    });
    setSelectedPlanId(planId);
    setForm((current) => ({ ...current, workerId: '', assignedBuddyId: 'none' }));
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
      category: taskTemplates.find((template) => template.title === taskForm.title)?.category ?? 'PREBOARDING',
      evidenceType: taskTemplates.find((template) => template.title === taskForm.title)?.evidenceType,
      dueDate: taskForm.dueDate || undefined,
    });
  };

  const addTemplate = async (template: (typeof taskTemplates)[number], index: number) => {
    if (!selectedPlan?.id) return;
    await createTaskMutation.mutateAsync({
      taskId: generateUUID(),
      planId: selectedPlan.id,
      title: template.title,
      description: template.description,
      ownerGroup: template.ownerGroup,
      category: template.category,
      evidenceType: template.evidenceType,
      provisioningTarget: template.provisioningTarget,
      dueDate: defaultDueDate(index + 1),
    });
  };

  return (
    <div className="min-h-full fusion-bg">
      <div className="lumina-canvas space-y-6">
        <section className="lumina-panel overflow-hidden">
          <div className="grid gap-5 border-b border-[#e2e8f0] bg-[#4f46e5] p-6 text-white lg:grid-cols-[1fr_auto]">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#a5b4fc]">Native onboarding command center</p>
              <h2 className="mt-2 font-headline text-3xl font-bold">Onboarding Operations</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/85">
                Launch preboarding, coordinate HR, IT, Finance, Admin, Manager, Security, and Facilities work, and keep new hires moving from offer acceptance to probation confirmation.
              </p>
            </div>
            <Button asChild className="w-fit self-end bg-white text-[#4f46e5] hover:bg-[#eef2ff]">
              <Link to="/employee/onboarding">
                Employee Preboarding
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid bg-white md:grid-cols-4">
            <Kpi label="Active plans" value={activePlans} icon={Users} />
            <Kpi label="Selected completion" value={`${completed}%`} icon={CheckCircle2} />
            <Kpi label="Owner groups" value={ownerGroups.length} icon={Building2} />
            <Kpi label="Overdue tasks" value={overdueTasks} icon={CalendarClock} />
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader className="p-5">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Briefcase className="h-5 w-5 text-[#4f46e5]" />
                  Launch Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <form className="space-y-4" onSubmit={submitPlan}>
                  <div className="space-y-2">
                    <Label>New hire</Label>
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
                    <Label htmlFor="start-date">Start date</Label>
                    <Input id="start-date" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Buddy / mentor</Label>
                    <Select value={form.assignedBuddyId} onValueChange={(assignedBuddyId) => setForm({ ...form, assignedBuddyId })}>
                      <SelectTrigger><SelectValue placeholder="Assign buddy" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Assign later</SelectItem>
                        {workers.filter((worker) => worker.id !== form.workerId).map((worker) => (
                          <SelectItem key={worker.id} value={worker.id}>{workerName(worker)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" type="submit" disabled={!form.workerId || createPlanMutation.isPending}>Create plan</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-5">
                <CardTitle className="text-lg">Plan Queue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-5 pt-0">
                {plansLoading ? <Skeleton className="h-32 w-full" /> : null}
                {plans.map((plan) => {
                  const worker = workerById.get(plan.workerId);
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      className={cn(
                        'w-full rounded-lg border p-3 text-left transition-colors hover:border-[#8b5cf6]/60 hover:bg-[#eef2ff]',
                        selectedPlan?.id === plan.id ? 'border-[#4f46e5] bg-[#8b5cf6]/10' : 'border-[#e2e8f0]/70 bg-white',
                      )}
                      onClick={() => setSelectedPlanId(plan.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#0f172a]">{workerName(worker)}</p>
                          <p className="mt-1 text-xs text-[#475569]">Starts {formatDate(plan.startDate)}</p>
                        </div>
                        <StatusBadge status={plan.status} />
                      </div>
                    </button>
                  );
                })}
                {!plansLoading && plans.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#e2e8f0] bg-white p-4 text-sm text-[#475569]">No onboarding plans yet.</p>
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
                    <p className="mt-1 text-sm text-[#475569]">
                      {selectedWorker?.jobTitle ?? 'Role track pending'} / {selectedWorker?.departmentName ?? 'Department pending'} / starts {formatDate(selectedPlan?.startDate)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedPlan?.status === 'SCHEDULED' ? (
                      <Button size="sm" onClick={() => startPlanMutation.mutate({ id: selectedPlan.id })} disabled={startPlanMutation.isPending}>Start</Button>
                    ) : null}
                    {selectedPlan?.status === 'IN_PROGRESS' ? (
                      <Button size="sm" onClick={() => completePlanMutation.mutate({ id: selectedPlan.id })} disabled={completePlanMutation.isPending}>Complete</Button>
                    ) : null}
                    {selectedPlan?.status ? <StatusBadge status={selectedPlan.status} /> : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="h-2 overflow-hidden rounded-full bg-[#e0e7ff]">
                  <div className="h-full rounded-full bg-[#8b5cf6]" style={{ width: `${completed}%` }} />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <Metric label="Checklist" value={`${selectedTasks.length} tasks`} />
                  <Metric label="Documents" value={selectedTasks.some((task) => inferOwnerGroup(task) === 'HR') ? 'Tracked' : 'Add packet'} />
                  <Metric label="IT provisioning" value={selectedTasks.some((task) => inferOwnerGroup(task) === 'IT') ? 'Queued' : 'Not queued'} />
                  <Metric label="Probation" value={selectedPlan?.probationStatus?.replace(/_/g, ' ') ?? 'PENDING REVIEW'} />
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="tasks" className="space-y-4">
              <TabsList>
                <TabsTrigger value="tasks">Checklist</TabsTrigger>
                <TabsTrigger value="owners">Owner Groups</TabsTrigger>
                <TabsTrigger value="journey">Journey Controls</TabsTrigger>
              </TabsList>

              <TabsContent value="tasks">
                <Card>
                  <CardHeader className="p-5">
                    <CardTitle className="text-lg">Preboarding Checklist</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-5 pt-0">
                    <div className="grid gap-3 lg:grid-cols-2">
                      {taskTemplates.map((template, index) => {
                        const Icon = template.icon;
                        return (
                          <div key={template.title} className="rounded-lg border border-[#e2e8f0]/70 bg-[#f6f7fb] p-4">
                            <div className="flex items-start gap-3">
                              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-[#4f46e5]">
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-sm font-semibold text-[#0f172a]">{template.title}</h3>
                                  <OwnerBadge ownerGroup={template.ownerGroup} />
                                </div>
                                <p className="mt-1 text-xs leading-5 text-[#475569]">{template.description}</p>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => addTemplate(template, index)} disabled={!selectedPlan || createTaskMutation.isPending}>Add</Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <form className="grid gap-3 rounded-lg border border-[#e2e8f0]/70 bg-white p-4 lg:grid-cols-[1fr_12rem_10rem_auto]" onSubmit={submitTask}>
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
                    <div className="space-y-3">
                      {selectedTasks.map((task) => {
                        const ownerGroup = inferOwnerGroup(task);
                        return (
                          <div key={task.id} className="grid gap-3 rounded-lg border border-[#e2e8f0]/70 bg-white p-4 lg:grid-cols-[1fr_auto]">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold text-[#0f172a]">{task.title}</h3>
                                <OwnerBadge ownerGroup={ownerGroup} />
                                <TaskStatusBadge status={task.status} />
                              </div>
                              <p className="mt-2 text-sm leading-6 text-[#475569]">{task.description ?? 'No description provided.'}</p>
                              <p className="mt-2 text-xs text-[#94a3b8]">Due {formatDate(task.dueDate)} / plan {taskPlanId(task).slice(0, 8)}</p>
                            </div>
                            <Button
                              size="sm"
                              variant={task.status === 'COMPLETED' ? 'outline' : 'default'}
                              onClick={() => completeTaskMutation.mutate({ id: task.id })}
                              disabled={task.status === 'COMPLETED' || completeTaskMutation.isPending}
                            >
                              Mark complete
                            </Button>
                          </div>
                        );
                      })}
                      {!tasksLoading && selectedTasks.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-[#e2e8f0] bg-white p-5 text-sm text-[#475569]">Select a plan and add checklist templates for this hire.</p>
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
                          <span className="font-headline text-3xl font-bold text-[#0f172a]">{owner.total}</span>
                        </div>
                        <p className="mt-3 text-sm text-[#475569]">{owner.ownerGroup} tasks owned for the selected onboarding plan.</p>
                      </CardContent>
                    </Card>
                  ))}
                </section>
              </TabsContent>

              <TabsContent value="journey">
                <div className="grid gap-4 lg:grid-cols-3">
                  <JourneyCard title="Document Signing / Upload Evidence" body="Collect contract signatures, identity documents, policy acknowledgements, tax forms, banking proof, and compliance evidence before activation." icon={FileSignature} />
                  <JourneyCard title="IT Provisioning" body="Track email, laptop, MFA, role groups, badge/access requests, device readiness, and payroll or finance system access." icon={Laptop} />
                  <JourneyCard title="30/60/90 and Probation" body="Coordinate manager outcomes, buddy/mentor support, compliance learning, probation checkpoints, and confirmation decisions." icon={BadgeCheck} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex min-h-[88px] items-center gap-3 border-b border-[#e2e8f0]/50 px-4 py-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#8b5cf6]/10 text-[#4f46e5]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="lumina-label">{label}</p>
        <p className="mt-1 font-headline text-2xl font-bold text-[#0f172a]">{value}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e2e8f0]/70 bg-[#eef2ff] p-3">
      <p className="lumina-label">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[#0f172a]">{value}</p>
    </div>
  );
}

function OwnerBadge({ ownerGroup }: { ownerGroup: OwnerGroup }) {
  return <Badge variant="outline" className={cn('rounded-full border px-2 py-1 text-xs', ownerStyles[ownerGroup])}>{ownerGroup}</Badge>;
}

function StatusBadge({ status }: { status: OnboardingPlanStatus }) {
  const variant = status === 'COMPLETED' ? 'default' : status === 'CANCELLED' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{status.replace(/_/g, ' ')}</Badge>;
}

function TaskStatusBadge({ status }: { status: OnboardingTaskStatus }) {
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
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-[#8b5cf6]/10 text-[#4f46e5]">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="mt-4 font-semibold text-[#0f172a]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[#475569]">{body}</p>
      </CardContent>
    </Card>
  );
}
