
import { Link } from 'react-router-dom';
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/common/data-table';
import { formatDate } from '@/lib/utils';
import { Users, CheckCircle2, Eye, TrendingUp, AlertCircle } from 'lucide-react';
import type { AbsenceRequest, Worker } from '@/types';

interface ManagerDashboardData {
  directReports: Worker[];
  pendingApprovals: {
    absences: AbsenceRequest[];
    timesheets: number;
    expenses: number;
  };
  teamMetrics: {
    headcount: number;
    averagePerformance: number;
    openGoals: number;
  };
}

/**
 * Manager dashboard with team overview, pending approvals, and quick actions.
 */
export function ManagerDashboard() {
  const { data, isLoading } = useApiQuery<ManagerDashboardData>(
    ['manager-dashboard'],
    '/manager/dashboard'
  );

  const absenceColumns = [
    { key: 'employee', header: 'Employee', cell: (row: AbsenceRequest) => row.workerId },
    { key: 'type', header: 'Type', cell: (row: AbsenceRequest) => row.type },
    {
      key: 'dates',
      header: 'Dates',
      cell: (row: AbsenceRequest) => (
        <span>
          {formatDate(row.startDate)} - {formatDate(row.endDate)}
        </span>
      ),
    },
    { key: 'reason', header: 'Reason', cell: (row: AbsenceRequest) => row.reason || '-' },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row: AbsenceRequest) => (
        <Button variant="outline" size="sm" asChild>
          <Link to={`/manager/approvals?requestId=${row.id}`}>Review</Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          Manager Dashboard
        </h2>
        <p className="text-muted-foreground">Overview of your team and pending actions</p>
      </div>

      {/* Team Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Direct Reports</p>
                <p className="text-2xl font-bold">{data?.teamMetrics.headcount ?? 0}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approvals</p>
                <p className="text-2xl font-bold">
                  {(data?.pendingApprovals.absences.length ?? 0) +
                    (data?.pendingApprovals.timesheets ?? 0) +
                    (data?.pendingApprovals.expenses ?? 0)}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Performance</p>
                <p className="text-2xl font-bold">{data?.teamMetrics.averagePerformance ?? 0}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Goals</p>
                <p className="text-2xl font-bold">{data?.teamMetrics.openGoals ?? 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Leave */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Pending Leave</CardTitle>
                <CardDescription>Leave requests awaiting your approval</CardDescription>
              </div>
              <Badge variant="secondary">{data?.pendingApprovals.absences.length ?? 0}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : data?.pendingApprovals.absences && data.pendingApprovals.absences.length > 0 ? (
              <DataTable
                columns={absenceColumns}
                data={data.pendingApprovals.absences}
                keyExtractor={(row) => row.id}
                emptyMessage="No pending leave requests"
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                All leave requests reviewed
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <CardDescription>Common manager actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/manager/team">
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                View Team
              </Button>
            </Link>
            <Link to="/manager/approvals">
              <Button variant="outline" className="w-full justify-start">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Review Approvals
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Team Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Overview</CardTitle>
          <CardDescription>Your direct reports</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : data?.directReports && data.directReports.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.directReports.map((report) => (
                <div key={report.id} className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">
                        {report.firstName.charAt(0)}{report.lastName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{report.firstName} {report.lastName}</p>
                      <p className="text-xs text-muted-foreground">{report.jobTitle}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/manager/team?worker=${report.id}`}>
                        <Eye className="mr-1 h-3 w-3" />
                        View
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No direct reports found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
