import * as React from 'react';
import { Award, MessageSquare, Send } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { useApiQuery } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { useUIStore } from '@/stores/ui-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { WorkerPicker } from '@/components/common/worker-picker';
import type { ApiResponse } from '@/types';

export interface EngagementSurvey {
  id: string | { value: string };
  title: string;
  surveyType: string;
  status: string;
  anonymous?: boolean;
  questions?: Array<Record<string, unknown>>;
}

interface RecognitionProgram {
  id: string | { value: string };
  programName: string;
  status: string;
}

interface RecognitionRecord {
  id: string | { value: string };
  message?: string;
  points?: number;
  status: string;
}

function idValue(value: string | { value: string } | undefined): string {
  if (!value) return '';
  return typeof value === 'string' ? value : value.value;
}

function workerIdFromUser(user: unknown): string {
  if (!user || typeof user !== 'object') return '';
  const record = user as { id?: unknown; workerId?: unknown };
  if (typeof record.workerId === 'string' && record.workerId.length > 0) return record.workerId;
  return typeof record.id === 'string' ? record.id : '';
}

function questionCode(question: Record<string, unknown>, index: number): string {
  const code = question.code ?? question.id ?? question.key;
  return typeof code === 'string' && code.length > 0 ? code : `q${index + 1}`;
}

function questionLabel(question: Record<string, unknown>, fallback: string): string {
  const label = question.label ?? question.title ?? question.text;
  return typeof label === 'string' && label.length > 0 ? label : fallback;
}

async function postData<T>(url: string, payload: unknown): Promise<T> {
  const response = await apiClient.post<ApiResponse<T>>(url, payload);
  return response.data.data;
}

function aggregateId(result: unknown): string {
  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>;
    const aggregate = record.aggregateId ?? record.id;
    if (typeof aggregate === 'string') return aggregate;
    if (aggregate && typeof aggregate === 'object' && 'value' in aggregate) {
      const value = (aggregate as { value?: unknown }).value;
      if (typeof value === 'string') return value;
    }
  }
  return '';
}

export function EmployeeSurveyWorkspace({ mode }: { mode: 'SURVEYS' | 'PULSE' }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const workerId = workerIdFromUser(user);
  const [answers, setAnswers] = React.useState<Record<string, Record<string, string>>>({});

  const surveysQuery = useApiQuery<EngagementSurvey[]>(
    ['employee-engagement-surveys', tenantId],
    `/engagement/surveys/tenant/${tenantId}`,
    { enabled: Boolean(tenantId) },
  );

  const surveys = React.useMemo(() => {
    const records = surveysQuery.data ?? [];
    return records
      .filter((survey) => survey.status === 'ACTIVE')
      .filter((survey) => (mode === 'PULSE' ? survey.surveyType === 'PULSE' : survey.surveyType !== 'PULSE'));
  }, [mode, surveysQuery.data]);

  const submitMutation = useMutation({
    mutationFn: async (survey: EngagementSurvey) => {
      const surveyId = idValue(survey.id);
      const created = await postData<unknown>('/engagement/survey-responses', {
        surveyId,
        workerId,
        isAnonymous: Boolean(survey.anonymous),
      });
      const responseId = aggregateId(created);
      if (!responseId) {
        throw new Error(t('engagement.errors.missingResponseId'));
      }
      await postData(`/engagement/survey-responses/${responseId}/commands/complete`, {
        responses: answers[surveyId] ?? {},
      });
      await postData(`/engagement/survey-responses/${responseId}/commands/submit`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-engagement-surveys', tenantId] });
      addNotification({
        title: t('engagement.surveys.submittedTitle'),
        message: t('engagement.surveys.submittedMessage'),
        type: 'success',
        read: false,
      });
    },
    onError: (error) => addNotification({
      title: t('engagement.surveys.failedTitle'),
      message: error instanceof Error ? error.message : t('engagement.surveys.failedMessage'),
      type: 'error',
      read: false,
    }),
  });

  const title = mode === 'PULSE' ? t('engagement.pulse.title') : t('engagement.surveys.title');
  const subtitle = mode === 'PULSE' ? t('engagement.pulse.subtitle') : t('engagement.surveys.subtitle');

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
      <header>
        <h1 className="font-headline text-3xl font-bold text-slate-950">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </header>

      {surveysQuery.error ? (
        <ErrorState title={t('engagement.surveys.loadFailed')} error={surveysQuery.error} onRetry={() => surveysQuery.refetch()} />
      ) : surveys.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={mode === 'PULSE' ? t('engagement.pulse.emptyTitle') : t('engagement.surveys.emptyTitle')}
          description={mode === 'PULSE' ? t('engagement.pulse.emptyDescription') : t('engagement.surveys.emptyDescription')}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {surveys.map((survey) => {
            const surveyId = idValue(survey.id);
            const questions = survey.questions?.length ? survey.questions : [{ code: 'q1', label: t('engagement.surveys.defaultQuestion') }];
            return (
              <Card key={surveyId}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-xl">{survey.title}</CardTitle>
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                      {survey.surveyType}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {questions.map((question, index) => {
                    const code = questionCode(question, index);
                    const label = questionLabel(question, t('engagement.surveys.defaultQuestion'));
                    return (
                      <div key={code} className="space-y-2">
                        <Label htmlFor={`${surveyId}-${code}`}>{label}</Label>
                        <Input
                          id={`${surveyId}-${code}`}
                          value={answers[surveyId]?.[code] ?? ''}
                          onChange={(event) => setAnswers((current) => ({
                            ...current,
                            [surveyId]: {
                              ...(current[surveyId] ?? {}),
                              [code]: event.target.value,
                            },
                          }))}
                        />
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    className="gap-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                    disabled={submitMutation.isPending || !workerId}
                    onClick={() => submitMutation.mutate(survey)}
                  >
                    <Send className="h-4 w-4" />
                    {t('engagement.surveys.submitNamed', { title: survey.title })}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function EmployeeRecognitionWorkspace() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const workerId = workerIdFromUser(user);
  const [recipientWorkerId, setRecipientWorkerId] = React.useState('');
  const [message, setMessage] = React.useState('');

  const programsQuery = useApiQuery<RecognitionProgram[]>(
    ['employee-recognition-programs', tenantId],
    `/engagement/recognition-programs/tenant/${tenantId}`,
    { enabled: Boolean(tenantId) },
  );
  const recordsQuery = useApiQuery<RecognitionRecord[]>(
    ['employee-recognition-records', workerId],
    `/engagement/recognition-records/worker/${workerId}`,
    { enabled: Boolean(workerId) },
  );

  const activeProgram = React.useMemo(
    () => (programsQuery.data ?? []).find((program) => program.status === 'ACTIVE') ?? programsQuery.data?.[0],
    [programsQuery.data],
  );
  const records = React.useMemo(() => recordsQuery.data ?? [], [recordsQuery.data]);

  const createRecognitionMutation = useMutation({
    mutationFn: () => postData('/engagement/recognition-records', {
      fromWorkerId: workerId,
      toWorkerId: recipientWorkerId,
      programId: idValue(activeProgram?.id),
      points: 10,
      message,
    }),
    onSuccess: () => {
      setRecipientWorkerId('');
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['employee-recognition-records', workerId] });
      addNotification({
        title: t('engagement.recognition.sentTitle'),
        message: t('engagement.recognition.sentMessage'),
        type: 'success',
        read: false,
      });
    },
    onError: (error) => addNotification({
      title: t('engagement.recognition.failedTitle'),
      message: error instanceof Error ? error.message : t('engagement.recognition.failedMessage'),
      type: 'error',
      read: false,
    }),
  });

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
      <header>
        <h1 className="font-headline text-3xl font-bold text-slate-950">{t('engagement.recognition.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('engagement.recognition.subtitle')}</p>
      </header>

      {programsQuery.error || recordsQuery.error ? (
        <ErrorState
          title={t('engagement.recognition.loadFailed')}
          error={programsQuery.error ?? recordsQuery.error}
          onRetry={() => {
            programsQuery.refetch();
            recordsQuery.refetch();
          }}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{t('engagement.recognition.sendTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recognition-recipient">{t('engagement.recognition.recipient')}</Label>
                <WorkerPicker id="recognition-recipient" value={recipientWorkerId} onChange={(workerId) => setRecipientWorkerId(workerId)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recognition-message">{t('engagement.recognition.message')}</Label>
                <Input id="recognition-message" value={message} onChange={(event) => setMessage(event.target.value)} />
              </div>
              <Button
                type="button"
                className="gap-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                disabled={createRecognitionMutation.isPending || !workerId || !recipientWorkerId || !activeProgram}
                onClick={() => createRecognitionMutation.mutate()}
              >
                <Award className="h-4 w-4" />
                {t('engagement.recognition.send')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{t('engagement.recognition.awardsTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {records.length === 0 ? (
                <EmptyState icon={Award} title={t('engagement.recognition.emptyTitle')} description={t('engagement.recognition.emptyDescription')} />
              ) : records.map((record) => (
                <div key={idValue(record.id)} className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{record.message || t('engagement.recognition.defaultMessage')}</p>
                    <Badge variant="outline">{record.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{t('engagement.recognition.points', { count: record.points ?? 0 })}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
