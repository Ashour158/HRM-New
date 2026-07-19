import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, FileUp, GraduationCap, Plus, Send } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { useUIStore } from '@/stores/ui-store';
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
import { WorkerPicker } from '@/components/common/worker-picker';

type ApiEnvelope<T> = { success?: boolean; data?: T };
type IdValue = string | { value?: string } | undefined | null;

interface LearningCourse {
  id?: IdValue;
  title?: string;
  description?: string;
  contentType?: string;
  durationMinutes?: number;
  credits?: number;
  certificationEligible?: boolean;
  status?: string;
}

interface LearningAssignment {
  id?: IdValue;
  workerId?: string;
  courseId?: IdValue;
  courseTitle?: string;
  status?: string;
  dueDate?: string;
  score?: number | null;
}

interface Certification {
  id?: IdValue;
  workerId?: string;
  certificationName?: string;
  status?: string;
  expiryDate?: string;
}

interface LearningContentPackage {
  id?: IdValue;
  title?: string;
  packageType?: string;
  version?: string;
  fileUrl?: string;
  status?: string;
}

interface CreateCourseForm {
  title: string;
  contentType: string;
  durationMinutes: string;
  credits: string;
  certificationEligible: boolean;
}

interface CreatePackageForm {
  title: string;
  packageType: 'SCORM_1_2' | 'SCORM_2004' | 'XAPI';
  version: string;
  fileUrl: string;
}

interface CreateAssignmentForm {
  workerId: string;
  courseId: string;
  assignedBy: string;
  dueDate: string;
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

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function mutationError(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed.';
}

function statusVariant(status?: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  const normalized = (status ?? '').toUpperCase();
  if (['PUBLISHED', 'ACTIVE', 'COMPLETED', 'VALIDATED'].includes(normalized)) return 'default';
  if (['ARCHIVED', 'RETIRED', 'CANCELLED', 'EXPIRED', 'REVOKED', 'DEPRECATED'].includes(normalized)) return 'destructive';
  if (['IN_PROGRESS', 'PARSING', 'ASSIGNED', 'UPLOADED'].includes(normalized)) return 'secondary';
  return 'outline';
}

function formatDate(value?: string) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function learningStatus(status?: string) {
  return <Badge variant={statusVariant(status)}>{status ?? 'DRAFT'}</Badge>;
}

function defaultCourseForm(): CreateCourseForm {
  return {
    title: 'New learning course',
    contentType: 'VIDEO',
    durationMinutes: '45',
    credits: '1',
    certificationEligible: false,
  };
}

function defaultPackageForm(): CreatePackageForm {
  return {
    title: 'New content package',
    packageType: 'SCORM_2004',
    version: '1.0',
    fileUrl: '',
  };
}

function defaultAssignmentForm(courseId: string, assignedBy: string): CreateAssignmentForm {
  return {
    workerId: '',
    courseId,
    assignedBy,
    dueDate: '',
  };
}

export function AdminLearning() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const addNotification = useUIStore((state) => state.addNotification);
  const actorId = user?.id ?? '';
  const [activeTab, setActiveTab] = React.useState('courses');
  const [courseDialogOpen, setCourseDialogOpen] = React.useState(false);
  const [packageDialogOpen, setPackageDialogOpen] = React.useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = React.useState(false);
  const [selectedCourseId, setSelectedCourseId] = React.useState('');
  const [courseForm, setCourseForm] = React.useState<CreateCourseForm>(() => defaultCourseForm());
  const [packageForm, setPackageForm] = React.useState<CreatePackageForm>(() => defaultPackageForm());
  const [assignmentForm, setAssignmentForm] = React.useState<CreateAssignmentForm>(() => defaultAssignmentForm('', actorId));

  const coursesQuery = useQuery({
    queryKey: ['learning-courses', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => list<LearningCourse>(unwrap(await apiClient.get(`/learning/courses/tenant/${tenantId}`))),
  });

  const packagesQuery = useQuery({
    queryKey: ['learning-content-packages', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => list<LearningContentPackage>(unwrap(await apiClient.get(`/learning/content-packages/tenant/${tenantId}`))),
  });

  const tenantAssignmentsQuery = useQuery({
    queryKey: ['learning-assignments-tenant', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => list<LearningAssignment>(unwrap(await apiClient.get(`/learning/assignments/tenant/${tenantId}`))),
  });

  const certificationsQuery = useQuery({
    queryKey: ['learning-certifications-tenant', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => list<Certification>(unwrap(await apiClient.get(`/learning/certifications/tenant/${tenantId}`))),
  });

  const courses = coursesQuery.data ?? [];
  const firstCourseId = recordId(courses[0]?.id);

  React.useEffect(() => {
    if (!selectedCourseId && firstCourseId) {
      setSelectedCourseId(firstCourseId);
      setAssignmentForm((current) => ({ ...current, courseId: firstCourseId, assignedBy: current.assignedBy || actorId }));
    }
  }, [actorId, firstCourseId, selectedCourseId]);

  const assignmentsByCourseQuery = useQuery({
    queryKey: ['learning-assignments-course', selectedCourseId],
    enabled: Boolean(selectedCourseId),
    queryFn: async () => list<LearningAssignment>(unwrap(await apiClient.get(`/learning/assignments/course/${selectedCourseId}`))),
  });

  const invalidateLearning = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['learning-courses'] });
    void queryClient.invalidateQueries({ queryKey: ['learning-content-packages'] });
    void queryClient.invalidateQueries({ queryKey: ['learning-assignments-tenant'] });
    void queryClient.invalidateQueries({ queryKey: ['learning-assignments-course'] });
    void queryClient.invalidateQueries({ queryKey: ['learning-certifications-tenant'] });
  }, [queryClient]);

  const createCourseMutation = useMutation({
    mutationFn: async (payload: CreateCourseForm) => apiClient.post('/learning/courses', {
      title: payload.title,
      contentType: payload.contentType,
      durationMinutes: Number(payload.durationMinutes || 0),
      credits: Number(payload.credits || 0),
      certificationEligible: payload.certificationEligible,
    }),
    onSuccess: () => {
      setCourseDialogOpen(false);
      setCourseForm(defaultCourseForm());
      addNotification({ title: 'Course created', message: 'The course is available in the learning catalog.', type: 'success', read: false });
      invalidateLearning();
    },
    onError: (error) => addNotification({ title: 'Could not create course', message: mutationError(error), type: 'error', read: false }),
  });

  const createPackageMutation = useMutation({
    mutationFn: async (payload: CreatePackageForm) => apiClient.post('/learning/content-packages', {
      title: payload.title,
      packageType: payload.packageType,
      version: payload.version,
      fileUrl: payload.fileUrl || undefined,
    }),
    onSuccess: () => {
      setPackageDialogOpen(false);
      setPackageForm(defaultPackageForm());
      addNotification({ title: 'Content package created', message: 'The package is ready for catalog processing.', type: 'success', read: false });
      invalidateLearning();
    },
    onError: (error) => addNotification({ title: 'Could not create package', message: mutationError(error), type: 'error', read: false }),
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (payload: CreateAssignmentForm) => apiClient.post('/learning/assignments', {
      workerId: payload.workerId,
      courseId: payload.courseId,
      assignedBy: payload.assignedBy || actorId,
      dueDate: payload.dueDate || undefined,
    }),
    onSuccess: () => {
      setAssignmentDialogOpen(false);
      setAssignmentForm(defaultAssignmentForm(selectedCourseId || firstCourseId, actorId));
      addNotification({ title: 'Course assigned', message: 'The worker can now see the assignment in self-service.', type: 'success', read: false });
      invalidateLearning();
    },
    onError: (error) => addNotification({ title: 'Could not assign course', message: mutationError(error), type: 'error', read: false }),
  });

  const commandMutation = useMutation({
    mutationFn: async ({ path, body }: { path: string; body?: Record<string, unknown> }) => apiClient.post(path, body ?? {}),
    onSuccess: () => {
      addNotification({ title: 'Learning action completed', message: 'The learning record was updated.', type: 'success', read: false });
      invalidateLearning();
    },
    onError: (error) => addNotification({ title: 'Learning action failed', message: mutationError(error), type: 'error', read: false }),
  });

  const courseColumns = React.useMemo<DataTableColumn<LearningCourse>[]>(() => [
    {
      key: 'title',
      header: 'Course',
      cell: (course) => (
        <div>
          <p className="font-semibold text-foreground">{course.title ?? 'Untitled course'}</p>
          <p className="text-xs text-muted-foreground">{course.contentType ?? 'Content'}</p>
        </div>
      ),
    },
    { key: 'duration', header: 'Duration', cell: (course) => `${course.durationMinutes ?? 0} min` },
    { key: 'credits', header: 'Credits', cell: (course) => course.credits ?? 0 },
    { key: 'status', header: 'Status', cell: (course) => learningStatus(course.status) },
    {
      key: 'actions',
      header: 'Actions',
      cell: (course) => {
        const id = recordId(course.id);
        const label = course.title ?? 'course';
        return (
          <div className="flex flex-wrap gap-2">
            <Button
              aria-label={`Publish ${label}`}
              disabled={!id || commandMutation.isPending || ['PUBLISHED', 'ARCHIVED', 'RETIRED'].includes((course.status ?? '').toUpperCase())}
              onClick={() => commandMutation.mutate({ path: `/learning/courses/${id}/commands/publish` })}
              size="sm"
              type="button"
              variant="outline"
            >
              Publish
            </Button>
            <Button
              aria-label={`Archive ${label}`}
              disabled={!id || commandMutation.isPending || ['ARCHIVED', 'RETIRED'].includes((course.status ?? '').toUpperCase())}
              onClick={() => commandMutation.mutate({ path: `/learning/courses/${id}/commands/archive` })}
              size="sm"
              type="button"
              variant="outline"
            >
              Archive
            </Button>
            <Button
              aria-label={`Retire ${label}`}
              disabled={!id || commandMutation.isPending || (course.status ?? '').toUpperCase() === 'RETIRED'}
              onClick={() => commandMutation.mutate({ path: `/learning/courses/${id}/commands/retire` })}
              size="sm"
              type="button"
              variant="outline"
            >
              Retire
            </Button>
          </div>
        );
      },
    },
  ], [commandMutation]);

  const packageColumns = React.useMemo<DataTableColumn<LearningContentPackage>[]>(() => [
    {
      key: 'title',
      header: 'Package',
      cell: (item) => (
        <div>
          <p className="font-semibold text-foreground">{item.title ?? 'Untitled package'}</p>
          <p className="text-xs text-muted-foreground">{item.packageType ?? 'Package'} {item.version ? `v${item.version}` : ''}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (item) => learningStatus(item.status) },
    {
      key: 'actions',
      header: 'Actions',
      cell: (item) => {
        const id = recordId(item.id);
        const title = item.title ?? 'package';
        return (
          <div className="flex flex-wrap gap-2">
            {['parse', 'validate', 'publish', 'deprecate'].map((command) => (
              <Button
                aria-label={`${command} ${title}`}
                disabled={!id || commandMutation.isPending}
                key={command}
                onClick={() => commandMutation.mutate({ path: `/learning/content-packages/${id}/commands/${command}` })}
                size="sm"
                type="button"
                variant="outline"
              >
                {command.charAt(0).toUpperCase() + command.slice(1)}
              </Button>
            ))}
          </div>
        );
      },
    },
  ], [commandMutation]);

  const assignmentColumns = React.useMemo<DataTableColumn<LearningAssignment>[]>(() => [
    {
      key: 'worker',
      header: 'Worker',
      cell: (assignment) => (
        <div>
          <p className="font-semibold text-foreground">{assignment.workerId ?? 'Unassigned worker'}</p>
          <p className="text-xs text-muted-foreground">{assignment.courseTitle ?? `Course ${recordId(assignment.courseId) || 'not selected'}`}</p>
        </div>
      ),
    },
    { key: 'dueDate', header: 'Due date', cell: (assignment) => formatDate(assignment.dueDate) },
    { key: 'status', header: 'Status', cell: (assignment) => learningStatus(assignment.status) },
    {
      key: 'actions',
      header: 'Actions',
      cell: (assignment) => {
        const id = recordId(assignment.id);
        return (
          <div className="flex flex-wrap gap-2">
            {['start', 'complete', 'expire', 'cancel'].map((command) => (
              <Button
                disabled={!id || commandMutation.isPending}
                key={command}
                onClick={() => commandMutation.mutate({
                  path: `/learning/assignments/${id}/commands/${command}`,
                  body: command === 'complete' ? { score: assignment.score ?? 100 } : {},
                })}
                size="sm"
                type="button"
                variant="outline"
              >
                {command.charAt(0).toUpperCase() + command.slice(1)}
              </Button>
            ))}
          </div>
        );
      },
    },
  ], [commandMutation]);

  const packages = packagesQuery.data ?? [];
  const assignments = assignmentsByCourseQuery.data ?? tenantAssignmentsQuery.data ?? [];
  const certifications = certificationsQuery.data ?? [];
  const activeCourseCount = courses.filter((course) => ['PUBLISHED', 'ACTIVE'].includes((course.status ?? '').toUpperCase())).length;
  const openAssignmentCount = assignments.filter((assignment) => !['COMPLETED', 'EXPIRED', 'CANCELLED'].includes((assignment.status ?? '').toUpperCase())).length;
  const activeCertificationCount = certifications.filter((certification) => (certification.status ?? '').toUpperCase() === 'ACTIVE').length;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-6 lg:p-8">
      <BusinessPageHeader
        eyebrow="Talent Development"
        icon={GraduationCap}
        title="Learning"
        subtitle="Create courses, manage content packages, and assign learning to workers."
        actions={(
          <>
            <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Course
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Course</DialogTitle>
                  <DialogDescription>Add a course to the tenant learning catalog.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="course-title">Course title</Label>
                    <Input id="course-title" value={courseForm.title} onChange={(event) => setCourseForm((current) => ({ ...current, title: event.target.value }))} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="course-content-type">Content type</Label>
                      <Input id="course-content-type" value={courseForm.contentType} onChange={(event) => setCourseForm((current) => ({ ...current, contentType: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="course-duration">Duration minutes</Label>
                      <Input id="course-duration" type="number" value={courseForm.durationMinutes} onChange={(event) => setCourseForm((current) => ({ ...current, durationMinutes: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="course-credits">Credits</Label>
                      <Input id="course-credits" type="number" value={courseForm.credits} onChange={(event) => setCourseForm((current) => ({ ...current, credits: event.target.value }))} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <input
                      checked={courseForm.certificationEligible}
                      className="h-4 w-4 rounded border-input text-primary focus-visible:ring-ring"
                      onChange={(event) => setCourseForm((current) => ({ ...current, certificationEligible: event.target.checked }))}
                      type="checkbox"
                    />
                    Certification eligible
                  </label>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCourseDialogOpen(false)}>Cancel</Button>
                  <Button disabled={createCourseMutation.isPending || !courseForm.title.trim()} type="button" onClick={() => createCourseMutation.mutate(courseForm)}>
                    Save Course
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline">
                  <FileUp className="mr-2 h-4 w-4" />
                  Add Package
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Content Package</DialogTitle>
                  <DialogDescription>Register SCORM or xAPI content for course delivery.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="package-title">Package title</Label>
                    <Input id="package-title" value={packageForm.title} onChange={(event) => setPackageForm((current) => ({ ...current, title: event.target.value }))} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="package-type">Package type</Label>
                      <select
                        className="flex h-10 w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                        id="package-type"
                        value={packageForm.packageType}
                        onChange={(event) => setPackageForm((current) => ({ ...current, packageType: event.target.value as CreatePackageForm['packageType'] }))}
                      >
                        <option value="SCORM_1_2">SCORM 1.2</option>
                        <option value="SCORM_2004">SCORM 2004</option>
                        <option value="XAPI">xAPI</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="package-version">Version</Label>
                      <Input id="package-version" value={packageForm.version} onChange={(event) => setPackageForm((current) => ({ ...current, version: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="package-url">File URL</Label>
                      <Input id="package-url" value={packageForm.fileUrl} onChange={(event) => setPackageForm((current) => ({ ...current, fileUrl: event.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setPackageDialogOpen(false)}>Cancel</Button>
                  <Button disabled={createPackageMutation.isPending || !packageForm.title.trim()} type="button" onClick={() => createPackageMutation.mutate(packageForm)}>
                    Save Package
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <BusinessMetric label="Courses" value={courses.length} />
        <BusinessMetric label="Published" value={activeCourseCount} tone="success" />
        <BusinessMetric label="Open Assignments" value={openAssignmentCount} tone={openAssignmentCount > 0 ? 'warning' : 'default'} />
        <BusinessMetric label="Active Certifications" value={activeCertificationCount} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="content">Content Catalog</TabsTrigger>
          <TabsTrigger value="assignments">Assignment Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="mt-6">
          <Card>
            <CardHeader>
              <SectionHeading title="Courses" />
            </CardHeader>
            <CardContent>
              <DataTable
                columns={courseColumns}
                data={courses}
                emptyMessage="No courses have been created yet."
                isLoading={coursesQuery.isLoading}
                keyExtractor={(course) => recordId(course.id) || course.title || 'course'}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="mt-6">
          <Card>
            <CardHeader>
              <SectionHeading title="Content Catalog" />
            </CardHeader>
            <CardContent>
              <DataTable
                columns={packageColumns}
                data={packages}
                emptyMessage="No learning content packages are registered."
                isLoading={packagesQuery.isLoading}
                keyExtractor={(item) => recordId(item.id) || item.title || 'package'}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle>Assignment Overview</CardTitle>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Label htmlFor="assignment-course">Course</Label>
                    <select
                      className="h-10 min-w-[280px] rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                      id="assignment-course"
                      value={selectedCourseId}
                      onChange={(event) => {
                        setSelectedCourseId(event.target.value);
                        setAssignmentForm((current) => ({ ...current, courseId: event.target.value }));
                      }}
                    >
                      {courses.length === 0 ? <option value="">No courses</option> : null}
                      {courses.map((course) => {
                        const id = recordId(course.id);
                        return <option key={id || course.title} value={id}>{course.title ?? id}</option>;
                      })}
                    </select>
                  </div>
                </div>
                <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      disabled={!selectedCourseId && courses.length === 0}
                      onClick={() => setAssignmentForm(defaultAssignmentForm(selectedCourseId || firstCourseId, actorId))}
                      type="button"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Assign Course
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Assign Course</DialogTitle>
                      <DialogDescription>Create a learning assignment for a worker.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                      <div className="space-y-2">
                        <Label htmlFor="assignment-worker">Select worker</Label>
                        <WorkerPicker id="assignment-worker" value={assignmentForm.workerId} onChange={(workerId) => setAssignmentForm((current) => ({ ...current, workerId }))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assignment-course-id">Course ID</Label>
                        <Input id="assignment-course-id" value={assignmentForm.courseId} onChange={(event) => setAssignmentForm((current) => ({ ...current, courseId: event.target.value }))} />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="assignment-assigned-by">Assigned by</Label>
                          <Input id="assignment-assigned-by" value={assignmentForm.assignedBy} onChange={(event) => setAssignmentForm((current) => ({ ...current, assignedBy: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="assignment-due">Due date</Label>
                          <Input id="assignment-due" type="date" value={assignmentForm.dueDate} onChange={(event) => setAssignmentForm((current) => ({ ...current, dueDate: event.target.value }))} />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setAssignmentDialogOpen(false)}>Cancel</Button>
                      <Button
                        disabled={createAssignmentMutation.isPending || !assignmentForm.workerId.trim() || !assignmentForm.courseId.trim()}
                        type="button"
                        onClick={() => createAssignmentMutation.mutate(assignmentForm)}
                      >
                        Save Assignment
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={assignmentColumns}
                data={assignments}
                emptyMessage="No workers are assigned to this course yet."
                isLoading={assignmentsByCourseQuery.isLoading || tenantAssignmentsQuery.isLoading}
                keyExtractor={(assignment) => recordId(assignment.id) || `${assignment.workerId}-${recordId(assignment.courseId)}`}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-primary" />
            Certification Register
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: 'name', header: 'Certification', cell: (cert) => cert.certificationName ?? 'Certification' },
              { key: 'worker', header: 'Worker', cell: (cert) => cert.workerId ?? 'Unassigned' },
              { key: 'expiry', header: 'Expires', cell: (cert) => formatDate(cert.expiryDate) },
              { key: 'status', header: 'Status', cell: (cert) => learningStatus(cert.status) },
            ]}
            data={certifications}
            emptyMessage="No certifications have been recorded."
            isLoading={certificationsQuery.isLoading}
            keyExtractor={(cert) => recordId(cert.id) || cert.certificationName || 'certification'}
          />
        </CardContent>
      </Card>
    </div>
  );
}
