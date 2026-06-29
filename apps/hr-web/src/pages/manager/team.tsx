import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApiQuery } from '@/hooks/use-api';
import { useTenant } from '@/hooks/use-tenant';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChartPanel, type ChartDatum } from '@/components/ui/charts';
import { DataTable } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';

import { AllowedActions } from '@/components/common/allowed-actions';
import { formatDate } from '@/lib/utils';
import {
  ArrowLeft,
  Users,
  Star,
  DollarSign,
  MessageSquare,
  Target,
  TrendingUp,
  BrainCircuit,
} from 'lucide-react';
import type { Worker } from '@/types';

interface TeamMemberPerformanceImpact {
  actionPlan?: {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    checkInCadence?: string;
    recommendedActions?: string[];
    currentPerformance?: {
      latestRating: number | null;
      averageGoalProgress: number;
      peerAverageRating: number | null;
      activeGoalCount: number;
      openDevelopmentPlan: boolean;
    };
  };
  feedbackSummary?: {
    averageRating: number | null;
    responseCount: number;
    anonymousResponseCount: number;
    conciseFeedback: string;
  };
  nineBox?: {
    performanceScore: number;
    potentialScore: number;
    box: string;
  };
}

interface TeamMemberDetail extends Worker {
  performanceRating?: number;
  compensationBand?: string;
  lastReviewDate?: string;
  goals: Array<{ id: string; title: string; status: string; progress: number }>;
  performanceImpact?: TeamMemberPerformanceImpact;
}

interface ManagerTeamData {
  directReports: Worker[];
  selectedMember?: TeamMemberDetail;
}

interface TeamAttritionRiskSnapshot {
  id: string;
  workerId: string;
  periodKey: string;
  score: number;
  band: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: Array<{ factor: string; weight: number; detail: string }>;
}

type TeamAttritionRiskResponse =
  | TeamAttritionRiskSnapshot[]
  | { data?: TeamAttritionRiskSnapshot[] };

function formatLabel(value?: string) {
  if (!value) return 'Not assigned';
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatScore(
  value: number | null | undefined,
  suffix = '',
  emptyLabel = 'Not available',
) {
  return value === null || value === undefined || Number.isNaN(value)
    ? emptyLabel
    : `${Math.round(value * 10) / 10}${suffix}`;
}

function isOpenGoal(status: string) {
  return ['OPEN', 'DRAFT', 'ACTIVE', 'IN_PROGRESS'].includes(status);
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function performanceRiskVariant(
  riskLevel?: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (riskLevel === 'HIGH') return 'destructive';
  if (riskLevel === 'MEDIUM') return 'secondary';
  if (riskLevel === 'LOW') return 'default';
  return 'outline';
}

function performanceRiskLabel(riskLevel?: string) {
  if (riskLevel === 'HIGH') return 'High attention';
  if (riskLevel === 'MEDIUM') return 'Medium attention';
  if (riskLevel === 'LOW') return 'On track';
  return 'No attention flag';
}

function workerStatusVariant(
  status?: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'ACTIVE') return 'default';
  if (status === 'TERMINATED' || status === 'INACTIVE') return 'destructive';
  if (status) return 'secondary';
  return 'outline';
}

function insightTone(band: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (band === 'HIGH') return 'destructive';
  if (band === 'MEDIUM') return 'secondary';
  if (band === 'LOW') return 'default';
  return 'outline';
}

function teamRiskDistribution(rows: TeamAttritionRiskSnapshot[]): ChartDatum[] {
  const counts = rows.reduce<Record<'LOW' | 'MEDIUM' | 'HIGH', number>>((acc, row) => {
    acc[row.band] += 1;
    return acc;
  }, { LOW: 0, MEDIUM: 0, HIGH: 0 });
  return [
    { label: 'Low', value: counts.LOW },
    { label: 'Medium', value: counts.MEDIUM },
    { label: 'High', value: counts.HIGH },
  ];
}

function attritionRiskRowsFromResponse(
  response: TeamAttritionRiskResponse | undefined,
): TeamAttritionRiskSnapshot[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

/**
 * Team management page with direct reports list and individual profile view.
 */
export function ManagerTeam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedWorkerId = searchParams.get('worker');
  const { tenantId } = useTenant();

  const { data, isLoading, isError, error, refetch } =
    useApiQuery<ManagerTeamData>(
      ['manager-team', selectedWorkerId],
      `/manager/team${selectedWorkerId ? `?workerId=${selectedWorkerId}` : ''}`,
    );
  const { data: attritionRiskRaw } = useApiQuery<TeamAttritionRiskResponse>(
    ['manager-team-attrition-risk', tenantId],
    `/intelligence/attrition-risk/tenant/${tenantId}`,
    { enabled: Boolean(tenantId) },
  );
  const directReports = React.useMemo(() => data?.directReports ?? [], [data?.directReports]);
  const attritionRiskRows = React.useMemo(
    () => attritionRiskRowsFromResponse(attritionRiskRaw),
    [attritionRiskRaw],
  );
  const teamRiskRows = React.useMemo(() => {
    const reportIds = new Set(directReports.map((worker) => worker.id));
    return attritionRiskRows.filter((row) => reportIds.has(row.workerId));
  }, [attritionRiskRows, directReports]);
  const riskChart = React.useMemo(() => teamRiskDistribution(teamRiskRows), [teamRiskRows]);

  const reportColumns = [
    {
      key: 'name',
      header: 'Name',
      cell: (row: Worker) => (
        <button
          className="text-sm font-medium text-primary hover:underline text-left"
          onClick={() => setSearchParams({ worker: row.id })}
        >
          {row.firstName} {row.lastName}
        </button>
      ),
    },
    {
      key: 'jobTitle',
      header: 'Job Title',
      cell: (row: Worker) => row.jobTitle || 'Not assigned',
    },
    {
      key: 'department',
      header: 'Department',
      cell: (row: Worker) => row.departmentName || 'Not assigned',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: Worker) => (
        <Badge variant={workerStatusVariant(row.status)}>
          {formatLabel(row.status)}
        </Badge>
      ),
    },
    {
      key: 'hireDate',
      header: 'Hire Date',
      cell: (row: Worker) => formatDate(row.hireDate),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  // Show individual member detail if selected
  if (selectedWorkerId && data?.selectedMember) {
    const member = data.selectedMember;
    const performanceImpact = member.performanceImpact;
    const actionPlan = performanceImpact?.actionPlan;
    const feedbackSummary = performanceImpact?.feedbackSummary;
    const openGoalCount = member.goals.filter((goal) =>
      isOpenGoal(goal.status),
    ).length;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchParams({})}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to team
            </Button>
            <div>
              <h1 className="font-headline text-2xl font-extrabold tracking-tight md:text-3xl">
                <span className="fusion-gradient-text">
                  {member.firstName} {member.lastName}
                </span>
              </h1>
              <p className="text-slate-500">
                {member.jobTitle || 'Role not assigned'} -{' '}
                {member.departmentName || 'Department not assigned'}
              </p>
            </div>
          </div>
          <AllowedActions
            aggregateType="WORKER"
            aggregateId={member.id}
            context={{ managerView: true }}
            readOnlyReason="This team action is available when the request flow is connected for managers."
          />
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="compensation">Compensation</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="fusion-glass rounded-[2rem] p-6">
              <div className="mb-4 text-lg font-bold">Employment Details</div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Employee ID</p>
                  <p className="text-sm font-medium">{member.employeeId}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Hire Date</p>
                  <p className="text-sm font-medium">
                    {formatDate(member.hireDate)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Status</p>
                  <Badge variant={workerStatusVariant(member.status)}>
                    {formatLabel(member.status)}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Department</p>
                  <p className="text-sm font-medium">
                    {member.departmentName || 'Not assigned'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Manager</p>
                  <p className="text-sm font-medium">
                    {member.managerName || 'Not assigned'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Legal Entity</p>
                  <p className="text-sm font-medium">
                    {member.legalEntityName || 'Not assigned'}
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="performance">
            <div className="fusion-glass rounded-[2rem] p-6">
              <div className="mb-4 flex items-center gap-2 text-lg font-bold">
                <Star className="h-5 w-5 text-amber-500" />
                Performance
              </div>
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="fusion-glass rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <TrendingUp className="h-4 w-4" />
                      Latest Rating
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-2xl font-bold">
                        {formatScore(member.performanceRating, '', 'Not rated')}
                      </span>
                      {member.lastReviewDate && (
                        <span className="text-xs text-slate-500">
                          ({formatDate(member.lastReviewDate)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="fusion-glass rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Target className="h-4 w-4" />
                      Open Goals
                    </div>
                    <p className="mt-1 text-2xl font-bold">{openGoalCount}</p>
                  </div>
                  <div className="fusion-glass rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <MessageSquare className="h-4 w-4" />
                      360 feedback
                    </div>
                    <p className="mt-1 text-2xl font-bold">
                      {formatScore(
                        feedbackSummary?.averageRating ??
                          actionPlan?.currentPerformance?.peerAverageRating,
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {feedbackSummary?.responseCount ?? 0} responses
                    </p>
                  </div>
                  <div className="fusion-glass rounded-2xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">Support plan</p>
                      <Badge
                        variant={performanceRiskVariant(actionPlan?.riskLevel)}
                      >
                        {performanceRiskLabel(actionPlan?.riskLevel)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-800">
                      {actionPlan?.checkInCadence ??
                        'No check-in rhythm set yet.'}
                    </p>
                  </div>
                </div>

                {performanceImpact && (
                  <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
                    <div className="fusion-glass rounded-2xl p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        360 feedback summary
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {feedbackSummary?.conciseFeedback ??
                          'No submitted 360 feedback summary yet.'}
                      </p>
                    </div>
                    <div className="fusion-glass rounded-2xl p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {performanceImpact.nineBox?.box ??
                          'Talent grid pending'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {performanceImpact.nineBox?.performanceScore ===
                        undefined
                          ? 'No performance score yet'
                          : `${formatScore(performanceImpact.nineBox.performanceScore, '%')} performance`}
                      </p>
                      <p className="mt-4 text-xs font-medium uppercase text-slate-500">
                        Next focus
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {actionPlan?.recommendedActions?.[0] ??
                          'Keep regular check-ins on active goals.'}
                      </p>
                    </div>
                  </div>
                )}

                {!performanceImpact && (
                  <EmptyState
                    icon={Star}
                    title="No performance summary yet"
                    description="Reviews, 360 feedback, and talent grid context will appear after the active cycle has data."
                  />
                )}

                {member.goals.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Goals</h4>
                    {member.goals.map((goal) => (
                      <div
                        key={goal.id}
                        className="fusion-glass rounded-2xl p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {goal.title}
                          </span>
                          <Badge variant="outline">
                            {formatLabel(goal.status)}
                          </Badge>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-accent">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${clampPercent(goal.progress)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {clampPercent(goal.progress)}% complete
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Target}
                    title="No goals on this profile yet"
                    description="Assigned goals and progress will appear here when the current cycle is ready."
                  />
                )}

                <AllowedActions
                  aggregateType="PERFORMANCE"
                  aggregateId={member.id}
                  readOnlyReason="Performance actions will appear when the review workflow is ready for this team member."
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="compensation">
            <div className="fusion-glass rounded-[2rem] p-6">
              <div className="flex items-center gap-2 text-lg font-bold">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                Compensation
              </div>
              <p className="text-sm text-slate-500">
                Compensation band and recommendations
              </p>
              <div className="mt-4 space-y-4">
                <div className="fusion-glass rounded-2xl p-4">
                  <p className="text-xs text-slate-500">Compensation Band</p>
                  <p className="text-lg font-medium">
                    {member.compensationBand || 'Not assigned yet'}
                  </p>
                </div>
                <AllowedActions
                  aggregateType="COMPENSATION"
                  aggregateId={member.id}
                  readOnlyReason="Compensation actions will appear when a review flow is available for this team member."
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Show team list
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 font-headline text-3xl font-extrabold tracking-tight md:text-4xl">
            <Users className="h-7 w-7 text-indigo-500" />
            <span className="fusion-gradient-text">Team</span>
          </h1>
          <p className="mt-1 text-slate-500">
            Review direct reports, performance context, and next actions.
          </p>
        </div>
        <AllowedActions
          aggregateType="TEAM"
          readOnlyReason="Team actions will appear when a manager request flow is available."
        />
      </div>

      <div className="fusion-glass rounded-[2rem] p-6">
        <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_24rem]">
          <Card className="bg-white/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-indigo-500" />
                Team attrition signals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teamRiskRows.length === 0 ? (
                <p className="text-sm text-slate-500">No scored team signals yet.</p>
              ) : (
                <div className="space-y-3">
                  {teamRiskRows.slice(0, 3).map((risk) => {
                    const worker = directReports.find((report) => report.id === risk.workerId);
                    const topFactor = [...risk.factors].sort((a, b) => b.weight - a.weight)[0];
                    return (
                      <div key={risk.id} className="rounded-2xl border border-white/60 bg-white/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {worker ? `${worker.firstName} ${worker.lastName}` : risk.workerId}
                            </p>
                            <p className="text-xs text-slate-500">{topFactor?.detail ?? risk.periodKey}</p>
                          </div>
                          <Badge variant={insightTone(risk.band)}>
                            {risk.band} {Math.round(risk.score * 100)}%
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          <BarChartPanel title="Team risk bands" data={riskChart} height={220} />
        </div>
        <div className="mb-1 text-lg font-bold">Direct Reports</div>
        <p className="mb-4 text-sm text-slate-500">
          Select a team member to review profile, performance, and compensation
          context.
        </p>
        {(data?.directReports ?? []).length > 0 ? (
          <DataTable
            columns={reportColumns}
            data={directReports}
            keyExtractor={(row) => row.id}
            emptyMessage="No direct reports assigned"
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No direct reports assigned"
            description="When your reporting line is updated, team members will appear here."
          />
        )}
      </div>
    </div>
  );
}
