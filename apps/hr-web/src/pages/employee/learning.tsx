import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, BookOpen, CheckCircle2, GraduationCap, PlayCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useUIStore } from '@/stores/ui-store';
import { BusinessMetric, BusinessPageHeader } from '@/components/common/business-page';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ApiEnvelope<T> = { success?: boolean; data?: T };
type IdValue = string | { value?: string } | undefined | null;

interface LearningAssignment {
  id?: IdValue;
  workerId?: string;
  courseId?: IdValue;
  courseTitle?: string;
  title?: string;
  status?: string;
  dueDate?: string;
  score?: number | null;
}

interface Certification {
  id?: IdValue;
  certificationName?: string;
  issuingBody?: string;
  status?: string;
  expiryDate?: string;
  credentialId?: string;
}

function unwrap<T>(response: { data?: ApiEnvelope<T> | T }): T {
  const body = response.data as ApiEnvelope<T> | T;
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as ApiEnvelope<T>).data as T;
  }
  return body as T;
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function recordId(value: IdValue): string {
  if (!value) return '';
  return typeof value === 'string' ? value : value.value ?? '';
}

function mutationError(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed.';
}

function formatDate(value?: string) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function badgeVariant(status?: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  const normalized = (status ?? '').toUpperCase();
  if (['ACTIVE', 'COMPLETED', 'CERTIFIED'].includes(normalized)) return 'default';
  if (['IN_PROGRESS', 'STARTED', 'ASSIGNED', 'PENDING'].includes(normalized)) return 'secondary';
  if (['EXPIRED', 'CANCELLED', 'REVOKED'].includes(normalized)) return 'destructive';
  return 'outline';
}

function courseName(assignment: LearningAssignment) {
  return assignment.courseTitle ?? assignment.title ?? `Course ${recordId(assignment.courseId) || 'assignment'}`;
}

export function EmployeeLearning() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const addNotification = useUIStore((state) => state.addNotification);
  const workerId = (user as { workerId?: string } | null | undefined)?.workerId ?? user?.id ?? '';

  const assignmentsQuery = useQuery({
    queryKey: ['employee-learning-assignments', workerId],
    enabled: Boolean(workerId),
    queryFn: async () => list<LearningAssignment>(unwrap(await apiClient.get(`/learning/assignments/worker/${workerId}`))),
  });

  const certificationsQuery = useQuery({
    queryKey: ['employee-learning-certifications', workerId],
    enabled: Boolean(workerId),
    queryFn: async () => list<Certification>(unwrap(await apiClient.get(`/learning/certifications/worker/${workerId}`))),
  });

  const invalidateLearning = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['employee-learning-assignments'] });
    void queryClient.invalidateQueries({ queryKey: ['employee-learning-certifications'] });
  }, [queryClient]);

  const commandMutation = useMutation({
    mutationFn: async ({ path, body }: { path: string; body?: Record<string, unknown> }) => apiClient.post(path, body ?? {}),
    onSuccess: () => {
      addNotification({ title: 'Learning updated', message: 'Your learning record has been updated.', type: 'success', read: false });
      invalidateLearning();
    },
    onError: (error) => addNotification({ title: 'Learning action failed', message: mutationError(error), type: 'error', read: false }),
  });

  const assignments = assignmentsQuery.data ?? [];
  const certifications = certificationsQuery.data ?? [];
  const completedAssignments = assignments.filter((assignment) => (assignment.status ?? '').toUpperCase() === 'COMPLETED').length;
  const activeCertifications = certifications.filter((certification) => (certification.status ?? '').toUpperCase() === 'ACTIVE').length;

  const assignmentColumns = React.useMemo<DataTableColumn<LearningAssignment>[]>(() => [
    {
      key: 'course',
      header: 'Course',
      cell: (assignment) => (
        <div>
          <p className="font-semibold text-foreground">{courseName(assignment)}</p>
          <p className="text-xs text-muted-foreground">Due {formatDate(assignment.dueDate)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (assignment) => <Badge variant={badgeVariant(assignment.status)}>{assignment.status ?? 'ASSIGNED'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (assignment) => {
        const id = recordId(assignment.id);
        const name = courseName(assignment);
        const status = (assignment.status ?? '').toUpperCase();
        const startDisabled = !id || commandMutation.isPending || ['IN_PROGRESS', 'STARTED', 'COMPLETED', 'EXPIRED', 'CANCELLED'].includes(status);
        const completeDisabled = !id || commandMutation.isPending || ['COMPLETED', 'EXPIRED', 'CANCELLED'].includes(status);
        return (
          <div className="flex flex-wrap gap-2">
            <Button
              aria-label={`Start ${name}`}
              disabled={startDisabled}
              onClick={() => commandMutation.mutate({ path: `/learning/assignments/${id}/commands/start` })}
              size="sm"
              type="button"
              variant="outline"
            >
              <PlayCircle className="mr-1 h-4 w-4" />
              Start
            </Button>
            <Button
              aria-label={`Complete ${name}`}
              disabled={completeDisabled}
              onClick={() => commandMutation.mutate({ path: `/learning/assignments/${id}/commands/complete`, body: { score: assignment.score ?? 100 } })}
              size="sm"
              type="button"
              variant="outline"
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />
              Complete
            </Button>
          </div>
        );
      },
    },
  ], [commandMutation]);

  const certificationColumns = React.useMemo<DataTableColumn<Certification>[]>(() => [
    {
      key: 'certification',
      header: 'Certification',
      cell: (certification) => (
        <div>
          <p className="font-semibold text-foreground">{certification.certificationName ?? 'Certification'}</p>
          <p className="text-xs text-muted-foreground">{certification.issuingBody ?? certification.credentialId ?? 'Issuer not set'}</p>
        </div>
      ),
    },
    { key: 'expiry', header: 'Expires', cell: (certification) => formatDate(certification.expiryDate) },
    { key: 'status', header: 'Status', cell: (certification) => <Badge variant={badgeVariant(certification.status)}>{certification.status ?? 'ACTIVE'}</Badge> },
  ], []);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-6 lg:p-8">
      <BusinessPageHeader
        eyebrow="Employee Learning"
        icon={GraduationCap}
        title="My Learning"
        subtitle="View assigned learning, complete required courses, and track certifications."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <BusinessMetric label="Assignments" value={assignments.length} />
        <BusinessMetric label="Completed" value={completedAssignments} tone="success" />
        <BusinessMetric label="Active Certifications" value={activeCertifications} />
      </div>

      <h2 className="sr-only">Learning tasks and certifications</h2>

      <Tabs defaultValue="assignments">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="assignments">My Assignments</TabsTrigger>
          <TabsTrigger value="certifications">My Certifications</TabsTrigger>
        </TabsList>
        <TabsContent value="assignments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <BookOpen className="h-5 w-5 text-primary" />
                Assigned Learning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={assignmentColumns}
                data={assignments}
                emptyMessage="You do not have learning assignments yet."
                isLoading={assignmentsQuery.isLoading}
                keyExtractor={(assignment) => recordId(assignment.id) || `${workerId}-${recordId(assignment.courseId)}`}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="certifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Award className="h-5 w-5 text-primary" />
                Certifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={certificationColumns}
                data={certifications}
                emptyMessage="No certifications are recorded yet."
                isLoading={certificationsQuery.isLoading}
                keyExtractor={(certification) => recordId(certification.id) || certification.certificationName || 'certification'}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
