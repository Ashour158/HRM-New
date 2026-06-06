
import { useSearchParams } from 'react-router-dom';
import { useApiQuery } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/common/data-table';
import { ErrorState } from '@/components/common/error-state';

import { AllowedActions } from '@/components/common/allowed-actions';
import { formatDate } from '@/lib/utils';
import { Users, Star, DollarSign } from 'lucide-react';
import type { Worker } from '@/types';

interface TeamMemberDetail extends Worker {
  performanceRating?: number;
  compensationBand?: string;
  lastReviewDate?: string;
  goals: Array<{ id: string; title: string; status: string; progress: number }>;
}

interface ManagerTeamData {
  directReports: Worker[];
  selectedMember?: TeamMemberDetail;
}

/**
 * Team management page with direct reports list and individual profile view.
 */
export function ManagerTeam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedWorkerId = searchParams.get('worker');

  const { data, isLoading, isError, error, refetch } = useApiQuery<ManagerTeamData>(
    ['manager-team', selectedWorkerId],
    `/manager/team${selectedWorkerId ? `?workerId=${selectedWorkerId}` : ''}`
  );

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
    { key: 'jobTitle', header: 'Job Title', cell: (row: Worker) => row.jobTitle || '-' },
    { key: 'department', header: 'Department', cell: (row: Worker) => row.departmentName || '-' },
    {
      key: 'status',
      header: 'Status',
      cell: (row: Worker) => (
        <Badge variant={row.status === 'ACTIVE' ? 'default' : 'secondary'}>{row.status}</Badge>
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
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setSearchParams({})}>
              ← Back to Team
            </Button>
            <div>
              <h1 className="font-headline text-2xl font-extrabold tracking-tight md:text-3xl">
                <span className="fusion-gradient-text">{member.firstName} {member.lastName}</span>
              </h1>
              <p className="text-slate-500">{member.jobTitle} • {member.departmentName}</p>
            </div>
          </div>
          <AllowedActions
            aggregateType="WORKER"
            aggregateId={member.id}
            context={{ managerView: true }}
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
                  <p className="text-sm font-medium">{formatDate(member.hireDate)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Status</p>
                  <Badge variant={member.status === 'ACTIVE' ? 'default' : 'secondary'}>{member.status}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Department</p>
                  <p className="text-sm font-medium">{member.departmentName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Manager</p>
                  <p className="text-sm font-medium">{member.managerName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Legal Entity</p>
                  <p className="text-sm font-medium">{member.legalEntityName}</p>
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
                    <p className="text-xs text-slate-500">Latest Rating</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-2xl font-bold">{member.performanceRating ?? 'N/A'}</span>
                      {member.lastReviewDate && (
                        <span className="text-xs text-slate-500">
                          ({formatDate(member.lastReviewDate)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="fusion-glass rounded-2xl p-4">
                    <p className="text-xs text-slate-500">Open Goals</p>
                    <p className="text-2xl font-bold">{member.goals.filter((g) => g.status === 'OPEN').length}</p>
                  </div>
                </div>

                {member.goals.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Goals</h4>
                    {member.goals.map((goal) => (
                      <div key={goal.id} className="fusion-glass rounded-2xl p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{goal.title}</span>
                          <Badge variant="outline">{goal.status}</Badge>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-[#e0e7ff]">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{goal.progress}% complete</p>
                      </div>
                    ))}
                  </div>
                )}

                <AllowedActions
                  aggregateType="PERFORMANCE"
                  aggregateId={member.id}
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
              <p className="text-sm text-slate-500">Compensation band and recommendations</p>
              <div className="mt-4 space-y-4">
                <div className="fusion-glass rounded-2xl p-4">
                  <p className="text-xs text-slate-500">Compensation Band</p>
                  <p className="text-lg font-medium">{member.compensationBand || 'Not set'}</p>
                </div>
                <AllowedActions
                  aggregateType="COMPENSATION"
                  aggregateId={member.id}
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
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/60 py-1 pl-2 pr-3 text-xs font-bold text-slate-600 backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="fusion-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Team workspace · live
          </div>
          <h1 className="flex items-center gap-3 font-headline text-3xl font-extrabold tracking-tight md:text-4xl">
            <Users className="h-7 w-7 text-indigo-500" />
            <span className="fusion-gradient-text">Team</span>
          </h1>
          <p className="mt-1 text-slate-500">Manage your direct reports</p>
        </div>
        <AllowedActions
          aggregateType="TEAM"
        />
      </div>

      <div className="fusion-glass rounded-[2rem] p-6">
        <div className="mb-1 text-lg font-bold">Direct Reports</div>
        <p className="mb-4 text-sm text-slate-500">Click on a team member to view details</p>
        <DataTable
          columns={reportColumns}
          data={data?.directReports ?? []}
          keyExtractor={(row) => row.id}
          emptyMessage="No direct reports found"
        />
      </div>
    </div>
  );
}
