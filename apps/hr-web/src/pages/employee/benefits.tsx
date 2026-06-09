
import * as React from 'react';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/common/data-table';
import { AllowedActions } from '@/components/common/allowed-actions';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { useUIStore } from '@/stores/ui-store';
import { formatDate } from '@/lib/utils';
import { Heart, Users, Calendar } from 'lucide-react';
import type { BenefitEnrollment } from '@/types';

interface BenefitProgramOption {
  id: string;
  programName: string;
  programType: string;
  status: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
}

interface BenefitsData {
  enrollments: BenefitEnrollment[];
  activePrograms?: BenefitProgramOption[];
  openEnrollmentActive: boolean;
  openEnrollmentDeadline?: string;
  lifeEvents: Array<{ id: string; type: string; date: string; status: string; description?: string }>;
  dependents: Array<{ id: string; name: string; relationship: string; dateOfBirth: string }>;
}

interface EnrollmentPayload {
  programId: string;
  coverageLevel: string;
  dependents: [];
  effectiveDate: string;
}

interface LifeEventPayload {
  eventType: string;
  eventDate: string;
  description?: string;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readableError(error: unknown) {
  const payload = (error as { response?: { data?: unknown } }).response?.data ?? error;
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return 'The benefits request could not be submitted.';
  const record = payload as Record<string, unknown>;
  const message = record.errorMessage ?? record.message ?? record.error;
  return typeof message === 'string' ? message : 'The benefits request could not be submitted.';
}

export function EmployeeBenefits() {
  const addNotification = useUIStore((s) => s.addNotification);
  const [programId, setProgramId] = React.useState('');
  const [coverageLevel, setCoverageLevel] = React.useState('EMPLOYEE');
  const [effectiveDate, setEffectiveDate] = React.useState(todayKey());
  const [eventType, setEventType] = React.useState('MARRIAGE');
  const [eventDate, setEventDate] = React.useState(todayKey());
  const [eventDescription, setEventDescription] = React.useState('');
  const { data, isLoading, isError, error, refetch } = useApiQuery<BenefitsData>(
    ['employee-benefits'],
    '/employee/benefits'
  );

  React.useEffect(() => {
    const activePrograms = data?.activePrograms ?? [];
    if (!activePrograms.some((program) => program.id === programId)) {
      setProgramId(activePrograms[0]?.id ?? '');
    }
  }, [data?.activePrograms, programId]);

  const enrollmentMutation = useApiMutation<unknown, EnrollmentPayload>(
    '/employee/benefits/enrollments',
    'post',
    [['employee-benefits']],
    {
      onSuccess: () => {
        addNotification({ title: 'Enrollment submitted', message: 'Your benefits enrollment was sent for processing.', type: 'success', read: false });
      },
      onError: (mutationError) => {
        addNotification({ title: 'Could not submit enrollment', message: readableError(mutationError), type: 'error', read: false });
      },
    },
  );

  const lifeEventMutation = useApiMutation<unknown, LifeEventPayload>(
    '/employee/benefits/life-events',
    'post',
    [['employee-benefits']],
    {
      onSuccess: () => {
        setEventDescription('');
        addNotification({ title: 'Life event recorded', message: 'Your benefits life event was sent to HR.', type: 'success', read: false });
      },
      onError: (mutationError) => {
        addNotification({ title: 'Could not record life event', message: readableError(mutationError), type: 'error', read: false });
      },
    },
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
  const activePrograms = data?.activePrograms ?? [];
  const canSubmitEnrollment = Boolean(programId && coverageLevel && effectiveDate) && !enrollmentMutation.isPending;
  const canSubmitLifeEvent = Boolean(eventType && eventDate) && !lifeEventMutation.isPending;

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
        <ErrorState
          title="Could not load benefits"
          error={error}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="fusion-gradient-text text-2xl font-bold flex items-center gap-2">
              <Heart className="h-6 w-6 text-rose-500" />
              Benefits
            </h2>
          </div>
        </div>
        <AllowedActions
          aggregateType="BENEFITS"
        />
      </div>

      {/* Open Enrollment Banner */}
      {data?.openEnrollmentActive && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:bg-green-950/30 dark:border-green-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">Open Enrollment is Active</p>
              <p className="text-sm text-green-700 dark:text-green-300">
                {data.openEnrollmentDeadline ? `Deadline: ${formatDate(data.openEnrollmentDeadline)}` : 'You can submit benefit changes for review.'}
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
            </CardHeader>
            <CardContent className="space-y-5">
              {activePrograms.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_180px_auto] md:items-end">
                    <div className="space-y-2">
                      <Label htmlFor="benefits-program">Plan</Label>
                      <Select value={programId} onValueChange={setProgramId}>
                        <SelectTrigger id="benefits-program">
                          <SelectValue placeholder="Select a plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {activePrograms.map((program) => (
                            <SelectItem key={program.id} value={program.id}>
                              {program.programName} ({program.programType})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="coverage-level">Coverage</Label>
                      <Select value={coverageLevel} onValueChange={setCoverageLevel}>
                        <SelectTrigger id="coverage-level">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EMPLOYEE">Employee</SelectItem>
                          <SelectItem value="EMPLOYEE_SPOUSE">Employee + spouse</SelectItem>
                          <SelectItem value="EMPLOYEE_CHILDREN">Employee + children</SelectItem>
                          <SelectItem value="FAMILY">Family</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="effective-date">Effective date</Label>
                      <Input id="effective-date" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
                    </div>
                    <Button
                      type="button"
                      disabled={!canSubmitEnrollment}
                      onClick={() => enrollmentMutation.mutate({ programId, coverageLevel, dependents: [], effectiveDate })}
                    >
                      {enrollmentMutation.isPending ? 'Submitting...' : 'Submit'}
                    </Button>
                  </div>
                </div>
              )}
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
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 md:grid-cols-[220px_180px_minmax(0,1fr)_auto] md:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="life-event-type">Event</Label>
                    <Select value={eventType} onValueChange={setEventType}>
                      <SelectTrigger id="life-event-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MARRIAGE">Marriage</SelectItem>
                        <SelectItem value="BIRTH_ADOPTION">Birth or adoption</SelectItem>
                        <SelectItem value="LOSS_OF_COVERAGE">Loss of coverage</SelectItem>
                        <SelectItem value="DIVORCE">Divorce</SelectItem>
                        <SelectItem value="DEPENDENT_CHANGE">Dependent change</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="life-event-date">Date</Label>
                    <Input id="life-event-date" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="life-event-description">Note</Label>
                    <Input id="life-event-description" value={eventDescription} onChange={(event) => setEventDescription(event.target.value)} placeholder="Optional note" />
                  </div>
                  <Button
                    type="button"
                    disabled={!canSubmitLifeEvent}
                    onClick={() => lifeEventMutation.mutate({ eventType, eventDate, description: eventDescription.trim() || undefined })}
                  >
                    {lifeEventMutation.isPending ? 'Recording...' : 'Record'}
                  </Button>
                </div>
              </div>
              {data?.lifeEvents && data.lifeEvents.length > 0 ? (
                <div className="space-y-3">
                  {data.lifeEvents.map((event) => (
                    <div key={event.id} className="fusion-glass fusion-hover flex items-center justify-between rounded-2xl p-3">
                      <div>
                        <p className="text-sm font-medium">{event.type}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(event.date)}</p>
                      </div>
                      <Badge variant="outline">{event.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Calendar}
                  title="No life events recorded"
                  description="Qualifying life events and status changes will appear here."
                />
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
            </CardHeader>
            <CardContent>
              {data?.dependents && data.dependents.length > 0 ? (
                <div className="space-y-3">
                  {data.dependents.map((dep) => (
                    <div key={dep.id} className="fusion-glass fusion-hover flex items-center justify-between rounded-2xl p-3">
                      <div>
                        <p className="text-sm font-medium">{dep.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {dep.relationship} - Born {formatDate(dep.dateOfBirth)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Users}
                  title="No dependents on file"
                  description="Dependents covered under your benefits will appear here."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
