import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Sparkles } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { useUIStore } from '@/stores/ui-store';
import { AllowedActions } from '@/components/common/allowed-actions';
import { BusinessMetric, BusinessPageHeader, SectionHeading } from '@/components/common/business-page';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AllowedAction } from '@/types';

type ApiEnvelope<T> = { success?: boolean; data?: T };
type IdValue = string | { value?: string } | undefined | null;

interface SkillEntry {
  skillId?: string;
  proficiency?: number;
}

interface SkillProfile {
  id?: IdValue;
  workerId?: string;
  skills?: SkillEntry[];
  status?: string;
}

interface TalentPool {
  id?: IdValue;
  poolName?: string;
  criteria?: Record<string, unknown>;
  memberIds?: string[];
  status?: string;
}

interface CareerPath {
  id?: IdValue;
  title?: string;
  currentRole?: string;
  targetRole?: string;
  requiredSkills?: string[];
  milestones?: { milestoneId?: string; title?: string; requiredSkills?: string[] }[];
  status?: string;
}

interface SuccessionPlan {
  id?: IdValue;
  positionId?: string;
  incumbentWorkerId?: string;
  successorCandidates?: { workerId?: string; readinessLevel?: number }[];
  status?: string;
}

interface SkillProfileForm {
  workerId: string;
  skillCodes: string;
}

interface TalentPoolForm {
  poolName: string;
  criteriaRole: string;
  memberIds: string;
}

interface CareerPathForm {
  title: string;
  currentRole: string;
  targetRole: string;
  requiredSkills: string;
  milestoneId: string;
  milestoneTitle: string;
}

interface SuccessionPlanForm {
  positionId: string;
  incumbentWorkerId: string;
  successorWorkerId: string;
  readinessLevel: string;
}

function unwrap<T>(response: { data?: ApiEnvelope<T> | T }): T {
  const body = response.data as ApiEnvelope<T> | T;
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as ApiEnvelope<T>).data as T;
  }
  return body as T;
}

function recordId(value: IdValue): string {
  if (!value) return '';
  return typeof value === 'string' ? value : value.value ?? '';
}

function asList<T extends { id?: IdValue }>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && recordId((value as T).id)) return [value as T];
  return [];
}

function csv(value: string): string[] {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function skillEntries(value: string): SkillEntry[] {
  return csv(value).map((skillId) => ({ skillId, proficiency: 3 }));
}

function mutationError(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed.';
}

function statusVariant(status?: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  const normalized = (status ?? '').toUpperCase();
  if (['ACTIVE', 'VALIDATED', 'ACHIEVED', 'OPEN', 'READY'].includes(normalized)) return 'default';
  if (['DRAFT', 'IN_PROGRESS', 'PLANNED'].includes(normalized)) return 'secondary';
  if (['ARCHIVED', 'CLOSED', 'REJECTED', 'FAILED'].includes(normalized)) return 'destructive';
  return 'outline';
}

function statusBadge(status?: string) {
  return <Badge variant={statusVariant(status)}>{status ?? 'DRAFT'}</Badge>;
}

function defaultProfileForm(workerId: string): SkillProfileForm {
  return { workerId, skillCodes: 'leadership, workforce-planning' };
}

function defaultPoolForm(workerId: string): TalentPoolForm {
  return { poolName: 'Critical Roles', criteriaRole: 'Clinical', memberIds: workerId };
}

function defaultCareerPathForm(): CareerPathForm {
  return {
    title: 'Nurse Leader Path',
    currentRole: 'Senior Nurse',
    targetRole: 'Nursing Manager',
    requiredSkills: 'leadership, workforce-planning',
    milestoneId: 'milestone-1',
    milestoneTitle: 'Ready for manager assessment',
  };
}

function defaultSuccessionForm(workerId: string): SuccessionPlanForm {
  return {
    positionId: '',
    incumbentWorkerId: workerId,
    successorWorkerId: workerId,
    readinessLevel: '2',
  };
}

function firstMilestoneId(path: CareerPath): string {
  return path.milestones?.find((milestone) => milestone.milestoneId)?.milestoneId ?? 'milestone-1';
}

function actionToken(action: AllowedAction): string {
  return `${action.action} ${action.id} ${action.label}`.toLowerCase();
}

function actionMatches(action: AllowedAction, tokens: string[]): boolean {
  const token = actionToken(action);
  return tokens.some((candidate) => token.includes(candidate.toLowerCase()));
}

export function AdminSkillsTalent() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const addNotification = useUIStore((state) => state.addNotification);
  const actorId = user?.id ?? '';
  const [activeTab, setActiveTab] = React.useState('skill-profiles');
  const [selectedWorkerId, setSelectedWorkerId] = React.useState(actorId);
  const [profileDialogOpen, setProfileDialogOpen] = React.useState(false);
  const [poolDialogOpen, setPoolDialogOpen] = React.useState(false);
  const [careerDialogOpen, setCareerDialogOpen] = React.useState(false);
  const [successionDialogOpen, setSuccessionDialogOpen] = React.useState(false);
  const [profileForm, setProfileForm] = React.useState<SkillProfileForm>(() => defaultProfileForm(actorId));
  const [poolForm, setPoolForm] = React.useState<TalentPoolForm>(() => defaultPoolForm(actorId));
  const [careerForm, setCareerForm] = React.useState<CareerPathForm>(() => defaultCareerPathForm());
  const [successionForm, setSuccessionForm] = React.useState<SuccessionPlanForm>(() => defaultSuccessionForm(actorId));

  React.useEffect(() => {
    if (!selectedWorkerId && actorId) setSelectedWorkerId(actorId);
  }, [actorId, selectedWorkerId]);

  const profileQuery = useQuery({
    queryKey: ['skills-talent-profile-worker', selectedWorkerId],
    enabled: Boolean(tenantId && selectedWorkerId),
    queryFn: async () => asList<SkillProfile>(unwrap(await apiClient.get(`/skills-talent/skill-profiles/worker/${selectedWorkerId}`))),
  });

  const poolsQuery = useQuery({
    queryKey: ['skills-talent-pools', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => asList<TalentPool>(unwrap(await apiClient.get(`/skills-talent/talent-pools/tenant/${tenantId}`))),
  });

  const careerPathsQuery = useQuery({
    queryKey: ['skills-talent-career-paths', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => asList<CareerPath>(unwrap(await apiClient.get(`/skills-talent/career-paths/tenant/${tenantId}`))),
  });

  const successionPlansQuery = useQuery({
    queryKey: ['skills-talent-succession-plans', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => asList<SuccessionPlan>(unwrap(await apiClient.get(`/skills-talent/succession-plans/tenant/${tenantId}`))),
  });

  const profiles = React.useMemo(() => profileQuery.data ?? [], [profileQuery.data]);
  const pools = React.useMemo(() => poolsQuery.data ?? [], [poolsQuery.data]);
  const careerPaths = React.useMemo(() => careerPathsQuery.data ?? [], [careerPathsQuery.data]);
  const successionPlans = React.useMemo(() => successionPlansQuery.data ?? [], [successionPlansQuery.data]);

  const invalidateSkillsTalent = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['skills-talent-profile-worker'] });
    void queryClient.invalidateQueries({ queryKey: ['skills-talent-pools'] });
    void queryClient.invalidateQueries({ queryKey: ['skills-talent-career-paths'] });
    void queryClient.invalidateQueries({ queryKey: ['skills-talent-succession-plans'] });
  }, [queryClient]);

  const commandMutation = useMutation({
    mutationFn: async ({ path, body }: { path: string; body?: Record<string, unknown> }) => apiClient.post(path, body ?? {}),
    onSuccess: () => {
      addNotification({ title: 'Talent action completed', message: 'The talent record was updated.', type: 'success', read: false });
      invalidateSkillsTalent();
    },
    onError: (error) => addNotification({ title: 'Action failed', message: mutationError(error), type: 'error', read: false }),
  });

  const runProfileAction = React.useCallback((item: SkillProfile, action: AllowedAction) => {
    const id = recordId(item.id);
    if (!id) return;
    if (actionMatches(action, ['validate'])) {
      commandMutation.mutate({ path: `/skills-talent/skill-profiles/${id}/commands/validate`, body: { validatedBy: actorId } });
      return;
    }
    if (actionMatches(action, ['update'])) {
      commandMutation.mutate({ path: `/skills-talent/skill-profiles/${id}/commands/update`, body: { skills: item.skills ?? [] } });
      return;
    }
    if (actionMatches(action, ['archive'])) {
      commandMutation.mutate({ path: `/skills-talent/skill-profiles/${id}/commands/archive` });
    }
  }, [actorId, commandMutation]);

  const runPoolAction = React.useCallback((item: TalentPool, action: AllowedAction) => {
    const id = recordId(item.id);
    if (!id) return;
    if (actionMatches(action, ['add member', 'add-member'])) {
      commandMutation.mutate({ path: `/skills-talent/talent-pools/${id}/commands/add-member`, body: { memberId: selectedWorkerId } });
      return;
    }
    if (actionMatches(action, ['remove member', 'remove-member'])) {
      commandMutation.mutate({ path: `/skills-talent/talent-pools/${id}/commands/remove-member`, body: { memberId: selectedWorkerId } });
      return;
    }
    if (actionMatches(action, ['close'])) {
      commandMutation.mutate({ path: `/skills-talent/talent-pools/${id}/commands/close` });
      return;
    }
    if (actionMatches(action, ['update'])) {
      commandMutation.mutate({ path: `/skills-talent/talent-pools/${id}/commands/update`, body: { criteria: item.criteria ?? { workerProfile: selectedWorkerId } } });
    }
  }, [commandMutation, selectedWorkerId]);

  const runCareerPathAction = React.useCallback((item: CareerPath, action: AllowedAction) => {
    const id = recordId(item.id);
    if (!id) return;
    if (actionMatches(action, ['achieve milestone', 'achieve-milestone'])) {
      commandMutation.mutate({ path: `/skills-talent/career-paths/${id}/commands/achieve-milestone`, body: { milestoneId: firstMilestoneId(item) } });
      return;
    }
    if (actionMatches(action, ['activate'])) {
      commandMutation.mutate({ path: `/skills-talent/career-paths/${id}/commands/activate` });
      return;
    }
    if (actionMatches(action, ['archive'])) {
      commandMutation.mutate({ path: `/skills-talent/career-paths/${id}/commands/archive` });
    }
  }, [commandMutation]);

  const runSuccessionAction = React.useCallback((item: SuccessionPlan, action: AllowedAction) => {
    const id = recordId(item.id);
    if (!id) return;
    const candidate = item.successorCandidates?.[0];
    if (actionMatches(action, ['update readiness', 'update-readiness'])) {
      if (!candidate?.workerId) return;
      commandMutation.mutate({
        path: `/skills-talent/succession-plans/${id}/commands/update-readiness`,
        body: { workerId: candidate.workerId, readinessLevel: candidate.readinessLevel ?? 1 },
      });
      return;
    }
    if (actionMatches(action, ['review'])) {
      commandMutation.mutate({ path: `/skills-talent/succession-plans/${id}/commands/review` });
      return;
    }
    if (actionMatches(action, ['activate'])) {
      commandMutation.mutate({ path: `/skills-talent/succession-plans/${id}/commands/activate` });
    }
  }, [commandMutation]);

  const createProfileMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => apiClient.post('/skills-talent/skill-profiles', payload),
    onSuccess: () => {
      addNotification({ title: 'Skill profile created', message: 'The worker skill profile is ready for validation.', type: 'success', read: false });
      setProfileDialogOpen(false);
      setProfileForm(defaultProfileForm(selectedWorkerId || actorId));
      invalidateSkillsTalent();
    },
    onError: (error) => addNotification({ title: 'Could not create profile', message: mutationError(error), type: 'error', read: false }),
  });

  const createPoolMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => apiClient.post('/skills-talent/talent-pools', payload),
    onSuccess: () => {
      addNotification({ title: 'Talent pool created', message: 'The talent pool is now available.', type: 'success', read: false });
      setPoolDialogOpen(false);
      setPoolForm(defaultPoolForm(selectedWorkerId || actorId));
      invalidateSkillsTalent();
    },
    onError: (error) => addNotification({ title: 'Could not create pool', message: mutationError(error), type: 'error', read: false }),
  });

  const createCareerPathMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => apiClient.post('/skills-talent/career-paths', payload),
    onSuccess: () => {
      addNotification({ title: 'Career path created', message: 'The career path is ready for activation.', type: 'success', read: false });
      setCareerDialogOpen(false);
      setCareerForm(defaultCareerPathForm());
      invalidateSkillsTalent();
    },
    onError: (error) => addNotification({ title: 'Could not create career path', message: mutationError(error), type: 'error', read: false }),
  });

  const createSuccessionMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => apiClient.post('/skills-talent/succession-plans', payload),
    onSuccess: () => {
      addNotification({ title: 'Succession plan created', message: 'The succession plan is ready for review.', type: 'success', read: false });
      setSuccessionDialogOpen(false);
      setSuccessionForm(defaultSuccessionForm(selectedWorkerId || actorId));
      invalidateSkillsTalent();
    },
    onError: (error) => addNotification({ title: 'Could not create succession plan', message: mutationError(error), type: 'error', read: false }),
  });

  const profileColumns: DataTableColumn<SkillProfile>[] = [
    { key: 'worker', header: 'Worker', cell: (item) => item.workerId ?? selectedWorkerId },
    {
      key: 'skills',
      header: 'Skills',
      cell: (item) => (
        <div className="flex flex-wrap gap-2">
          {(item.skills ?? []).map((skill) => (
            <Badge key={skill.skillId} variant="outline">{skill.skillId} · L{skill.proficiency ?? 0}</Badge>
          ))}
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (item) => statusBadge(item.status) },
    {
      key: 'actions',
      header: 'Actions',
      cell: (item) => {
        const id = recordId(item.id);
        return (
          <AllowedActions
            aggregateType="SkillProfile"
            aggregateId={id}
            state={item.status}
            context={{ tenantId }}
            onAction={(action) => runProfileAction(item, action)}
            variant="outline"
          />
        );
      },
    },
  ];

  const poolColumns: DataTableColumn<TalentPool>[] = [
    { key: 'name', header: 'Pool', cell: (item) => item.poolName ?? 'Talent pool' },
    { key: 'members', header: 'Members', cell: (item) => `${item.memberIds?.length ?? 0} members` },
    { key: 'status', header: 'Status', cell: (item) => statusBadge(item.status) },
    {
      key: 'actions',
      header: 'Actions',
      cell: (item) => {
        const id = recordId(item.id);
        return (
          <AllowedActions
            aggregateType="TalentPool"
            aggregateId={id}
            state={item.status}
            context={{ tenantId }}
            onAction={(action) => runPoolAction(item, action)}
            variant="outline"
          />
        );
      },
    },
  ];

  const careerPathColumns: DataTableColumn<CareerPath>[] = [
    { key: 'title', header: 'Path', cell: (item) => item.title ?? 'Career path' },
    { key: 'roles', header: 'Progression', cell: (item) => `${item.currentRole ?? 'Current role'} -> ${item.targetRole ?? 'Target role'}` },
    { key: 'skills', header: 'Required skills', cell: (item) => (item.requiredSkills ?? []).join(', ') || 'Not configured' },
    { key: 'status', header: 'Status', cell: (item) => statusBadge(item.status) },
    {
      key: 'actions',
      header: 'Actions',
      cell: (item) => {
        const id = recordId(item.id);
        return (
          <AllowedActions
            aggregateType="CareerPath"
            aggregateId={id}
            state={item.status}
            context={{ tenantId }}
            onAction={(action) => runCareerPathAction(item, action)}
            variant="outline"
          />
        );
      },
    },
  ];

  const successionColumns: DataTableColumn<SuccessionPlan>[] = [
    { key: 'position', header: 'Position', cell: (item) => item.positionId ?? 'Position' },
    { key: 'incumbent', header: 'Incumbent', cell: (item) => item.incumbentWorkerId ?? 'Vacant' },
    { key: 'candidates', header: 'Candidates', cell: (item) => `${item.successorCandidates?.length ?? 0} candidates` },
    { key: 'status', header: 'Status', cell: (item) => statusBadge(item.status) },
    {
      key: 'actions',
      header: 'Actions',
      cell: (item) => {
        const id = recordId(item.id);
        return (
          <AllowedActions
            aggregateType="SuccessionPlan"
            aggregateId={id}
            state={item.status}
            context={{ tenantId }}
            onAction={(action) => runSuccessionAction(item, action)}
            variant="outline"
          />
        );
      },
    },
  ];

  const submitProfile = () => {
    createProfileMutation.mutate({ workerId: profileForm.workerId, skills: skillEntries(profileForm.skillCodes) });
  };

  const submitPool = () => {
    createPoolMutation.mutate({
      poolName: poolForm.poolName,
      criteria: { roleFamily: poolForm.criteriaRole },
      memberIds: csv(poolForm.memberIds),
    });
  };

  const submitCareerPath = () => {
    const requiredSkills = csv(careerForm.requiredSkills);
    createCareerPathMutation.mutate({
      title: careerForm.title,
      currentRole: careerForm.currentRole,
      targetRole: careerForm.targetRole,
      requiredSkills,
      milestones: [{
        milestoneId: careerForm.milestoneId,
        title: careerForm.milestoneTitle,
        requiredSkills,
      }],
    });
  };

  const submitSuccessionPlan = () => {
    const readinessLevel = Number(successionForm.readinessLevel);
    createSuccessionMutation.mutate({
      positionId: successionForm.positionId,
      incumbentWorkerId: successionForm.incumbentWorkerId || undefined,
      successorCandidates: successionForm.successorWorkerId
        ? [{ workerId: successionForm.successorWorkerId, readinessLevel: Number.isFinite(readinessLevel) ? readinessLevel : 1 }]
        : [],
    });
  };

  return (
    <div className="space-y-6">
      <BusinessPageHeader
        eyebrow="Talent"
        icon={Sparkles}
        title="Skills & Talent"
        subtitle="Manage worker capabilities, talent pools, career paths, and succession readiness."
        actions={(
          <div className="flex flex-wrap gap-2">
            <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setProfileForm(defaultProfileForm(selectedWorkerId || actorId))} type="button">
                  <Plus className="mr-2 h-4 w-4" /> Create Skill Profile
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Skill Profile</DialogTitle>
                  <DialogDescription>Capture a worker capability profile for validation.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="profile-worker-id">Profile worker ID</Label>
                    <Input id="profile-worker-id" value={profileForm.workerId} onChange={(event) => setProfileForm((current) => ({ ...current, workerId: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-skill-codes">Skill codes</Label>
                    <Input id="profile-skill-codes" value={profileForm.skillCodes} onChange={(event) => setProfileForm((current) => ({ ...current, skillCodes: event.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={submitProfile} type="button">Save Skill Profile</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={poolDialogOpen} onOpenChange={setPoolDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setPoolForm(defaultPoolForm(selectedWorkerId || actorId))} type="button" variant="outline">
                  <Plus className="mr-2 h-4 w-4" /> Create Pool
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Talent Pool</DialogTitle>
                  <DialogDescription>Group workers for succession, critical roles, or workforce planning.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pool-name">Pool name</Label>
                    <Input id="pool-name" value={poolForm.poolName} onChange={(event) => setPoolForm((current) => ({ ...current, poolName: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pool-criteria">Criteria role family</Label>
                    <Input id="pool-criteria" value={poolForm.criteriaRole} onChange={(event) => setPoolForm((current) => ({ ...current, criteriaRole: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pool-members">Initial member IDs</Label>
                    <Input id="pool-members" value={poolForm.memberIds} onChange={(event) => setPoolForm((current) => ({ ...current, memberIds: event.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={submitPool} type="button">Save Pool</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BusinessMetric label="Skills" value={profiles.reduce((count, profile) => count + (profile.skills?.length ?? 0), 0)} />
        <BusinessMetric label="Pools" value={pools.length} />
        <BusinessMetric label="Career Paths" value={careerPaths.length} />
        <BusinessMetric label="Succession Plans" value={successionPlans.length} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-[minmax(280px,420px)_1fr] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="worker-profile-lookup">Worker profile lookup</Label>
              <div className="flex gap-2">
                <Input
                  id="worker-profile-lookup"
                  value={selectedWorkerId}
                  onChange={(event) => setSelectedWorkerId(event.target.value)}
                  placeholder="Worker UUID"
                />
                <Button aria-label="Search worker profile" disabled={!selectedWorkerId} type="button" variant="outline">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Skill profiles are worker-scoped; pools and paths are tenant-wide.</p>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid h-auto grid-cols-2 gap-2 lg:grid-cols-4">
          <TabsTrigger value="skill-profiles">Skill Profiles</TabsTrigger>
          <TabsTrigger value="talent-pools">Talent Pools</TabsTrigger>
          <TabsTrigger value="career-paths">Career Paths</TabsTrigger>
          <TabsTrigger value="succession-plans">Succession Plans</TabsTrigger>
        </TabsList>

        <TabsContent className="mt-6 space-y-4" value="skill-profiles">
          <SectionHeading title="Worker Skill Profile" />
          <DataTable
            columns={profileColumns}
            data={profiles}
            emptyMessage="No skill profile found for this worker."
            isLoading={profileQuery.isLoading}
            keyExtractor={(item) => recordId(item.id) || item.workerId || 'profile'}
          />
        </TabsContent>

        <TabsContent className="mt-6 space-y-4" value="talent-pools">
          <SectionHeading title="Talent Pools" />
          <DataTable
            columns={poolColumns}
            data={pools}
            emptyMessage="No talent pools have been created yet."
            isLoading={poolsQuery.isLoading}
            keyExtractor={(item) => recordId(item.id) || item.poolName || 'pool'}
          />
        </TabsContent>

        <TabsContent className="mt-6 space-y-4" value="career-paths">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SectionHeading title="Career Paths" />
            <Dialog open={careerDialogOpen} onOpenChange={setCareerDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setCareerForm(defaultCareerPathForm())} type="button" variant="outline">Create Career Path</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Career Path</DialogTitle>
                  <DialogDescription>Define a role progression and the first readiness milestone.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="career-title">Path title</Label>
                    <Input id="career-title" value={careerForm.title} onChange={(event) => setCareerForm((current) => ({ ...current, title: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="career-current-role">Current role</Label>
                    <Input id="career-current-role" value={careerForm.currentRole} onChange={(event) => setCareerForm((current) => ({ ...current, currentRole: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="career-target-role">Target role</Label>
                    <Input id="career-target-role" value={careerForm.targetRole} onChange={(event) => setCareerForm((current) => ({ ...current, targetRole: event.target.value }))} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="career-required-skills">Required skills</Label>
                    <Input id="career-required-skills" value={careerForm.requiredSkills} onChange={(event) => setCareerForm((current) => ({ ...current, requiredSkills: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="career-milestone-id">Milestone ID</Label>
                    <Input id="career-milestone-id" value={careerForm.milestoneId} onChange={(event) => setCareerForm((current) => ({ ...current, milestoneId: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="career-milestone-title">Milestone title</Label>
                    <Input id="career-milestone-title" value={careerForm.milestoneTitle} onChange={(event) => setCareerForm((current) => ({ ...current, milestoneTitle: event.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={submitCareerPath} type="button">Save Career Path</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <DataTable
            columns={careerPathColumns}
            data={careerPaths}
            emptyMessage="No career paths have been configured yet."
            isLoading={careerPathsQuery.isLoading}
            keyExtractor={(item) => recordId(item.id) || item.title || 'career-path'}
          />
        </TabsContent>

        <TabsContent className="mt-6 space-y-4" value="succession-plans">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SectionHeading title="Succession Plans" />
            <Dialog open={successionDialogOpen} onOpenChange={setSuccessionDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setSuccessionForm(defaultSuccessionForm(selectedWorkerId || actorId))} type="button" variant="outline">Create Succession Plan</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Succession Plan</DialogTitle>
                  <DialogDescription>Connect a position to an incumbent and successor candidate.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="succession-position-id">Position ID</Label>
                    <Input id="succession-position-id" value={successionForm.positionId} onChange={(event) => setSuccessionForm((current) => ({ ...current, positionId: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="succession-incumbent-id">Incumbent worker ID</Label>
                    <Input id="succession-incumbent-id" value={successionForm.incumbentWorkerId} onChange={(event) => setSuccessionForm((current) => ({ ...current, incumbentWorkerId: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="succession-successor-id">Successor worker ID</Label>
                    <Input id="succession-successor-id" value={successionForm.successorWorkerId} onChange={(event) => setSuccessionForm((current) => ({ ...current, successorWorkerId: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="succession-readiness-level">Readiness level</Label>
                    <Input id="succession-readiness-level" value={successionForm.readinessLevel} onChange={(event) => setSuccessionForm((current) => ({ ...current, readinessLevel: event.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={submitSuccessionPlan} type="button">Save Succession Plan</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <DataTable
            columns={successionColumns}
            data={successionPlans}
            emptyMessage="No succession plans have been created yet."
            isLoading={successionPlansQuery.isLoading}
            keyExtractor={(item) => recordId(item.id) || item.positionId || 'succession-plan'}
          />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Talent Controls</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <p>Skill profiles are validated before they influence readiness and succession decisions.</p>
          <p>Talent pools use tenant lists and worker membership commands for controlled updates.</p>
          <p>Career paths and succession plans keep activation explicit so downstream planning stays auditable.</p>
        </CardContent>
      </Card>
    </div>
  );
}
