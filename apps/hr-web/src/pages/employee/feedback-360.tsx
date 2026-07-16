import * as React from 'react';
import { MessageSquare, Send, Star } from 'lucide-react';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { useUIStore } from '@/stores/ui-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import type { Feedback360Cycle } from '../admin/feedback-360';

interface WorkerProfile {
  id: string;
}

interface FeedbackSubmitPayload {
  id: string;
  reviewerWorkerId: string;
  relationship: string;
  competencyScores: Record<string, number>;
  comments: string;
}

function idValue(value: string | { value: string } | undefined): string {
  if (!value) return '';
  return typeof value === 'string' ? value : value.value;
}

function reviewerWorkerId(reviewer: string): string {
  if (!reviewer.includes(':')) return reviewer;
  return reviewer.split(':')[1] ?? reviewer;
}

function relationshipValue(reviewer: string): string {
  return reviewer.includes(':') ? reviewer.split(':')[0] ?? 'reviewer' : 'reviewer';
}

function relationshipLabel(value: string): string {
  const labels: Record<string, string> = {
    self: 'Self review',
    manager: 'Manager feedback',
    peer: 'Peer feedback',
    report: 'Direct report feedback',
    reviewer: 'Reviewer feedback',
  };
  return labels[value] ?? 'Reviewer feedback';
}

function hasSubmitted(cycle: Feedback360Cycle, workerId: string): boolean {
  return (cycle.responses ?? []).some((response) => response.reviewerWorkerId === workerId);
}

function averageScore(cycle: Feedback360Cycle): string {
  const scores = (cycle.responses ?? []).flatMap((response) => Object.values(response.competencyScores ?? {}));
  if (scores.length === 0) return 'No rating yet';
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return average.toFixed(1);
}

export function EmployeeFeedback360() {
  const addNotification = useUIStore((state) => state.addNotification);
  const workerQuery = useApiQuery<WorkerProfile>(['employee-feedback-360-worker'], '/employee/profile');
  const workerId = workerQuery.data?.id ?? '';

  const reviewerCyclesQuery = useApiQuery<Feedback360Cycle[]>(
    ['employee-feedback-360-reviewer-cycles', workerId],
    `/engagement/feedback-360-cycles/reviewer/${workerId}`,
    { enabled: Boolean(workerId) },
  );
  const subjectCyclesQuery = useApiQuery<Feedback360Cycle[]>(
    ['employee-feedback-360-subject-cycles', workerId],
    `/engagement/feedback-360-cycles/subject/${workerId}`,
    { enabled: Boolean(workerId) },
  );

  const [activeTaskId, setActiveTaskId] = React.useState<string>('');
  const [scores, setScores] = React.useState<Record<string, number>>({});
  const [comments, setComments] = React.useState('');

  const submitMutation = useApiMutation<unknown, FeedbackSubmitPayload>(
    (variables) => `/engagement/feedback-360-cycles/${variables.id}/commands/submit-response`,
    'post',
    [
      ['employee-feedback-360-reviewer-cycles', workerId],
      ['employee-feedback-360-subject-cycles', workerId],
    ],
    {
      onSuccess: () => {
        setComments('');
        setScores({});
        addNotification({ title: '360 feedback submitted', message: 'Your response has been saved.', type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: 'Could not submit feedback', message: error.message, type: 'error', read: false }),
    },
  );

  const reviewerCycles = reviewerCyclesQuery.data ?? [];
  const subjectCycles = subjectCyclesQuery.data ?? [];
  const tasks = reviewerCycles
    .filter((cycle) => cycle.status === 'IN_PROGRESS')
    .filter((cycle) => !hasSubmitted(cycle, workerId));
  const results = subjectCycles.filter((cycle) => cycle.status === 'COMPLETED' || cycle.status === 'CLOSED');
  const activeTask = tasks.find((cycle) => idValue(cycle.id) === activeTaskId) ?? tasks[0];
  const activeReviewer = activeTask?.reviewers?.find((reviewer) => reviewerWorkerId(reviewer) === workerId);
  const competencies = activeTask?.competencies?.length ? activeTask.competencies : ['Collaboration', 'Execution', 'Communication'];

  React.useEffect(() => {
    if (!activeTaskId && tasks.length > 0) {
      setActiveTaskId(idValue(tasks[0].id));
    }
  }, [activeTaskId, tasks]);

  const updateScore = (competency: string, value: string) => {
    const numeric = Number(value);
    setScores((current) => ({
      ...current,
      [competency]: Number.isFinite(numeric) ? Math.max(1, Math.min(5, numeric)) : 1,
    }));
  };

  const submitFeedback = () => {
    if (!activeTask || !activeReviewer || !workerId) return;
    const payloadScores = Object.fromEntries(competencies.map((competency) => [competency, scores[competency] ?? 3]));
    submitMutation.mutateAsync({
      id: idValue(activeTask.id),
      reviewerWorkerId: workerId,
      relationship: relationshipValue(activeReviewer),
      competencyScores: payloadScores,
      comments,
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
      <header>
        <h2 className="font-headline text-3xl font-bold text-slate-950">Feedback 360</h2>
        <p className="mt-1 text-sm text-slate-500">Complete assigned feedback and review closed summaries.</p>
      </header>

      {workerQuery.error || reviewerCyclesQuery.error || subjectCyclesQuery.error ? (
        <ErrorState
          title="Unable to load 360 feedback"
          error={workerQuery.error ?? reviewerCyclesQuery.error ?? subjectCyclesQuery.error}
          onRetry={() => {
            workerQuery.refetch();
            reviewerCyclesQuery.refetch();
            subjectCyclesQuery.refetch();
          }}
        />
      ) : (
        <Tabs defaultValue="tasks" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tasks">My 360 tasks</TabsTrigger>
            <TabsTrigger value="results">My results</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-4">
            {tasks.length === 0 ? (
              <EmptyState icon={MessageSquare} title="No pending 360 tasks" description="Assigned feedback requests will appear here." />
            ) : (
              <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Assignments</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {tasks.map((cycle) => {
                      const reviewer = cycle.reviewers?.find((item) => reviewerWorkerId(item) === workerId) ?? 'reviewer';
                      return (
                        <button
                          key={idValue(cycle.id)}
                          type="button"
                          className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${idValue(cycle.id) === idValue(activeTask?.id) ? 'border-indigo-200 bg-indigo-50 text-indigo-900' : 'border-white/50 bg-white/50 text-slate-700 hover:bg-white/80'}`}
                          onClick={() => setActiveTaskId(idValue(cycle.id))}
                        >
                          <span className="font-semibold">{relationshipLabel(relationshipValue(reviewer))}</span>
                          <span className="mt-1 block text-xs text-slate-500">{cycle.competencies?.length ?? 0} competencies</span>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">{activeReviewer ? relationshipLabel(relationshipValue(activeReviewer)) : 'Feedback form'}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-3 md:grid-cols-3">
                      {competencies.map((competency) => (
                        <div key={competency} className="space-y-2">
                          <Label htmlFor={`score-${competency}`}>{competency}</Label>
                          <Input
                            id={`score-${competency}`}
                            min={1}
                            max={5}
                            type="number"
                            value={scores[competency] ?? 3}
                            onChange={(event) => updateScore(competency, event.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="feedback-comments">Comments</Label>
                      <textarea
                        id="feedback-comments"
                        value={comments}
                        onChange={(event) => setComments(event.target.value)}
                        className="min-h-28 w-full rounded-2xl border border-transparent bg-muted px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="Share strengths, opportunities, or examples."
                      />
                    </div>
                    <Button onClick={submitFeedback} disabled={submitMutation.isPending} className="gap-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">
                      <Send className="h-4 w-4" />
                      Submit response
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {results.length === 0 ? (
              <EmptyState icon={Star} title="No closed results yet" description="Completed cycles about you will appear here." />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {results.map((cycle) => (
                  <Card key={idValue(cycle.id)}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-xl">Closed 360 summary</CardTitle>
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{cycle.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white/60 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Responses</p>
                          <p className="mt-1 text-2xl font-bold text-slate-900">{cycle.responses?.length ?? 0}</p>
                        </div>
                        <div className="rounded-2xl bg-white/60 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Average</p>
                          <p className="mt-1 text-2xl font-bold text-slate-900">{averageScore(cycle)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(cycle.competencies ?? []).map((competency) => (
                          <Badge key={competency} variant="outline" className="border-indigo-100 bg-indigo-50 text-indigo-700">{competency}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
