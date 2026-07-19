import * as React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { useUIStore } from '@/stores/ui-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Landmark,
  MessageSquare,
  ShieldOff,
  UploadCloud,
  Users2,
} from 'lucide-react';
import type { Worker } from '@/types';

type OwnerGroup = 'HR' | 'IT' | 'Finance' | 'Manager' | 'Security' | 'Facilities' | 'Employee';
type OffboardingTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'SKIPPED';

interface OffboardingPlan {
  id: string;
  workerId: string;
  lastWorkingDay: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  reasonCategory?: string;
  reasonNotes?: string;
  managerId?: string;
}

interface OffboardingTask {
  id: string;
  offboardingPlanId?: string;
  title: string;
  description?: string;
  ownerGroup?: string;
  category?: string;
  evidenceType?: string;
  dueDate?: string;
  completedAt?: string;
  status: OffboardingTaskStatus;
}

const exitSections = [
  { label: 'Exit checklist', icon: ClipboardCheck, owner: 'Manager' as OwnerGroup },
  { label: 'Knowledge transfer', icon: Users2, owner: 'Employee' as OwnerGroup },
  { label: 'Asset return', icon: Boxes, owner: 'Facilities' as OwnerGroup },
  { label: 'Access revocation', icon: ShieldOff, owner: 'IT' as OwnerGroup },
  { label: 'Exit interview', icon: MessageSquare, owner: 'HR' as OwnerGroup },
  { label: 'Final settlement', icon: Landmark, owner: 'Finance' as OwnerGroup },
];

const ownerStyles: Record<OwnerGroup, string> = {
  HR: 'border-secondary/30 bg-secondary/10 text-primary',
  IT: 'border-primary/30 bg-accent text-foreground',
  Finance: 'border-warning/30 bg-warning/70 text-warning-foreground',
  Manager: 'border-secondary/30 bg-secondary/10 text-secondary',
  Security: 'border-destructive/30 bg-destructive/10 text-destructive-foreground',
  Facilities: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  Employee: 'border-primary/30 bg-primary/10 text-primary',
};

function unwrap<T>(payload: unknown): T {
  const response = payload as { data?: T; success?: boolean };
  if (response.success === true && response.data !== undefined) return response.data;
  return payload as T;
}

function toPlan(payload: unknown): OffboardingPlan | null {
  if (!payload || typeof payload !== 'object') return null;
  return payload as OffboardingPlan;
}

function toTaskList(payload: unknown): OffboardingTask[] {
  return Array.isArray(payload) ? payload as OffboardingTask[] : [];
}

function workerName(worker?: Worker, fallback = 'Departing employee') {
  if (!worker) return fallback;
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
    if (exitSections.some((section) => section.owner === normalized)) return normalized as OwnerGroup;
  }
  const text = `${task.title} ${task.description ?? ''}`.toLowerCase();
  if (text.includes('it ') || text.includes('access') || text.includes('account')) return 'IT';
  if (text.includes('finance') || text.includes('settlement') || text.includes('payroll')) return 'Finance';
  if (text.includes('facility') || text.includes('asset') || text.includes('badge')) return 'Facilities';
  if (text.includes('security')) return 'Security';
  if (text.includes('manager') || text.includes('checklist')) return 'Manager';
  if (text.includes('knowledge') || text.includes('handover')) return 'Employee';
  return 'HR';
}

function completionPercent(tasks: OffboardingTask[]) {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((task) => task.status === 'COMPLETED' || task.status === 'SKIPPED').length / tasks.length) * 100);
}

export function EmployeeOffboarding() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const addNotification = useUIStore((s) => s.addNotification);
  const [evidenceNote, setEvidenceNote] = React.useState('');
  const [uploadMessage, setUploadMessage] = React.useState('');

  const { data: worker } = useApiQuery<Worker>(['employee-offboarding-worker'], '/employee/profile');

  const { data: plan, isLoading: planLoading, isError: planError } = useQuery({
    queryKey: ['employee-offboarding-plan', worker?.id],
    enabled: Boolean(worker?.id),
    retry: false,
    queryFn: async () => toPlan(unwrap<unknown>((await apiClient.get(`/hr/offboarding/plans/worker/${worker?.id}`)).data)),
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['employee-offboarding-tasks', plan?.id],
    enabled: Boolean(plan?.id),
    queryFn: async () => toTaskList(unwrap<unknown>((await apiClient.get(`/hr/offboarding/tasks/plan/${plan?.id}`)).data)),
  });

  const completeTaskMutation = useApiMutation<unknown, { id: string }>(
    ({ id }) => `/hr/offboarding/tasks/${id}/commands/complete`,
    'post',
    [['employee-offboarding-tasks']],
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ['employee-offboarding-tasks', plan?.id] });
        addNotification({
          title: 'Task completed',
          message: 'Your exit task was marked complete.',
          type: 'success',
          read: false,
        });
      },
      onError: () => {
        addNotification({
          title: 'Could not complete task',
          message: 'Please try again.',
          type: 'error',
          read: false,
        });
      },
    },
  );
  const evidenceMutation = useApiMutation<unknown, { id: string; evidenceType: string; evidencePayload: Record<string, unknown>; completionNotes: string; completeTask: boolean }>(
    ({ id }) => `/hr/offboarding/tasks/${id}/evidence`,
    'post',
    [['employee-offboarding-tasks']],
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ['employee-offboarding-tasks', plan?.id] });
        addNotification({
          title: 'Evidence submitted',
          message: 'Your note was sent to the exit checklist for review.',
          type: 'success',
          read: false,
        });
      },
      onError: () => {
        addNotification({
          title: 'Could not submit evidence',
          message: 'Please try again.',
          type: 'error',
          read: false,
        });
      },
    },
  );

  const completed = completionPercent(tasks);
  const knowledgeTransfer = tasks.filter((task) => task.category === 'KNOWLEDGE_TRANSFER' || inferOwnerGroup(task) === 'Employee');
  const assetReturn = tasks.filter((task) => task.category === 'ASSET_RETURN');
  const accessRevocation = tasks.filter((task) => task.category === 'ACCESS_REVOCATION_CONFIRMATION');
  const finalSettlement = tasks.filter((task) => task.category === 'FINAL_SETTLEMENT_CONFIRMATION');
  const exitInterview = tasks.filter((task) => task.category === 'EXIT_INTERVIEW');
  const firstName = user?.firstName || worker?.firstName || 'there';

  const recordEvidence = () => {
    const evidenceTask = knowledgeTransfer.find((task) => task.status !== 'COMPLETED' && task.status !== 'SKIPPED')
      ?? tasks.find((task) => task.status !== 'COMPLETED' && task.status !== 'SKIPPED');
    if (!evidenceNote.trim() || !evidenceTask) return;
    evidenceMutation.mutate({
      id: evidenceTask.id,
      evidenceType: evidenceTask.evidenceType ?? 'EMPLOYEE_EXIT_EVIDENCE',
      evidencePayload: {
        note: evidenceNote.trim(),
        recordedAt: new Date().toISOString(),
        channel: 'EMPLOYEE_EXIT_PORTAL',
      },
      completionNotes: evidenceNote.trim(),
      completeTask: true,
    });
    setUploadMessage('Note submitted to the exit checklist for review.');
    setEvidenceNote('');
  };

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[1740px] px-4 pt-6 lg:px-5">
        <div className="fusion-glass grid gap-6 rounded-[2rem] p-6 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">Employee exit portal</p>
            <h2 className="fusion-gradient-text mt-2 font-headline text-3xl font-bold">Offboarding checklist for {firstName}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Complete your knowledge transfer, confirm returned assets, and prepare for your exit interview and final settlement before your last working day.
            </p>
          </div>
          <Button asChild className="w-fit self-end">
            <Link to="/employee">
              Self-Service Home
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1740px] gap-4 px-4 py-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-5">
        <aside className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 rounded-xl border-2 border-white shadow-md">
                  <AvatarImage src={worker?.photoUrl ?? user?.avatarUrl} alt={workerName(worker, user?.firstName)} />
                  <AvatarFallback className="rounded-xl bg-accent text-2xl font-bold text-foreground">
                    {(worker?.firstName ?? user?.firstName ?? 'N').charAt(0)}{(worker?.lastName ?? user?.lastName ?? 'H').charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <h3 className="mt-4 font-semibold text-foreground">{workerName(worker, `${user?.firstName ?? 'Departing'} ${user?.lastName ?? 'Employee'}`)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{worker?.jobTitle ?? 'Role pending'} / {worker?.departmentName ?? 'Department pending'}</p>
                <Badge className="mt-3" variant={plan?.status === 'COMPLETED' ? 'default' : 'secondary'}>{plan?.status?.replace(/_/g, ' ') ?? 'NO ACTIVE EXIT'}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-5">
              <CardTitle className="text-lg">Exit Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              <Snapshot label="Last working day" value={formatDate(plan?.lastWorkingDay)} />
              <Snapshot label="Checklist complete" value={`${completed}%`} />
              <Snapshot label="Reason" value={plan?.reasonCategory?.replace(/_/g, ' ') ?? 'Not set'} />
              <Snapshot label="Final settlement" value={finalSettlement[0]?.status?.replace(/_/g, ' ') ?? 'Pending'} />
            </CardContent>
          </Card>
        </aside>

        <main className="space-y-4">
          <Card>
            <CardContent className="p-5">
              {planLoading ? <Skeleton className="h-24 w-full" /> : null}
              {!planLoading && (planError || !plan) ? (
                <div className="fusion-glass rounded-2xl p-5">
                  <h3 className="font-semibold text-foreground">No active exit plan yet</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Your exit checklist appears here once HR initiates your offboarding, or automatically after your termination date is confirmed.</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="lumina-label">Overall progress</p>
                      <p className="mt-1 font-headline text-3xl font-bold text-foreground">{completed}% complete</p>
                    </div>
                    <Badge variant="outline" className="w-fit rounded-full border-secondary/30 bg-secondary/10 px-3 py-1 text-primary">
                      Last day {formatDate(plan?.lastWorkingDay)}
                    </Badge>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-accent">
                    <div className="h-full rounded-full bg-secondary" style={{ width: `${completed}%` }} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {exitSections.map((section) => {
              const Icon = section.icon;
              const sectionTasks = tasks.filter((task) => inferOwnerGroup(task) === section.owner);
              const done = sectionTasks.length > 0 && sectionTasks.every((task) => task.status === 'COMPLETED' || task.status === 'SKIPPED');
              return (
                <Card key={section.label} className="fusion-hover">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant={done ? 'default' : 'secondary'}>{done ? 'Done' : `${sectionTasks.length} items`}</Badge>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-foreground">{section.label}</h3>
                    <OwnerBadge ownerGroup={section.owner} />
                  </CardContent>
                </Card>
              );
            })}
          </section>

          <Tabs defaultValue="checklist" className="space-y-4">
            <TabsList>
              <TabsTrigger value="checklist">Checklist</TabsTrigger>
              <TabsTrigger value="handover">Knowledge Transfer</TabsTrigger>
              <TabsTrigger value="assets">Assets &amp; Access</TabsTrigger>
              <TabsTrigger value="settlement">Settlement &amp; Interview</TabsTrigger>
            </TabsList>

            <TabsContent value="checklist">
              <Card>
                <CardHeader className="p-5">
                  <CardTitle className="text-lg">Your Exit Tasks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-5 pt-0">
                  {tasksLoading ? <Skeleton className="h-40 w-full" /> : null}
                  {tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onComplete={() => completeTaskMutation.mutate({ id: task.id })}
                      isPending={completeTaskMutation.isPending}
                    />
                  ))}
                  {!tasksLoading && tasks.length === 0 ? (
                    <p className="fusion-glass rounded-2xl p-5 text-sm text-muted-foreground">Your exit checklist will appear here once HR publishes offboarding tasks.</p>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="handover">
              <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                <Card>
                  <CardHeader className="p-5">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users2 className="h-5 w-5 text-primary" />
                      Knowledge Transfer
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5 pt-0">
                    {knowledgeTransfer.map((task) => <TaskRow key={task.id} task={task} onComplete={() => completeTaskMutation.mutate({ id: task.id })} isPending={completeTaskMutation.isPending} />)}
                    {knowledgeTransfer.length === 0 ? <p className="text-sm text-muted-foreground">No knowledge transfer tasks assigned yet.</p> : null}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-5">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <UploadCloud className="h-5 w-5 text-primary" />
                      Handover Note
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5 pt-0">
                    <Input value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} placeholder="Describe active work, credentials, or handover recipients" />
                    <Button className="w-full" onClick={recordEvidence} disabled={!evidenceNote.trim()}>Submit note</Button>
                    {uploadMessage ? <p className="rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{uploadMessage}</p> : null}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="assets">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="p-5">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Boxes className="h-5 w-5 text-primary" />
                      Asset Return
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5 pt-0">
                    {assetReturn.map((task) => <TaskRow key={task.id} task={task} onComplete={() => completeTaskMutation.mutate({ id: task.id })} isPending={completeTaskMutation.isPending} />)}
                    {assetReturn.length === 0 ? <p className="text-sm text-muted-foreground">No asset return tasks assigned yet.</p> : null}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-5">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ShieldOff className="h-5 w-5 text-primary" />
                      Access Revocation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5 pt-0">
                    {accessRevocation.map((task) => <TaskRow key={task.id} task={task} onComplete={() => completeTaskMutation.mutate({ id: task.id })} isPending={completeTaskMutation.isPending} />)}
                    {accessRevocation.length === 0 ? <p className="text-sm text-muted-foreground">IT and Security handle access revocation confirmation.</p> : null}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="settlement">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-lg bg-secondary/10 text-primary">
                      <Landmark className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Final Settlement and Exit Interview</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Finance confirms final pay, unused leave payout, and outstanding dues. HR schedules your exit interview to capture feedback and confirm rehire eligibility.
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <Snapshot label="Final settlement" value={finalSettlement[0]?.status?.replace(/_/g, ' ') ?? 'Pending'} />
                        <Snapshot label="Exit interview" value={exitInterview[0]?.status?.replace(/_/g, ' ') ?? 'Pending'} />
                        <Snapshot label="Evidence" value={`${tasks.filter((task) => task.status === 'COMPLETED').length} completed tasks`} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onComplete,
  isPending,
}: {
  task: OffboardingTask;
  onComplete: () => void;
  isPending: boolean;
}) {
  const ownerGroup = inferOwnerGroup(task);
  const isTerminal = task.status === 'COMPLETED' || task.status === 'SKIPPED';
  return (
    <div className="fusion-glass grid gap-3 rounded-2xl p-4 lg:grid-cols-[1fr_auto]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-foreground">{task.title}</h3>
          <OwnerBadge ownerGroup={ownerGroup} />
          <Badge variant={task.status === 'COMPLETED' ? 'default' : task.status === 'OVERDUE' ? 'destructive' : 'secondary'}>{task.status.replace(/_/g, ' ')}</Badge>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{task.description ?? 'No instructions provided yet.'}</p>
        <p className="mt-2 text-xs text-muted-foreground">Due {formatDate(task.dueDate)}</p>
      </div>
      <Button size="sm" variant={task.status === 'COMPLETED' ? 'outline' : 'default'} onClick={onComplete} disabled={isTerminal || isPending}>
        <CheckCircle2 className="mr-2 h-4 w-4" />
        Complete
      </Button>
    </div>
  );
}

function OwnerBadge({ ownerGroup }: { ownerGroup: OwnerGroup }) {
  return <Badge variant="outline" className={cn('mt-2 w-fit rounded-full border px-2 py-1 text-xs', ownerStyles[ownerGroup])}>{ownerGroup}</Badge>;
}

function Snapshot({ label, value }: { label: string; value: string }) {
  return (
    <div className="fusion-glass rounded-2xl p-3">
      <p className="lumina-label">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
