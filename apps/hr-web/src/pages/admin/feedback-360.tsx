import * as React from 'react';
import { MessageSquare, Plus, RefreshCw, Users } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { useUIStore } from '@/stores/ui-store';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { AllowedActions } from '@/components/common/allowed-actions';
import { AuditTrail } from '@/components/common/audit-trail';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AllowedAction } from '@/types';

type Feedback360Status = 'DRAFT' | 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED';
type Feedback360Command = 'activate' | 'start' | 'complete';

interface Feedback360Response {
  reviewerWorkerId: string;
  relationship: string;
  competencyScores: Record<string, number>;
  comments?: string;
  submittedAt: string;
}

export interface Feedback360Cycle {
  id: string | { value: string };
  subjectWorkerId: string | { value: string };
  reviewers?: string[];
  competencies?: string[];
  responses?: Feedback360Response[];
  startDate?: string;
  endDate?: string;
  status: Feedback360Status;
  aggregateVersion?: number;
}

interface Feedback360CreatePayload {
  subjectWorkerId: string;
  reviewers: string[];
  competencies: string[];
  startDate?: string;
  endDate?: string;
}

interface CommandResultView {
  success: true;
  newState: string;
  allowedNextActions: string[];
  data?: Record<string, unknown>;
}

function idValue(value: string | { value: string } | undefined): string {
  if (!value) return '';
  return typeof value === 'string' ? value : value.value;
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function reviewerTokens(role: string, csv: string): string[] {
  return splitCsv(csv).map((workerId) => `${role}:${workerId}`);
}

function relationshipLabel(reviewer: string): string {
  const [role] = reviewer.includes(':') ? reviewer.split(':') : ['reviewer'];
  const labels: Record<string, string> = {
    self: 'Self',
    manager: 'Manager',
    peer: 'Peer',
    report: 'Direct report',
  };
  return labels[role] ?? 'Reviewer';
}

function reviewerWorkerId(reviewer: string): string {
  if (!reviewer.includes(':')) return reviewer;
  return reviewer.split(':')[1] ?? reviewer;
}

function formatDate(value?: string): string {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function statusBadge(status: Feedback360Status) {
  const className: Record<Feedback360Status, string> = {
    DRAFT: 'border-slate-200 bg-slate-50 text-slate-700',
    ACTIVE: 'border-blue-200 bg-blue-50 text-blue-700',
    IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-700',
    COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    CLOSED: 'border-slate-200 bg-slate-100 text-slate-700',
  };
  return <Badge variant="outline" className={className[status]}>{status}</Badge>;
}

function commandFromAllowedAction(action: AllowedAction): Feedback360Command | undefined {
  const token = `${action.action} ${action.id} ${action.label}`.toLowerCase();
  if (token.includes('activate')) return 'activate';
  if (token.includes('start')) return 'start';
  if (token.includes('complete') || token.includes('close') || token.includes('analyze')) return 'complete';
  return undefined;
}

function defaultForm(): Feedback360CreatePayload & {
  selfReviewerId: string;
  managerReviewerIds: string;
  peerReviewerIds: string;
  reportReviewerIds: string;
  competencyCsv: string;
} {
  return {
    subjectWorkerId: '',
    reviewers: [],
    competencies: [],
    selfReviewerId: '',
    managerReviewerIds: '',
    peerReviewerIds: '',
    reportReviewerIds: '',
    competencyCsv: 'Collaboration, Customer focus, Execution',
    startDate: '',
    endDate: '',
  };
}

export function AdminFeedback360() {
  const { user } = useAuth();
  const addNotification = useUIStore((state) => state.addNotification);
  // Require authenticated tenant context; never default to a hardcoded tenant.
  const tenantId = user?.tenantId ?? '';
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState(defaultForm);
  const [selectedCycleId, setSelectedCycleId] = React.useState<string>('');
  const [lastCommand, setLastCommand] = React.useState<CommandResultView | null>(null);
  const queryKey = ['engagement-feedback-360-cycles', tenantId];

  const cyclesQuery = useApiQuery<Feedback360Cycle[]>(
    queryKey,
    `/engagement/feedback-360-cycles/tenant/${tenantId}`,
    { enabled: Boolean(tenantId) },
  );
  const cycles = React.useMemo(() => cyclesQuery.data ?? [], [cyclesQuery.data]);

  React.useEffect(() => {
    if (!selectedCycleId && cycles.length > 0) {
      setSelectedCycleId(idValue(cycles[0].id));
    }
  }, [cycles, selectedCycleId]);

  const createMutation = useApiMutation<CommandResultView, Feedback360CreatePayload>(
    '/engagement/feedback-360-cycles',
    'post',
    [queryKey],
    {
      onSuccess: (result) => {
        setLastCommand(result);
        setCreateOpen(false);
        setForm(defaultForm());
        addNotification({ title: '360 cycle created', message: 'The cycle is ready for activation.', type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: 'Could not create cycle', message: error.message, type: 'error', read: false }),
    },
  );

  const commandMutation = useApiMutation<CommandResultView, { id: string; command: Feedback360Command }>(
    (variables) => `/engagement/feedback-360-cycles/${variables.id}/commands/${variables.command}`,
    'post',
    [queryKey],
    {
      onSuccess: (result) => {
        setLastCommand(result);
        addNotification({ title: 'Cycle updated', message: `Cycle moved to ${result.newState}.`, type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: 'Could not update cycle', message: error.message, type: 'error', read: false }),
    },
  );

  const selectedCycle = cycles.find((cycle) => idValue(cycle.id) === selectedCycleId) ?? cycles[0];

  const columns = React.useMemo<DataTableColumn<Feedback360Cycle>[]>(() => [
    {
      key: 'subject',
      header: 'Subject worker',
      cell: (cycle) => (
        <button
          type="button"
          className="text-left font-semibold text-indigo-700 hover:underline"
          onClick={() => setSelectedCycleId(idValue(cycle.id))}
        >
          {idValue(cycle.subjectWorkerId)}
        </button>
      ),
    },
    { key: 'status', header: 'Status', cell: (cycle) => statusBadge(cycle.status) },
    { key: 'reviewers', header: 'Raters', cell: (cycle) => `${cycle.reviewers?.length ?? 0} reviewers` },
    { key: 'responses', header: 'Submitted', cell: (cycle) => `${cycle.responses?.length ?? 0} of ${cycle.reviewers?.length ?? 0}` },
    { key: 'window', header: 'Window', cell: (cycle) => `${formatDate(cycle.startDate)} - ${formatDate(cycle.endDate)}` },
  ], []);

  const submitCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tenantId) return;
    const reviewers = [
      ...(form.selfReviewerId ? [`self:${form.selfReviewerId}`] : []),
      ...reviewerTokens('manager', form.managerReviewerIds),
      ...reviewerTokens('peer', form.peerReviewerIds),
      ...reviewerTokens('report', form.reportReviewerIds),
    ];
    createMutation.mutateAsync({
      subjectWorkerId: form.subjectWorkerId,
      reviewers,
      competencies: splitCsv(form.competencyCsv),
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    });
  };

  const runCycleCommand = (cycle: Feedback360Cycle, command: Feedback360Command) => {
    if (!tenantId) return;
    commandMutation.mutateAsync({ id: idValue(cycle.id), command });
  };

  const runAllowedAction = (action: AllowedAction) => {
    if (!selectedCycle) return;
    const command = commandFromAllowedAction(action);
    if (command) runCycleCommand(selectedCycle, command);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold text-slate-950">Feedback 360</h1>
          <p className="mt-1 text-sm text-slate-500">Create cycles, launch rater tasks, and review completion.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => cyclesQuery.refetch()} className="gap-2 rounded-xl">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">
            <Plus className="h-4 w-4" />
            Create cycle
          </Button>
        </div>
      </header>

      {/* Establishes the h2 level between the page h1 and the card titles (h3), so the
          heading order is valid (a11y: heading-order). */}
      <h2 className="sr-only">Feedback 360 cycles</h2>

      {cyclesQuery.isError ? (
        <ErrorState title="Unable to load feedback cycles" error={cyclesQuery.error} onRetry={() => cyclesQuery.refetch()} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Cycles</CardTitle>
            </CardHeader>
            <CardContent>
              {cycles.length === 0 && !cyclesQuery.isLoading ? (
                <EmptyState icon={MessageSquare} title="No 360 cycles yet" action={{ label: 'Create cycle', onClick: () => setCreateOpen(true) }} />
              ) : (
                <DataTable
                  columns={columns}
                  data={cycles}
                  keyExtractor={(cycle) => idValue(cycle.id)}
                  isLoading={cyclesQuery.isLoading}
                  emptyMessage="No 360 cycles yet"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Cycle detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {!selectedCycle ? (
                <EmptyState icon={Users} title="Select a cycle" description="Cycle details appear here." />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{idValue(selectedCycle.subjectWorkerId)}</p>
                      <p className="text-xs text-slate-500">{formatDate(selectedCycle.startDate)} - {formatDate(selectedCycle.endDate)}</p>
                    </div>
                    {statusBadge(selectedCycle.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/60 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Raters</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{selectedCycle.reviewers?.length ?? 0}</p>
                    </div>
                    <div className="rounded-2xl bg-white/60 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Submitted</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{selectedCycle.responses?.length ?? 0}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">Assignments</p>
                    <div className="space-y-2">
                      {(selectedCycle.reviewers ?? []).map((reviewer) => {
                        const submitted = selectedCycle.responses?.some((response) => response.reviewerWorkerId === reviewerWorkerId(reviewer));
                        return (
                          <div key={reviewer} className="flex items-center justify-between rounded-xl border border-white/50 bg-white/50 px-3 py-2 text-sm">
                            <span>{relationshipLabel(reviewer)} - {reviewerWorkerId(reviewer)}</span>
                            <Badge variant="outline" className={submitted ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}>
                              {submitted ? 'Submitted' : 'Pending'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">Lifecycle</p>
                    <AllowedActions
                      aggregateType="Feedback360Cycle"
                      aggregateId={idValue(selectedCycle.id)}
                      state={selectedCycle.status}
                      onAction={runAllowedAction}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={selectedCycle.status !== 'DRAFT' || commandMutation.isPending} onClick={() => runCycleCommand(selectedCycle, 'activate')}>Activate</Button>
                      <Button size="sm" variant="outline" disabled={selectedCycle.status !== 'ACTIVE' || commandMutation.isPending} onClick={() => runCycleCommand(selectedCycle, 'start')}>Start</Button>
                      <Button size="sm" variant="outline" disabled={selectedCycle.status !== 'IN_PROGRESS' || commandMutation.isPending} onClick={() => runCycleCommand(selectedCycle, 'complete')}>Close and analyze</Button>
                    </div>
                  </div>

                  {lastCommand ? (
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                      <p className="text-sm font-semibold text-indigo-900">Next available actions</p>
                      <p className="mt-1 text-sm text-indigo-700">{lastCommand.allowedNextActions.length ? lastCommand.allowedNextActions.join(', ') : 'No further actions'}</p>
                    </div>
                  ) : null}

                  <AuditTrail resourceType="Feedback360Cycle" resourceId={idValue(selectedCycle.id)} />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create 360 cycle</DialogTitle>
            <DialogDescription>Assign raters, competencies, and the review window.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitCreate}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subjectWorkerId">Subject worker ID</Label>
                <Input id="subjectWorkerId" value={form.subjectWorkerId} onChange={(event) => setForm((current) => ({ ...current, subjectWorkerId: event.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="selfReviewerId">Self reviewer ID</Label>
                <Input id="selfReviewerId" value={form.selfReviewerId} onChange={(event) => setForm((current) => ({ ...current, selfReviewerId: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="managerReviewerIds">Manager IDs</Label>
                <Input id="managerReviewerIds" value={form.managerReviewerIds} onChange={(event) => setForm((current) => ({ ...current, managerReviewerIds: event.target.value }))} placeholder="Comma separated" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="peerReviewerIds">Peer IDs</Label>
                <Input id="peerReviewerIds" value={form.peerReviewerIds} onChange={(event) => setForm((current) => ({ ...current, peerReviewerIds: event.target.value }))} placeholder="Comma separated" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportReviewerIds">Direct report IDs</Label>
                <Input id="reportReviewerIds" value={form.reportReviewerIds} onChange={(event) => setForm((current) => ({ ...current, reportReviewerIds: event.target.value }))} placeholder="Comma separated" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="competencies">Competencies</Label>
                <Input id="competencies" value={form.competencyCsv} onChange={(event) => setForm((current) => ({ ...current, competencyCsv: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input id="startDate" type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End date</Label>
                <Input id="endDate" type="date" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || !form.subjectWorkerId} className="bg-indigo-600 text-white hover:bg-indigo-700">Create cycle</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
