
import { useSearchParams } from 'react-router-dom';
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/common/data-table';

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

  const { data, isLoading } = useApiQuery<ManagerTeamData>(
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
              <h2 className="text-2xl font-bold">{member.firstName} {member.lastName}</h2>
              <p className="text-muted-foreground">{member.jobTitle} • {member.departmentName}</p>
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Employment Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Employee ID</p>
                  <p className="text-sm font-medium">{member.employeeId}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Hire Date</p>
                  <p className="text-sm font-medium">{formatDate(member.hireDate)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={member.status === 'ACTIVE' ? 'default' : 'secondary'}>{member.status}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Department</p>
                  <p className="text-sm font-medium">{member.departmentName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Manager</p>
                  <p className="text-sm font-medium">{member.managerName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Legal Entity</p>
                  <p className="text-sm font-medium">{member.legalEntityName}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-xs text-muted-foreground">Latest Rating</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-2xl font-bold">{member.performanceRating ?? 'N/A'}</span>
                      {member.lastReviewDate && (
                        <span className="text-xs text-muted-foreground">
                          ({formatDate(member.lastReviewDate)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-xs text-muted-foreground">Open Goals</p>
                    <p className="text-2xl font-bold">{member.goals.filter((g) => g.status === 'OPEN').length}</p>
                  </div>
                </div>

                {member.goals.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Goals</h4>
                    {member.goals.map((goal) => (
                      <div key={goal.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{goal.title}</span>
                          <Badge variant="outline">{goal.status}</Badge>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{goal.progress}% complete</p>
                      </div>
                    ))}
                  </div>
                )}

                <AllowedActions
                  aggregateType="PERFORMANCE"
                  aggregateId={member.id}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compensation">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Compensation
                </CardTitle>
                <CardDescription>Compensation band and recommendations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-xs text-muted-foreground">Compensation Band</p>
                  <p className="text-lg font-medium">{member.compensationBand || 'Not set'}</p>
                </div>
                <AllowedActions
                  aggregateType="COMPENSATION"
                  aggregateId={member.id}
                />
              </CardContent>
            </Card>
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
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Team
          </h2>
          <p className="text-muted-foreground">Manage your direct reports</p>
        </div>
        <AllowedActions
          aggregateType="TEAM"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Direct Reports</CardTitle>
          <CardDescription>Click on a team member to view details</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={reportColumns}
            data={data?.directReports ?? []}
            keyExtractor={(row) => row.id}
            emptyMessage="No direct reports found"
          />
        </CardContent>
      </Card>
    </div>
  );
}
