import * as React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
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
  HR: 'border-[#10b981]/30 bg-[#10b981]/10 text-[#006c49]',
  IT: 'border-[#0b8cff]/30 bg-[#d8e7ff] text-[#17346c]',
  Finance: 'border-[#e29100]/30 bg-[#ffddb8]/70 text-[#653e00]',
  Admin: 'border-[#4648d4]/30 bg-[#4648d4]/10 text-[#4648d4]',
  Manager: 'border-[#7c3aed]/30 bg-[#ede9fe] text-[#5b21b6]',
  Security: 'border-[#ba1a1a]/30 bg-[#ffdad6] text-[#93000a]',
  Facilities: 'border-[#64748b]/30 bg-[#f1f5f9] text-[#334155]',
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
    <div className="min-h-full bg-[#e9eef5]">
      <div className="relative overflow-hidden bg-[#0f2f26]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(7,44,35,0.98),rgba(10,83,59,0.76)),repeating-linear-gradient(135deg,rgba(255,255,255,0.08)_0px,rgba(255,255,255,0.08)_1px,transparent_1px,transparent_18px)]" />
        <div className="relative mx-auto grid max-w-[1740px] gap-6 px-4 py-8 text-white lg:grid-cols-[1fr_auto] lg:px-5">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#6ffbbe]">Employee preboarding</p>
            <h2 className="mt-2 font-headline text-3xl font-bold">Welcome, {firstName}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/85">
              Complete your preboarding checklist, sign documents, upload evidence, confirm IT provisioning, and follow your 30/60/90 plan before probation review.
            </p>
          </div>
          <Button asChild className="w-fit self-end bg-white text-[#006c49] hover:bg-[#eff4ff]">
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
                  <AvatarFallback className="rounded-xl bg-[#d8e7ff] text-2xl font-bold text-[#17346c]">
                    {(worker?.firstName ?? user?.firstName ?? 'N').charAt(0)}{(worker?.lastName ?? user?.lastName ?? 'H').charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <h3 className="mt-4 font-semibold text-[#0b1c30]">{workerName(worker, `${user?.firstName ?? 'New'} ${user?.lastName ?? 'Hire'}`)}</h3>
                <p className="mt-1 text-sm text-[#3c4a42]">{worker?.jobTitle ?? 'Role pending'} / {worker?.departmentName ?? 'Department pending'}</p>
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
                <div className="rounded-lg border border-dashed border-[#bbcabf] bg-white p-5">
                  <h3 className="font-semibold text-[#0b1c30]">No active preboarding plan yet</h3>
                  <p className="mt-2 text-sm text-[#3c4a42]">HR can launch an onboarding plan once your employee record and start date are ready.</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="lumina-label">Overall progress</p>
                      <p className="mt-1 font-headline text-3xl font-bold text-[#0b1c30]">{completed}% complete</p>
                    </div>
                    <Badge variant="outline" className="w-fit rounded-full border-[#10b981]/30 bg-[#10b981]/10 px-3 py-1 text-[#006c49]">
                      Portal {plan?.preboardingPortalStatus?.replace(/_/g, ' ') ?? 'ACTIVE'}
                    </Badge>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#dce9ff]">
                    <div className="h-full rounded-full bg-[#10b981]" style={{ width: `${completed}%` }} />
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
                <Card key={section.label}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#10b981]/10 text-[#006c49]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant={done ? 'default' : 'secondary'}>{done ? 'Done' : `${sectionTasks.length} items`}</Badge>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-[#0b1c30]">{section.label}</h3>
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
                    <p className="rounded-lg border border-dashed border-[#bbcabf] bg-white p-5 text-sm text-[#3c4a42]">Your checklist will appear here after HR publishes onboarding tasks.</p>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents">
              <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                <Card>
                  <CardHeader className="p-5">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileSignature className="h-5 w-5 text-[#006c49]" />
                      Signing and Evidence
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5 pt-0">
                    {documents.map((task) => <TaskRow key={task.id} task={task} onComplete={() => completeTaskMutation.mutate({ id: task.id })} isPending={completeTaskMutation.isPending} />)}
                    {documents.length === 0 ? <p className="text-sm text-[#3c4a42]">No document tasks assigned yet.</p> : null}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-5">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <UploadCloud className="h-5 w-5 text-[#006c49]" />
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
                    <div className="grid h-12 w-12 place-items-center rounded-lg bg-[#10b981]/10 text-[#006c49]">
                      <GraduationCap className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#0b1c30]">Probation Management</h3>
                      <p className="mt-2 text-sm leading-6 text-[#3c4a42]">
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
    <div className="grid gap-3 rounded-lg border border-[#bbcabf]/70 bg-white p-4 lg:grid-cols-[1fr_auto]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-[#0b1c30]">{task.title}</h3>
          <OwnerBadge ownerGroup={ownerGroup} />
          <Badge variant={task.status === 'COMPLETED' ? 'default' : task.status === 'OVERDUE' ? 'destructive' : 'secondary'}>{task.status.replace(/_/g, ' ')}</Badge>
        </div>
        <p className="mt-2 text-sm leading-6 text-[#3c4a42]">{task.description ?? 'No instructions provided yet.'}</p>
        <p className="mt-2 text-xs text-[#6c7a71]">Due {formatDate(task.dueDate)}</p>
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
    <div className="rounded-lg border border-[#bbcabf]/70 bg-[#eff4ff] p-3">
      <p className="lumina-label">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[#0b1c30]">{value}</p>
    </div>
  );
}

function PlanCard({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <CalendarClock className="h-6 w-6 text-[#006c49]" />
        <h3 className="mt-4 font-semibold text-[#0b1c30]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[#3c4a42]">{body}</p>
      </CardContent>
    </Card>
  );
}
