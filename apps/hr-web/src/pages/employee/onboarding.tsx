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
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileSignature,
  GraduationCap,
  Laptop,
  ShieldCheck,
  UploadCloud,
  UserRoundCheck,
} from 'lucide-react';
import type { Worker } from '@/types';

type OwnerGroup = 'HR' | 'IT' | 'Finance' | 'Admin' | 'Manager' | 'Security' | 'Facilities';
type OnboardingTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'SKIPPED';

interface OnboardingPlan {
  id: string;
  workerId: string;
  startDate: string;
  status: 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  assignedBuddyId?: string;
  mentorId?: string;
  preboardingPortalStatus?: 'NOT_INVITED' | 'INVITED' | 'ACTIVE' | 'COMPLETED';
  probationReviewDate?: string;
  probationStatus?: string;
}

interface OnboardingTask {
  id: string;
  onboardingPlanId?: string;
  title: string;
  description?: string;
  ownerGroup?: string;
  category?: string;
  evidenceType?: string;
  dueDate?: string;
  completedAt?: string;
  status: OnboardingTaskStatus;
}

const preboardingSections = [
  { label: 'Profile and emergency contacts', icon: ClipboardCheck, owner: 'HR' as OwnerGroup },
  { label: 'Document signing and upload evidence', icon: FileSignature, owner: 'HR' as OwnerGroup },
  { label: 'IT provisioning', icon: Laptop, owner: 'IT' as OwnerGroup },
  { label: '30/60/90 plan', icon: CalendarClock, owner: 'Manager' as OwnerGroup },
  { label: 'Buddy and mentor', icon: UserRoundCheck, owner: 'Manager' as OwnerGroup },
  { label: 'Compliance onboarding', icon: ShieldCheck, owner: 'Security' as OwnerGroup },
  { label: 'Probation management', icon: BadgeCheck, owner: 'HR' as OwnerGroup },
];

const ownerStyles: Record<OwnerGroup, string> = {
  HR: 'border-secondary/30 bg-secondary/10 text-primary',
  IT: 'border-primary/30 bg-accent text-foreground',
  Finance: 'border-warning/30 bg-warning/70 text-warning-foreground',
  Admin: 'border-primary/30 bg-primary/10 text-primary',
  Manager: 'border-secondary/30 bg-secondary/10 text-secondary',
  Security: 'border-destructive/30 bg-destructive/10 text-destructive-foreground',
  Facilities: 'border-muted-foreground/30 bg-muted text-muted-foreground',
};

function unwrap<T>(payload: unknown): T {
  const response = payload as { data?: T; success?: boolean };
  if (response.success === true && response.data !== undefined) return response.data;
  return payload as T;
}

function toPlan(payload: unknown): OnboardingPlan | null {
  if (!payload || typeof payload !== 'object') return null;
  return payload as OnboardingPlan;
}

function toTaskList(payload: unknown): OnboardingTask[] {
  return Array.isArray(payload) ? payload as OnboardingTask[] : [];
}

function workerName(worker?: Worker, fallback = 'New hire') {
  if (!worker) return fallback;
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
    if (preboardingSections.some((section) => section.owner === normalized)) return normalized as OwnerGroup;
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

function completionPercent(tasks: OnboardingTask[]) {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((task) => task.status === 'COMPLETED' || task.status === 'SKIPPED').length / tasks.length) * 100);
}

export function EmployeeOnboarding() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const addNotification = useUIStore((s) => s.addNotification);
  const [evidenceNote, setEvidenceNote] = React.useState('');
  const [uploadMessage, setUploadMessage] = React.useState('');

  const { data: worker } = useApiQuery<Worker>(['employee-onboarding-worker'], '/employee/profile');

  const { data: plan, isLoading: planLoading, isError: planError } = useQuery({
    queryKey: ['employee-onboarding-plan', worker?.id],
    enabled: Boolean(worker?.id),
    retry: false,
    queryFn: async () => toPlan(unwrap<unknown>((await apiClient.get(`/hr/onboarding/plans/worker/${worker?.id}`)).data)),
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['employee-onboarding-tasks', plan?.id],
    enabled: Boolean(plan?.id),
    queryFn: async () => toTaskList(unwrap<unknown>((await apiClient.get(`/hr/onboarding/tasks/plan/${plan?.id}`)).data)),
  });

  const completeTaskMutation = useApiMutation<unknown, { id: string }>(
    ({ id }) => `/hr/onboarding/tasks/${id}/commands/complete`,
    'post',
    [['employee-onboarding-tasks']],
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ['employee-onboarding-tasks', plan?.id] });
        addNotification({
          title: 'Task completed',
          message: 'Your onboarding task was marked complete.',
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
    ({ id }) => `/hr/onboarding/tasks/${id}/evidence`,
    'post',
    [['employee-onboarding-tasks']],
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ['employee-onboarding-tasks', plan?.id] });
        addNotification({
          title: 'Evidence submitted',
          message: 'Your evidence was sent to the onboarding checklist for HR review.',
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

  const buddyMentorStatus = plan?.assignedBuddyId || plan?.mentorId ? 'Assigned' : 'Pending';
  const completed = completionPercent(tasks);
  const documents = tasks.filter((task) => inferOwnerGroup(task) === 'HR' || /document|contract|signature|upload|evidence/i.test(task.title));
  const provisioning = tasks.filter((task) => inferOwnerGroup(task) === 'IT');
  const compliance = tasks.filter((task) => inferOwnerGroup(task) === 'Security' || /compliance|policy|conduct|security/i.test(task.title));
  const firstName = user?.firstName || worker?.firstName || 'there';

  const recordEvidence = () => {
    const evidenceTask = documents.find((task) => task.status !== 'COMPLETED' && task.status !== 'SKIPPED') ?? tasks.find((task) => task.status !== 'COMPLETED' && task.status !== 'SKIPPED');
    if (!evidenceNote.trim() || !evidenceTask) return;
    evidenceMutation.mutate({
      id: evidenceTask.id,
      evidenceType: evidenceTask.evidenceType ?? 'EMPLOYEE_PREBOARDING_EVIDENCE',
      evidencePayload: {
        note: evidenceNote.trim(),
        recordedAt: new Date().toISOString(),
        channel: 'EMPLOYEE_PREBOARDING_PORTAL',
      },
      completionNotes: evidenceNote.trim(),
      completeTask: true,
    });
    setUploadMessage('Evidence submitted to the onboarding checklist for HR review.');
    setEvidenceNote('');
  };

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[1740px] px-4 pt-6 lg:px-5">
        <div className="fusion-glass grid gap-6 rounded-[2rem] p-6 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">Employee preboarding</p>
            <h2 className="fusion-gradient-text mt-2 font-headline text-3xl font-bold">Welcome, {firstName}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Complete your preboarding checklist, sign documents, upload evidence, confirm IT provisioning, and follow your 30/60/90 plan before probation review.
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
                <h3 className="mt-4 font-semibold text-foreground">{workerName(worker, `${user?.firstName ?? 'New'} ${user?.lastName ?? 'Hire'}`)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{worker?.jobTitle ?? 'Role pending'} / {worker?.departmentName ?? 'Department pending'}</p>
                <Badge className="mt-3" variant={plan?.status === 'COMPLETED' ? 'default' : 'secondary'}>{plan?.status?.replace(/_/g, ' ') ?? 'PLAN PENDING'}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-5">
              <CardTitle className="text-lg">Journey Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              <Snapshot label="Start date" value={formatDate(plan?.startDate)} />
              <Snapshot label="Checklist complete" value={`${completed}%`} />
              <Snapshot label="Buddy / mentor" value={buddyMentorStatus} />
              <Snapshot label="Probation review" value={formatDate(plan?.probationReviewDate)} />
            </CardContent>
          </Card>
        </aside>

        <main className="space-y-4">
          <Card>
            <CardContent className="p-5">
              {planLoading ? <Skeleton className="h-24 w-full" /> : null}
              {!planLoading && (planError || !plan) ? (
                <div className="fusion-glass rounded-2xl p-5">
                  <h3 className="font-semibold text-foreground">No active preboarding plan yet</h3>
                  <p className="mt-2 text-sm text-muted-foreground">HR can launch an onboarding plan once your employee record and start date are ready.</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="lumina-label">Overall progress</p>
                      <p className="mt-1 font-headline text-3xl font-bold text-foreground">{completed}% complete</p>
                    </div>
                    <Badge variant="outline" className="w-fit rounded-full border-secondary/30 bg-secondary/10 px-3 py-1 text-primary">
                      Portal {plan?.preboardingPortalStatus?.replace(/_/g, ' ') ?? 'ACTIVE'}
                    </Badge>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-accent">
                    <div className="h-full rounded-full bg-secondary" style={{ width: `${completed}%` }} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {preboardingSections.map((section) => {
              const Icon = section.icon;
              const sectionTasks = tasks.filter((task) => {
                const text = `${task.title} ${task.description ?? ''}`.toLowerCase();
                return text.includes(section.label.split(' ')[0].toLowerCase()) || inferOwnerGroup(task) === section.owner;
              });
              const done = sectionTasks.some((task) => task.status === 'COMPLETED');
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
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="plan">30/60/90</TabsTrigger>
              <TabsTrigger value="probation">Probation</TabsTrigger>
            </TabsList>

            <TabsContent value="checklist">
              <Card>
                <CardHeader className="p-5">
                  <CardTitle className="text-lg">Your Preboarding Tasks</CardTitle>
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
                    <p className="fusion-glass rounded-2xl p-5 text-sm text-muted-foreground">Your checklist will appear here after HR publishes onboarding tasks.</p>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents">
              <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                <Card>
                  <CardHeader className="p-5">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileSignature className="h-5 w-5 text-primary" />
                      Signing and Evidence
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5 pt-0">
                    {documents.map((task) => <TaskRow key={task.id} task={task} onComplete={() => completeTaskMutation.mutate({ id: task.id })} isPending={completeTaskMutation.isPending} />)}
                    {documents.length === 0 ? <p className="text-sm text-muted-foreground">No document tasks assigned yet.</p> : null}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-5">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <UploadCloud className="h-5 w-5 text-primary" />
                      Evidence Note
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5 pt-0">
                    <Input value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} placeholder="Describe uploaded identity, tax, or bank evidence" />
                    <Button className="w-full" onClick={recordEvidence} disabled={!evidenceNote.trim()}>Stage evidence</Button>
                    {uploadMessage ? <p className="rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{uploadMessage}</p> : null}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="plan">
              <div className="grid gap-4 lg:grid-cols-3">
                <PlanCard title="First 30 days" body="Complete required documents, meet your buddy, finish compliance onboarding, and confirm IT access." />
                <PlanCard title="Days 31-60" body="Own your first role outcomes, review expectations with your manager, and record learning progress." />
                <PlanCard title="Days 61-90" body="Prepare probation evidence, agree next-quarter goals, and confirm any support or access gaps." />
              </div>
              <Card className="mt-4">
                <CardContent className="grid gap-3 p-5 md:grid-cols-3">
                  <Snapshot label="IT provisioning" value={provisioning.length ? `${provisioning.length} tasks` : 'Pending'} />
                  <Snapshot label="Buddy / mentor" value={buddyMentorStatus} />
                  <Snapshot label="Compliance" value={compliance.length ? `${compliance.length} tasks` : 'Pending'} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="probation">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-lg bg-secondary/10 text-primary">
                      <GraduationCap className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Probation Management</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Your manager and HR use onboarding evidence, 30/60/90 outcomes, compliance completion, and buddy feedback to prepare the probation decision.
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <Snapshot label="Review date" value={formatDate(plan?.probationReviewDate)} />
                        <Snapshot label="Status" value={plan?.probationStatus?.replace(/_/g, ' ') ?? 'Pending review'} />
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
  task: OnboardingTask;
  onComplete: () => void;
  isPending: boolean;
}) {
  const ownerGroup = inferOwnerGroup(task);
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
      <Button size="sm" variant={task.status === 'COMPLETED' ? 'outline' : 'default'} onClick={onComplete} disabled={task.status === 'COMPLETED' || isPending}>
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

function PlanCard({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <CalendarClock className="h-6 w-6 text-primary" />
        <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
