import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowLeft, CalendarClock, CheckCircle2, Clock3, Play, RefreshCcw, Save, Search, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { useUIStore } from '@/stores/ui-store';

type SchedulerRunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';

interface SchedulerJobRun {
  id: string;
  tenantId: string;
  jobName: string;
  periodKey: string;
  status: SchedulerRunStatus;
  itemsProcessed: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface SchedulerJobOverride {
  tenantId: string;
  jobName: string;
  cron: string;
  enabled: boolean;
}

interface SchedulerJobRow {
  name: string;
  defaultCron: string;
  effectiveCron: string;
  enabled: boolean;
  concurrency: 'per-tenant' | 'global';
  permissions: string[];
  tenantOverride: SchedulerJobOverride | null;
  lastRun: SchedulerJobRun | null;
}

interface SchedulerJobsResponse {
  tenantId: string;
  generatedAt: string;
  jobs: SchedulerJobRow[];
}

interface ScheduleDraft {
  cron: string;
  enabled: boolean;
}

interface SchedulerRunResult {
  jobName: string;
  tenants: Array<{
    tenantId: string;
    jobName: string;
    periodKey: string;
    status: SchedulerRunStatus;
    itemsProcessed: number;
    error?: string;
  }>;
}

function unwrapApiData<T>(response: { data: unknown }): T {
  const envelope = response.data as { data?: T; success?: boolean };
  if (envelope && typeof envelope === 'object' && envelope.success === true && 'data' in envelope) {
    return envelope.data as T;
  }
  return response.data as T;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not run yet';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusClasses(status: SchedulerRunStatus | 'NOT_RUN') {
  if (status === 'FAILED') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'RUNNING') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'SKIPPED') return 'border-slate-200 bg-slate-100 text-slate-600';
  if (status === 'SUCCEEDED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-slate-200 bg-white text-slate-500';
}

function StatusBadge({ status }: { status: SchedulerRunStatus | 'NOT_RUN' }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(status)}`}>
      {status === 'NOT_RUN' ? 'Not run' : status.replace(/_/g, ' ')}
    </span>
  );
}

function jobLabel(name: string): string {
  return name.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function mutationMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'The automation command could not be completed.';
}

export function AdminAutomation() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);
  const [search, setSearch] = React.useState('');
  const [drafts, setDrafts] = React.useState<Record<string, ScheduleDraft>>({});

  const jobsQuery = useQuery({
    queryKey: ['scheduler-jobs'],
    queryFn: async () => unwrapApiData<SchedulerJobsResponse>(await apiClient.get('/platform/scheduler/jobs')),
  });

  React.useEffect(() => {
    if (!jobsQuery.data?.jobs) return;
    setDrafts((current) => {
      const next: Record<string, ScheduleDraft> = {};
      for (const job of jobsQuery.data.jobs) {
        next[job.name] = current[job.name] ?? { cron: job.effectiveCron, enabled: job.enabled };
      }
      return next;
    });
  }, [jobsQuery.data?.jobs]);

  const saveSchedule = useMutation({
    mutationFn: async ({ jobName, cron, enabled }: { jobName: string; cron: string; enabled: boolean }) => {
      const response = await apiClient.post(`/platform/scheduler/jobs/${jobName}/schedule`, {
        tenantId: jobsQuery.data?.tenantId,
        cron,
        enabled,
      });
      return unwrapApiData<SchedulerJobOverride>(response);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduler-jobs'] });
      addNotification({
        title: 'Schedule saved',
        message: `${jobLabel(variables.jobName)} schedule is now ${variables.enabled ? 'enabled' : 'disabled'}.`,
        type: 'success',
        read: false,
      });
    },
    onError: (error) => {
      addNotification({
        title: 'Could not save schedule',
        message: mutationMessage(error),
        type: 'error',
        read: false,
      });
    },
  });

  const runNow = useMutation({
    mutationFn: async (jobName: string) => {
      const response = await apiClient.post(`/platform/scheduler/jobs/${jobName}/run`, { tenantId: jobsQuery.data?.tenantId });
      return unwrapApiData<SchedulerRunResult>(response);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['scheduler-jobs'] });
      const failed = result.tenants.filter((tenant) => tenant.status === 'FAILED').length;
      addNotification({
        title: 'Automation run started',
        message: failed > 0
          ? `${jobLabel(result.jobName)} completed with ${failed} tenant failure${failed === 1 ? '' : 's'}.`
          : `${jobLabel(result.jobName)} completed for ${result.tenants.length} tenant${result.tenants.length === 1 ? '' : 's'}.`,
        type: failed > 0 ? 'warning' : 'success',
        read: false,
      });
    },
    onError: (error) => {
      addNotification({
        title: 'Could not run automation',
        message: mutationMessage(error),
        type: 'error',
        read: false,
      });
    },
  });

  const filteredJobs = React.useMemo(() => {
    const value = search.trim().toLowerCase();
    const rows = jobsQuery.data?.jobs ?? [];
    if (!value) return rows;
    return rows.filter((job) =>
      job.name.toLowerCase().includes(value)
      || job.defaultCron.toLowerCase().includes(value)
      || job.effectiveCron.toLowerCase().includes(value)
      || job.lastRun?.status.toLowerCase().includes(value),
    );
  }, [jobsQuery.data?.jobs, search]);

  const summary = React.useMemo(() => {
    const jobs = jobsQuery.data?.jobs ?? [];
    return {
      total: jobs.length,
      enabled: jobs.filter((job) => job.enabled).length,
      failed: jobs.filter((job) => job.lastRun?.status === 'FAILED').length,
      running: jobs.filter((job) => job.lastRun?.status === 'RUNNING').length,
    };
  }, [jobsQuery.data?.jobs]);

  const updateDraft = React.useCallback((jobName: string, patch: Partial<ScheduleDraft>) => {
    setDrafts((current) => ({
      ...current,
      [jobName]: {
        cron: current[jobName]?.cron ?? '',
        enabled: current[jobName]?.enabled ?? true,
        ...patch,
      },
    }));
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950 md:p-8">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <div>
          <Link className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline" to="/admin/system-console">
            <ArrowLeft className="h-4 w-4" />
            Admin Panel
          </Link>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">System Operations</p>
              <h1 className="font-['Hanken_Grotesk'] text-3xl font-bold md:text-4xl">Automation</h1>
            </div>
            <Button variant="outline" onClick={() => jobsQuery.refetch()} disabled={jobsQuery.isFetching}>
              <RefreshCcw className={`mr-2 h-4 w-4 ${jobsQuery.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {jobsQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
        ) : jobsQuery.isError ? (
          <ErrorState error={jobsQuery.error} onRetry={() => jobsQuery.refetch()} />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <MetricCard icon={CalendarClock} label="Jobs" value={summary.total} />
              <MetricCard icon={CheckCircle2} label="Enabled" value={summary.enabled} />
              <MetricCard icon={XCircle} label="Failed Last Run" value={summary.failed} tone={summary.failed > 0 ? 'alert' : 'default'} />
              <MetricCard icon={Activity} label="Running" value={summary.running} />
            </section>

            <Card className="overflow-hidden">
              <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
                <h2 className="font-headline text-2xl font-semibold leading-tight text-card-foreground">Scheduled Jobs</h2>
                <div className="relative w-full md:w-96">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    placeholder="Search jobs, cron, or status"
                    aria-label="Search automation jobs"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredJobs.length === 0 ? (
                  <div className="p-6">
                    <EmptyState title="No automation jobs found" description="Adjust the search to see scheduled jobs." />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-100">
                          <TableHead>Job</TableHead>
                          <TableHead>Schedule</TableHead>
                          <TableHead>Tenant Control</TableHead>
                          <TableHead>Last Run</TableHead>
                          <TableHead>Result</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredJobs.map((job) => {
                          const draft = drafts[job.name] ?? { cron: job.effectiveCron, enabled: job.enabled };
                          const savePending = saveSchedule.isPending && saveSchedule.variables?.jobName === job.name;
                          const runPending = runNow.isPending && runNow.variables === job.name;
                          return (
                            <TableRow key={job.name}>
                              <TableCell className="min-w-64">
                                <div className="font-semibold">{job.name}</div>
                                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                                  <span>{job.concurrency}</span>
                                  <span>{job.permissions.length} permission{job.permissions.length === 1 ? '' : 's'}</span>
                                </div>
                              </TableCell>
                              <TableCell className="min-w-48 text-sm">
                                <div className="font-mono text-slate-800">{job.defaultCron}</div>
                                <div className="mt-1 text-xs text-slate-500">Default cron</div>
                              </TableCell>
                              <TableCell className="min-w-72">
                                <label className="text-xs font-semibold text-slate-500" htmlFor={`cron-${job.name}`}>Tenant cron</label>
                                <input
                                  id={`cron-${job.name}`}
                                  aria-label={`Cron for ${job.name}`}
                                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                  value={draft.cron}
                                  onChange={(event) => updateDraft(job.name, { cron: event.target.value })}
                                />
                                <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                                  <input
                                    type="checkbox"
                                    aria-label={`Enabled for ${job.name}`}
                                    checked={draft.enabled}
                                    onChange={(event) => updateDraft(job.name, { enabled: event.target.checked })}
                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus-visible:ring-indigo-500"
                                  />
                                  Enabled for this tenant
                                </label>
                              </TableCell>
                              <TableCell className="min-w-44">
                                <StatusBadge status={job.lastRun?.status ?? 'NOT_RUN'} />
                                <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                                  <Clock3 className="h-3.5 w-3.5" />
                                  {formatDateTime(job.lastRun?.finishedAt ?? job.lastRun?.startedAt)}
                                </div>
                              </TableCell>
                              <TableCell className="min-w-48 text-sm">
                                <div className="font-semibold">{job.lastRun?.itemsProcessed ?? 0} processed</div>
                                <div className="mt-1 max-w-60 truncate text-xs text-slate-500" title={job.lastRun?.error ?? undefined}>
                                  {job.lastRun?.error ?? 'No error'}
                                </div>
                              </TableCell>
                              <TableCell className="min-w-52">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    aria-label={`Save ${job.name} schedule`}
                                    disabled={!draft.cron.trim() || savePending}
                                    onClick={() => saveSchedule.mutate({ jobName: job.name, cron: draft.cron.trim(), enabled: draft.enabled })}
                                  >
                                    <Save className="mr-2 h-4 w-4" />
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    aria-label={`Run ${job.name} now`}
                                    disabled={runPending}
                                    onClick={() => runNow.mutate(job.name)}
                                  >
                                    <Play className="mr-2 h-4 w-4" />
                                    Run now
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone?: 'default' | 'alert';
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold">{value}</p>
        </div>
        <div className={`rounded-xl p-3 ${tone === 'alert' ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
