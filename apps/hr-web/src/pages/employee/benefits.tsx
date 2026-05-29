
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/common/data-table';
import { AllowedActions } from '@/components/common/allowed-actions';
import { formatDate } from '@/lib/utils';
import { Heart, Users, Calendar } from 'lucide-react';
import type { BenefitEnrollment } from '@/types';

interface BenefitsData {
  enrollments: BenefitEnrollment[];
  openEnrollmentActive: boolean;
  openEnrollmentDeadline?: string;
  lifeEvents: Array<{ id: string; type: string; date: string; status: string }>;
  dependents: Array<{ id: string; name: string; relationship: string; dateOfBirth: string }>;
}

/**
 * Benefits enrollment page with current enrollments, open enrollment, life events, and dependents.
 */
export function EmployeeBenefits() {
  const { data, isLoading } = useApiQuery<BenefitsData>(
    ['employee-benefits'],
    '/employee/benefits'
  );

  const enrollmentColumns = [
    { key: 'type', header: 'Type', cell: (row: BenefitEnrollment) => row.benefitType },
    { key: 'plan', header: 'Plan', cell: (row: BenefitEnrollment) => row.planName },
    { key: 'coverage', header: 'Coverage', cell: (row: BenefitEnrollment) => row.coverageLevel },
    {
      key: 'effective',
      header: 'Effective Date',
      cell: (row: BenefitEnrollment) => formatDate(row.effectiveDate),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: BenefitEnrollment) => (
        <Badge variant={row.status === 'ACTIVE' ? 'default' : 'secondary'}>{row.status}</Badge>
      ),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-500" />
            Benefits
          </h2>
          <p className="text-muted-foreground">Manage your benefit enrollments and dependents</p>
        </div>
        <AllowedActions
          aggregateType="BENEFITS"
          onAction={(action) => console.log('Action:', action)}
        />
      </div>

      {/* Open Enrollment Banner */}
      {data?.openEnrollmentActive && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:bg-green-950/30 dark:border-green-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">Open Enrollment is Active</p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Deadline: {formatDate(data.openEnrollmentDeadline)}
              </p>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="enrollments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="enrollments">Current Enrollments</TabsTrigger>
          <TabsTrigger value="life-events">Life Events</TabsTrigger>
          <TabsTrigger value="dependents">Dependents</TabsTrigger>
        </TabsList>

        <TabsContent value="enrollments">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Enrollments</CardTitle>
              <CardDescription>Your active benefit enrollments</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={enrollmentColumns}
                data={data?.enrollments ?? []}
                keyExtractor={(row) => row.id}
                emptyMessage="No active enrollments"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="life-events">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Life Events
              </CardTitle>
              <CardDescription>Qualifying life events and status changes</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.lifeEvents && data.lifeEvents.length > 0 ? (
                <div className="space-y-3">
                  {data.lifeEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{event.type}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(event.date)}</p>
                      </div>
                      <Badge variant="outline">{event.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No life events recorded</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dependents">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Dependents
              </CardTitle>
              <CardDescription>Your covered dependents</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.dependents && data.dependents.length > 0 ? (
                <div className="space-y-3">
                  {data.dependents.map((dep) => (
                    <div key={dep.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{dep.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {dep.relationship} • Born {formatDate(dep.dateOfBirth)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No dependents on file</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
