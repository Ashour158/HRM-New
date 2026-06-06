import * as React from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useApiQuery } from '@/hooks/use-api';
import { useUIStore } from '@/stores/ui-store';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Goal,
  MessageSquare,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
} from 'lucide-react';
import type { Worker } from '@/types';

interface PerformanceNotification {
  id: string;
  category: string;
  title: string;
  body: string;
  readAt?: string;
  createdAt: string;
  payload?: Record<string, unknown>;
}

interface PerformanceGoal {
  id: string;
  title: string;
  description?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  metricName?: string;
  smartCriteria?: {
    specific?: string;
    measurable?: string;
    achievable?: string;
    relevant?: string;
    timeBound?: string;
  };
  status: string;
}

interface FeedbackRequest {
  id: string;
  cycleId: string;
  revieweeId: string;
  reviewerId: string | null;
  relationshipType: string;
  status: string;
  isAnonymous: boolean;
  dimensionScores?: Record<string, number>;
  areaComments?: Record<string, string>;
}

interface EmployeeActionPlan {
  actionPlan?: {
    workerId: string;
    employeeName: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    currentPerformance?: {
      latestRating: number | null;
      averageGoalProgress: number;
      peerAverageRating: number | null;
      activeGoalCount: number;
      openDevelopmentPlan: boolean;
    };
    timeline?: {
      durationDays: number;
      reviewCheckpoints: number[];
    };
    checkInCadence?: string;
    trackingMetrics?: Array<{ metric: string; current: number | null; target: number | null; unit: string }>;
    successCriteria?: string[];
    progressTrend?: string;
    recommendedActions: string[];
  };
  feedbackSummary?: {
    averageRating: number | null;
    responseCount: number;
    anonymousResponseCount: number;
    conciseFeedback: string;
    dimensionAverages?: Record<string, number>;
    areaThemes?: Record<string, string[]>;
  };
  nineBox?: {
    performanceScore: number;
    potentialScore: number;
    performanceBand: string;
    potentialBand: string;
    box: string;
  };
  goals?: {
    total: number;
    active: number;
    achieved: number;
    atRisk: number;
    averageProgress: number;
  };
}

interface Feedback360Cycle {
  id: string;
  name: string;
  status: string;
  anonymityEnabled?: boolean;
}

const PEER_REVIEW_AREAS = [
  { key: 'communication', label: 'Communication' },
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'ethics', label: 'Ethics' },
  { key: 'teamwork', label: 'Teamwork' },
  { key: 'ownership', label: 'Ownership' },
] as const;

function goalProgress(goal: PerformanceGoal): number {
  if (!goal.targetValue || goal.targetValue <= 0) return 0;
  return Math.min(Math.max(((goal.currentValue ?? 0) / goal.targetValue) * 100, 0), 100);
}

function FieldTextarea({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[76px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      />
    </div>
  );
}

function employeeName(worker?: Worker, fallback = 'Employee') {
  if (!worker) return fallback;
  return `${worker.firstName} ${worker.lastName}`.trim() || worker.email || fallback;
}

export function EmployeePerformance() {
  const { user } = useAuth();
  const addNotification = useUIStore((s) => s.addNotification);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [selectedFeedbackId, setSelectedFeedbackId] = React.useState('');
  const [feedbackForm, setFeedbackForm] = React.useState({
    overallRating: '4',
    strengths: '',
    improvements: '',
    comments: '',
    isAnonymous: true,
    dimensionScores: Object.fromEntries(PEER_REVIEW_AREAS.map((area) => [area.key, '4'])) as Record<string, string>,
    areaComments: Object.fromEntries(PEER_REVIEW_AREAS.map((area) => [area.key, ''])) as Record<string, string>,
  });
  const [directFeedbackForm, setDirectFeedbackForm] = React.useState({
    cycleId: '',
    revieweeId: '',
    relationshipType: 'PEER',
    overallRating: '4',
    strengths: '',
    improvements: '',
    comments: '',
    isAnonymous: true,
    dimensionScores: Object.fromEntries(PEER_REVIEW_AREAS.map((area) => [area.key, '4'])) as Record<string, string>,
    areaComments: Object.fromEntries(PEER_REVIEW_AREAS.map((area) => [area.key, ''])) as Record<string, string>,
  });

  const { data: worker } = useApiQuery<Worker>(['employee-performance-worker'], '/employee/profile');
  const workerId = worker?.id ?? '';

  const { data: notificationsData, refetch: refetchNotifications } = useApiQuery<PerformanceNotification[]>(
    ['employee-performance-notifications', workerId],
    `/performance/notifications/worker/${workerId}`,
    { enabled: Boolean(workerId) },
  );
  const notifications = notificationsData ?? [];
  const { data: goalsData, refetch: refetchGoals } = useApiQuery<PerformanceGoal[]>(
    ['employee-performance-goals', workerId],
    `/performance/goals/worker/${workerId}`,
    { enabled: Boolean(workerId) },
  );
  const goals = goalsData ?? [];
  const { data: feedbackRequestsData, refetch: refetchFeedbackRequests } = useApiQuery<FeedbackRequest[]>(
    ['employee-performance-feedback-requests', workerId],
    `/performance/feedback-360-responses/reviewer/${workerId}`,
    { enabled: Boolean(workerId) },
  );
  const feedbackRequests = React.useMemo(() => feedbackRequestsData ?? [], [feedbackRequestsData]);
  const { data: actionPlan, refetch: refetchActionPlan } = useApiQuery<EmployeeActionPlan>(
    ['employee-performance-action-plan', workerId],
    `/performance/action-plans/worker/${workerId}`,
    { enabled: Boolean(workerId) },
  );
  const { data: availableFeedbackCyclesData } = useApiQuery<Feedback360Cycle[]>(
    ['employee-performance-feedback-cycles'],
    '/performance/feedback-360-cycles/available',
  );
  const availableFeedbackCycles = React.useMemo(() => availableFeedbackCyclesData ?? [], [availableFeedbackCyclesData]);
  const eligibleReviewees = React.useMemo(() => {
    const unique = new Map<string, FeedbackRequest>();
    for (const request of feedbackRequests) {
      if (request.revieweeId && request.revieweeId !== workerId) {
        unique.set(request.revieweeId, request);
      }
    }
    return [...unique.values()];
  }, [feedbackRequests, workerId]);

  React.useEffect(() => {
    const pending = feedbackRequests.find((request) => request.status === 'PENDING');
    setSelectedFeedbackId((current) => current || pending?.id || feedbackRequests[0]?.id || '');
  }, [feedbackRequests]);

  React.useEffect(() => {
    setDirectFeedbackForm((current) => ({
      ...current,
      cycleId: current.cycleId || availableFeedbackCycles[0]?.id || '',
      revieweeId: eligibleReviewees.some((request) => request.revieweeId === current.revieweeId)
        ? current.revieweeId
        : eligibleReviewees[0]?.revieweeId ?? '',
    }));
  }, [availableFeedbackCycles, eligibleReviewees]);

  const selectedFeedback = feedbackRequests.find((request) => request.id === selectedFeedbackId);
  const pendingFeedbackCount = feedbackRequests.filter((request) => request.status === 'PENDING').length;
  const unreadNotifications = notifications.filter((notification) => !notification.readAt).length;

  const submitFeedback = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFeedback) return;
    setError('');
    setMessage('');
    try {
      await apiClient.post(`/performance/feedback-360-responses/${selectedFeedback.id}/commands/submit`, {
        competencyScores: numericScores(feedbackForm.dimensionScores),
        dimensionScores: numericScores(feedbackForm.dimensionScores),
        areaComments: trimComments(feedbackForm.areaComments),
        overallRating: Number(feedbackForm.overallRating),
        strengths: feedbackForm.strengths,
        improvements: feedbackForm.improvements,
        comments: feedbackForm.comments,
        isAnonymous: feedbackForm.isAnonymous,
      });
      setMessage('Peer feedback submitted');
      addNotification({
        title: 'Peer feedback submitted',
        message: 'Your feedback was recorded.',
        type: 'success',
        read: false,
      });
      setFeedbackForm({
        overallRating: '4',
        strengths: '',
        improvements: '',
        comments: '',
        isAnonymous: true,
        dimensionScores: Object.fromEntries(PEER_REVIEW_AREAS.map((area) => [area.key, '4'])) as Record<string, string>,
        areaComments: Object.fromEntries(PEER_REVIEW_AREAS.map((area) => [area.key, ''])) as Record<string, string>,
      });
      await Promise.all([refetchFeedbackRequests(), refetchActionPlan()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit feedback');
      addNotification({
        title: 'Could not submit feedback',
        message: err instanceof Error ? err.message : 'Please try again.',
        type: 'error',
        read: false,
      });
    }
  };

  const submitDirectFeedback = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiClient.post('/performance/feedback-360-responses/self-service', {
        cycleId: directFeedbackForm.cycleId,
        revieweeId: directFeedbackForm.revieweeId,
        relationshipType: directFeedbackForm.relationshipType,
        isAnonymous: directFeedbackForm.isAnonymous,
        competencyScores: numericScores(directFeedbackForm.dimensionScores),
        dimensionScores: numericScores(directFeedbackForm.dimensionScores),
        areaComments: trimComments(directFeedbackForm.areaComments),
        overallRating: Number(directFeedbackForm.overallRating),
        strengths: directFeedbackForm.strengths,
        improvements: directFeedbackForm.improvements,
        comments: directFeedbackForm.comments,
      });
      setMessage('360 feedback submitted');
      addNotification({
        title: '360 feedback submitted',
        message: 'Your feedback was recorded.',
        type: 'success',
        read: false,
      });
      setDirectFeedbackForm((current) => ({
        ...current,
        overallRating: '4',
        strengths: '',
        improvements: '',
        comments: '',
        isAnonymous: true,
        dimensionScores: Object.fromEntries(PEER_REVIEW_AREAS.map((area) => [area.key, '4'])) as Record<string, string>,
        areaComments: Object.fromEntries(PEER_REVIEW_AREAS.map((area) => [area.key, ''])) as Record<string, string>,
      }));
      await Promise.all([refetchFeedbackRequests(), refetchActionPlan()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit 360 feedback');
      addNotification({
        title: 'Could not submit 360 feedback',
        message: err instanceof Error ? err.message : 'Please try again.',
        type: 'error',
        read: false,
      });
    }
  };

  const markRead = async (notification: PerformanceNotification) => {
    if (!workerId || notification.readAt) return;
    await apiClient.post(`/performance/notifications/${notification.id}/commands/read`, { workerId });
    await refetchNotifications();
  };

  return (
    <div className="min-h-[calc(100vh-96px)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 lg:px-6">
        <section className="overflow-hidden fusion-glass rounded-[2rem]">
          <div className="flex flex-col gap-4 border-b border-white/40 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border">
                <AvatarFallback className="bg-[#4f46e5] text-white">
                  {(worker?.firstName?.[0] ?? user?.firstName?.[0] ?? 'E')}{(worker?.lastName?.[0] ?? user?.lastName?.[0] ?? 'P')}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="bg-white">Performance Center</Badge>
                  <Badge variant="secondary">{pendingFeedbackCount} peer tasks</Badge>
                  <Badge variant={unreadNotifications > 0 ? 'default' : 'outline'}>{unreadNotifications} unread notices</Badge>
                </div>
                <h2 className="fusion-gradient-text mt-2 text-2xl font-semibold">{employeeName(worker, `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim())}</h2>
                <p className="text-sm text-slate-500">Goals, reviews, peer feedback, recognition, and action plan.</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => {
              refetchNotifications();
              refetchGoals();
              refetchFeedbackRequests();
              refetchActionPlan();
            }}>
              <TrendingUp className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[2rem] bg-gradient-to-br from-indigo-500 to-violet-500 p-5 text-white fusion-hover">
              <div className="flex items-center gap-2 text-sm font-medium text-white/85"><span className="grid h-8 w-8 place-items-center rounded-2xl bg-white/20"><Goal className="h-4 w-4" /></span> Goal Progress</div>
              <p className="mt-3 text-4xl font-extrabold">{Math.round(actionPlan?.goals?.averageProgress ?? 0)}%</p>
            </div>
            <div className="rounded-[2rem] bg-gradient-to-br from-violet-500 to-purple-500 p-5 text-white fusion-hover">
              <div className="flex items-center gap-2 text-sm font-medium text-white/85"><span className="grid h-8 w-8 place-items-center rounded-2xl bg-white/20"><MessageSquare className="h-4 w-4" /></span> Peer Feedback</div>
              <p className="mt-3 text-4xl font-extrabold">{actionPlan?.feedbackSummary?.responseCount ?? 0}</p>
            </div>
            <div className="rounded-[2rem] bg-gradient-to-br from-teal-500 to-emerald-500 p-5 text-white fusion-hover">
              <div className="flex items-center gap-2 text-sm font-medium text-white/85"><span className="grid h-8 w-8 place-items-center rounded-2xl bg-white/20"><Target className="h-4 w-4" /></span> Talent Box</div>
              <p className="mt-3 text-2xl font-extrabold">{actionPlan?.nineBox?.box ?? 'Not scored'}</p>
            </div>
            <div className="fusion-glass rounded-2xl p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700"><ShieldCheck className="h-4 w-4 text-[#4f46e5]" /> Data Rule</div>
              <p className="mt-2 text-sm text-slate-600">Anonymous reviewers stay masked in employee-facing results.</p>
            </div>
          </div>
        </section>

        {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div> : null}
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Bell className="h-5 w-5 text-[#4f46e5]" /> Notifications</CardTitle>
                <CardDescription>Review-cycle setup and peer-review tasks assigned to you.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {notifications.length ? notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => markRead(notification)}
                    className={cn(
                      'w-full rounded-md border p-3 text-left text-sm transition-colors',
                      notification.readAt ? 'bg-white' : 'border-[#4f46e5]/30 bg-indigo-50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-950">{notification.title}</p>
                      <Badge variant={notification.readAt ? 'outline' : 'default'}>{notification.readAt ? 'Read' : 'New'}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{notification.body}</p>
                  </button>
                )) : <p className="rounded-md border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">No performance notifications yet.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Goal className="h-5 w-5 text-[#4f46e5]" /> Goals</CardTitle>
                <CardDescription>SMART goals tracked against measurable targets.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {goals.length ? goals.map((goal) => {
                  const progress = goalProgress(goal);
                  return (
                    <div key={goal.id} className="fusion-glass rounded-2xl p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-950">{goal.title}</p>
                        <Badge variant="outline">{goal.status}</Badge>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-[#4f46e5]" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {Math.round(progress)}% complete {goal.metricName ? `- ${goal.metricName}` : ''}
                      </p>
                      {goal.smartCriteria ? (
                        <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                          <p><span className="font-semibold">Specific:</span> {goal.smartCriteria.specific}</p>
                          <p><span className="font-semibold">Measurable:</span> {goal.smartCriteria.measurable}</p>
                          <p><span className="font-semibold">Relevant:</span> {goal.smartCriteria.relevant}</p>
                          <p><span className="font-semibold">Time-bound:</span> {goal.smartCriteria.timeBound}</p>
                        </div>
                      ) : null}
                    </div>
                  );
                }) : <p className="rounded-md border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">No goals assigned yet.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Star className="h-5 w-5 text-[#4f46e5]" /> Action Plan</CardTitle>
                <CardDescription>Generated from reviews, goals, feedback, and development-plan status.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {actionPlan?.actionPlan?.recommendedActions?.map((item) => (
                  <div key={item} className="flex gap-2 rounded-md border bg-slate-50 p-3 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4f46e5]" />
                    <span>{item}</span>
                  </div>
                ))}
                {actionPlan?.actionPlan ? (
                  <div className="rounded-md border bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={actionPlan.actionPlan.riskLevel === 'HIGH' ? 'destructive' : actionPlan.actionPlan.riskLevel === 'MEDIUM' ? 'secondary' : 'outline'}>
                        {actionPlan.actionPlan.riskLevel}
                      </Badge>
                      <Badge variant="outline">{actionPlan.actionPlan.timeline?.durationDays ?? 30} day plan</Badge>
                      <Badge variant="outline">{actionPlan.actionPlan.checkInCadence}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      {actionPlan.actionPlan.trackingMetrics?.map((metric) => (
                        <div key={metric.metric} className="rounded-md border bg-slate-50 p-2">
                          <p className="text-xs text-muted-foreground">{metric.metric}</p>
                          <p className="font-semibold">{metric.current ?? '-'} / {metric.target ?? '-'} {metric.unit}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 space-y-1">
                      {actionPlan.actionPlan.successCriteria?.map((criterion) => <p key={criterion} className="text-xs text-slate-600">- {criterion}</p>)}
                    </div>
                  </div>
                ) : null}
                {actionPlan?.feedbackSummary ? (
                  <div className="rounded-md border bg-white p-3 text-sm">
                    <p className="font-medium">Concise feedback</p>
                    <p className="mt-1 text-muted-foreground">{actionPlan.feedbackSummary.conciseFeedback}</p>
                    {actionPlan.feedbackSummary.dimensionAverages ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {Object.entries(actionPlan.feedbackSummary.dimensionAverages).map(([dimension, score]) => (
                          <p key={dimension} className="text-xs capitalize text-slate-600">{dimension}: <span className="font-semibold">{score}/5</span></p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><ClipboardCheck className="h-5 w-5 text-[#4f46e5]" /> Peer Review</CardTitle>
              <CardDescription>Submit assigned peer feedback. Anonymous assignments remain anonymous to the employee receiving feedback.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={submitFeedback}>
                <div className="space-y-2">
                  <Label htmlFor="feedback-request">Assignment</Label>
                  <select
                    id="feedback-request"
                    value={selectedFeedbackId}
                    onChange={(event) => setSelectedFeedbackId(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {feedbackRequests.map((request) => (
                      <option key={request.id} value={request.id}>
                        {request.relationshipType} - {request.status} {request.isAnonymous ? '(anonymous)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="overall-rating">Overall rating</Label>
                  <Input id="overall-rating" type="number" min="1" max="5" value={feedbackForm.overallRating} onChange={(event) => setFeedbackForm({ ...feedbackForm, overallRating: event.target.value })} />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {PEER_REVIEW_AREAS.map((area) => (
                    <div key={area.key} className="space-y-2 rounded-md border bg-slate-50 p-3">
                      <Label htmlFor={`assigned-${area.key}`}>{area.label}</Label>
                      <Input
                        id={`assigned-${area.key}`}
                        type="number"
                        min="1"
                        max="5"
                        value={feedbackForm.dimensionScores[area.key]}
                        onChange={(event) => setFeedbackForm({
                          ...feedbackForm,
                          dimensionScores: { ...feedbackForm.dimensionScores, [area.key]: event.target.value },
                        })}
                      />
                      <textarea
                        aria-label={`${area.label} comment`}
                        rows={2}
                        value={feedbackForm.areaComments[area.key]}
                        onChange={(event) => setFeedbackForm({
                          ...feedbackForm,
                          areaComments: { ...feedbackForm.areaComments, [area.key]: event.target.value },
                        })}
                        className="min-h-[56px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-2 rounded-md border bg-slate-50 p-3 text-sm">
                  <input type="checkbox" checked={feedbackForm.isAnonymous} onChange={(event) => setFeedbackForm({ ...feedbackForm, isAnonymous: event.target.checked })} />
                  Submit as anonymous feedback
                </label>
                <FieldTextarea id="strengths" label="Strengths" value={feedbackForm.strengths} onChange={(value) => setFeedbackForm({ ...feedbackForm, strengths: value })} />
                <FieldTextarea id="improvements" label="Improvements" value={feedbackForm.improvements} onChange={(value) => setFeedbackForm({ ...feedbackForm, improvements: value })} />
                <FieldTextarea id="comments" label="Comments" value={feedbackForm.comments} onChange={(value) => setFeedbackForm({ ...feedbackForm, comments: value })} />
                <Button className="w-full" disabled={!selectedFeedback || selectedFeedback.status !== 'PENDING'}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Submit Peer Feedback
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><MessageSquare className="h-5 w-5 text-[#4f46e5]" /> Give 360 Feedback</CardTitle>
            <CardDescription>Submit feedback only for people assigned to you by an active review workflow.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 xl:grid-cols-[280px_220px_1fr]" onSubmit={submitDirectFeedback}>
              <div className="space-y-2">
                <Label htmlFor="direct-reviewee">Employee</Label>
                <select
                  id="direct-reviewee"
                  value={directFeedbackForm.revieweeId}
                  onChange={(event) => setDirectFeedbackForm({ ...directFeedbackForm, revieweeId: event.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {eligibleReviewees.length === 0 ? <option value="">No assigned reviewees</option> : null}
                  {eligibleReviewees.map((request) => (
                    <option key={request.revieweeId} value={request.revieweeId}>
                      {request.relationshipType} reviewee - {request.revieweeId.slice(-6)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="direct-cycle">Cycle</Label>
                <select
                  id="direct-cycle"
                  value={directFeedbackForm.cycleId}
                  onChange={(event) => setDirectFeedbackForm({ ...directFeedbackForm, cycleId: event.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {availableFeedbackCycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 rounded-md border bg-slate-50 p-3 text-sm">
                <input type="checkbox" checked={directFeedbackForm.isAnonymous} onChange={(event) => setDirectFeedbackForm({ ...directFeedbackForm, isAnonymous: event.target.checked })} />
                Anonymous to recipient
              </label>
              <div className="space-y-2">
                <Label htmlFor="direct-overall">Overall score</Label>
                <Input id="direct-overall" type="number" min="1" max="5" value={directFeedbackForm.overallRating} onChange={(event) => setDirectFeedbackForm({ ...directFeedbackForm, overallRating: event.target.value })} />
              </div>
              <div className="grid gap-3 xl:col-span-3 md:grid-cols-5">
                {PEER_REVIEW_AREAS.map((area) => (
                  <div key={area.key} className="space-y-2 rounded-md border bg-slate-50 p-3">
                    <Label htmlFor={`direct-${area.key}`}>{area.label}</Label>
                    <Input
                      id={`direct-${area.key}`}
                      type="number"
                      min="1"
                      max="5"
                      value={directFeedbackForm.dimensionScores[area.key]}
                      onChange={(event) => setDirectFeedbackForm({
                        ...directFeedbackForm,
                        dimensionScores: { ...directFeedbackForm.dimensionScores, [area.key]: event.target.value },
                      })}
                    />
                    <textarea
                      aria-label={`${area.label} direct comment`}
                      rows={2}
                      value={directFeedbackForm.areaComments[area.key]}
                      onChange={(event) => setDirectFeedbackForm({
                        ...directFeedbackForm,
                        areaComments: { ...directFeedbackForm.areaComments, [area.key]: event.target.value },
                      })}
                      className="min-h-[56px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                    />
                  </div>
                ))}
              </div>
              <FieldTextarea id="direct-strengths" label="Strengths" value={directFeedbackForm.strengths} onChange={(value) => setDirectFeedbackForm({ ...directFeedbackForm, strengths: value })} />
              <FieldTextarea id="direct-improvements" label="Improvements" value={directFeedbackForm.improvements} onChange={(value) => setDirectFeedbackForm({ ...directFeedbackForm, improvements: value })} />
              <FieldTextarea id="direct-comments" label="Summary comments" value={directFeedbackForm.comments} onChange={(value) => setDirectFeedbackForm({ ...directFeedbackForm, comments: value })} />
              <div className="xl:col-span-3">
                <Button className="w-full" disabled={!directFeedbackForm.cycleId || !directFeedbackForm.revieweeId}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Submit 360 Feedback
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function numericScores(values: Record<string, string>): Record<string, number> {
  return Object.entries(values).reduce<Record<string, number>>((acc, [key, value]) => {
    const numeric = Number(value);
    acc[key] = Number.isFinite(numeric) ? numeric : 0;
    return acc;
  }, {});
}

function trimComments(values: Record<string, string>): Record<string, string> {
  return Object.entries(values).reduce<Record<string, string>>((acc, [key, value]) => {
    const trimmed = value.trim();
    if (trimmed) acc[key] = trimmed;
    return acc;
  }, {});
}
