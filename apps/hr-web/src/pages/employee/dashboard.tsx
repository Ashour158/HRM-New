
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AllowedActions } from '@/components/common/allowed-actions';
import {
  Calendar,
  FileText,
  GraduationCap,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { AbsenceRequest } from '@/types';

interface DashboardData {
  upcomingEvents: Array<{ id: string; title: string; date: string; type: string }>;
  pendingTasks: Array<{ id: string; title: string; dueDate: string; priority: string }>;
  recentActivity: Array<{ id: string; description: string; timestamp: string }>;
  absenceBalance: Array<{ type: string; balance: number; unit: string }>;
}

/**
 * Employee dashboard with welcome card, quick actions, and activity feed.
 */
export function EmployeeDashboard() {
  const { user } = useAuth();

  const { data, isLoading } = useApiQuery<DashboardData>(
    ['employee-dashboard'],
    '/employee/dashboard'
  );

  const { data: absences } = useApiQuery<AbsenceRequest[]>(
    ['employee-absences'],
    '/employee/absences'
  );

  const pendingAbsences = absences?.filter((a) => a.status === 'PENDING') ?? [];

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back, {user?.firstName}!</CardTitle>
          <CardDescription>
            Here's what's happening with your HR profile today.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AllowedActions
            aggregateType="EMPLOYEE_DASHBOARD"
            onAction={(action) => console.log('Action:', action)}
          />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/employee/time-off">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Submit Absence</p>
                  <p className="text-xs text-muted-foreground">Request time off</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/employee/payslip">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-green-500/10 p-3">
                  <FileText className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">View Payslip</p>
                  <p className="text-xs text-muted-foreground">Latest pay period</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/employee/benefits">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-purple-500/10 p-3">
                  <GraduationCap className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Start Learning</p>
                  <p className="text-xs text-muted-foreground">Training courses</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/employee/profile">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-orange-500/10 p-3">
                  <TrendingUp className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Submit Goals</p>
                  <p className="text-xs text-muted-foreground">Performance goals</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : data?.upcomingEvents && data.upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {data.upcomingEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{event.date}</p>
                    </div>
                    <Badge variant="outline">{event.type}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming events</p>
            )}
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Pending Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : pendingAbsences.length > 0 ? (
              <div className="space-y-3">
                {pendingAbsences.map((absence) => (
                  <div key={absence.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{absence.type} Request</p>
                      <p className="text-xs text-muted-foreground">
                        {absence.startDate} - {absence.endDate}
                      </p>
                    </div>
                    <Badge variant="secondary">Pending</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                All caught up!
              </div>
            )}
          </CardContent>
        </Card>

        {/* Absence Balance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Time Off Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : data?.absenceBalance && data.absenceBalance.length > 0 ? (
              <div className="space-y-3">
                {data.absenceBalance.map((bal, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm">{bal.type}</span>
                    <span className="text-sm font-medium">
                      {bal.balance} {bal.unit}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No balance data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : data?.recentActivity && data.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {data.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
