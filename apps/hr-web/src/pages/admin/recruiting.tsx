import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, CheckCircle2, CircleDot, Clock3, Search, Send, X, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BusinessMetric, BusinessPageHeader } from '@/components/common/business-page';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { useUIStore } from '@/stores/ui-store';
import { formatCurrency, formatDate, generateUUID } from '@/lib/utils';
import type { Worker } from '@/types';

type RequisitionStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'OPEN' | 'FILLED' | 'CLOSED' | 'REJECTED';
type CandidateStatus = 'NEW' | 'SCREENING' | 'INTERVIEWING' | 'INTERVIEW' | 'OFFER_PENDING' | 'HIRED' | 'REJECTED' | 'WITHDRAWN';
type OfferStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'WITHDRAWN';

interface JobRequisition {
  id: string;
  requisitionId?: string;
  requisitionNumber?: string;
  positionId?: string;
  departmentId?: string;
  title: string;
  description?: string;
  status: RequisitionStatus | string;
  version?: number;
}

interface Candidate {
  id: string;
  applicationId?: string;
  requisitionId: string;
  candidateEmail?: string;
  email?: string;
  candidateName?: string;
  firstName?: string;
  lastName?: string;
  status: CandidateStatus | string;
  version?: number;
}

interface RecruitingOffer {
  id: string;
  offerId?: string;
  candidateId?: string;
  requisitionId?: string;
  proposedSalary?: number;
  currency?: string;
  startDate?: string;
  status: OfferStatus | string;
  version?: number;
}

interface CommandResultView {
  newState?: string;
  allowedNextActions?: string[];
  message?: string;
}

type CandidateCommand =
  | { command: 'screen'; candidateId: string; outcome: string; screenedByWorkerId: string }
  | { command: 'schedule-interview'; candidateId: string; interviewId: string; scheduledAt: string; interviewerWorkerIds: string[]; format: 'PHONE' | 'VIDEO' | 'ONSITE' | 'PANEL' | 'TAKE_HOME' };
type RequisitionCommand = { command: 'approve' | 'publish' | 'close'; requisitionId: string; reason?: string };
type OfferCommand = { command: 'approve' | 'send' | 'accept'; offerId: string; acceptedAt?: string; sentAt?: string };

const candidateStages = ['NEW', 'SCREENING', 'INTERVIEWING', 'OFFER_PENDING', 'HIRED', 'REJECTED'];
const requisitionStatuses = ['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'OPEN', 'CLOSED', 'REJECTED'];

function normalizeId(value: unknown): string {
  if (typeof value === 'string') return value;
  const wrapped = value as { value?: unknown } | undefined;
  return typeof wrapped?.value === 'string' ? wrapped.value : '';
}

function normalizeRequisition(row: JobRequisition): JobRequisition {
  const id = normalizeId(row.id) || normalizeId(row.requisitionId);
  return { ...row, id, requisitionId: normalizeId(row.requisitionId) || id };
}

function normalizeCandidate(row: Candidate): Candidate {
  const id = normalizeId(row.id) || normalizeId(row.applicationId);
  return { ...row, id, applicationId: normalizeId(row.applicationId) || id, requisitionId: normalizeId(row.requisitionId) || row.requisitionId };
}

function normalizeOffer(row: RecruitingOffer): RecruitingOffer {
  const id = normalizeId(row.id) || normalizeId(row.offerId);
  return {
    ...row,
    id,
    offerId: normalizeId(row.offerId) || id,
    candidateId: normalizeId(row.candidateId) || row.candidateId,
    requisitionId: normalizeId(row.requisitionId) || row.requisitionId,
  };
}

function normalizedCandidateStatus(status: string) {
  return status === 'INTERVIEW' ? 'INTERVIEWING' : status;
}

function candidateName(candidate: Candidate) {
  const joined = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim();
  return candidate.candidateName || joined || candidate.email || candidate.candidateEmail || candidate.id;
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (['OPEN', 'APPROVED', 'PUBLISHED', 'HIRED', 'ACCEPTED'].includes(status)) return 'default';
  if (['REJECTED', 'WITHDRAWN', 'DECLINED', 'CLOSED', 'EXPIRED'].includes(status)) return 'destructive';
  if (['SCREENING', 'INTERVIEWING', 'OFFER_PENDING', 'PENDING_APPROVAL', 'SENT'].includes(status)) return 'secondary';
  return 'outline';
}

function StatusBadge({ status }: { status: string }) {
  const Icon = ['REJECTED', 'WITHDRAWN', 'DECLINED', 'CLOSED', 'EXPIRED'].includes(status)
    ? XCircle
    : ['OPEN', 'APPROVED', 'PUBLISHED', 'HIRED', 'ACCEPTED'].includes(status)
      ? CheckCircle2
      : ['SCREENING', 'INTERVIEWING', 'OFFER_PENDING', 'PENDING_APPROVAL', 'SENT'].includes(status)
        ? Clock3
        : CircleDot;
  return (
    <Badge variant={statusVariant(status)} className="gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

function commandSummary(result: CommandResultView | null) {
  if (!result) return '';
  const nextActions = result.allowedNextActions?.length ? result.allowedNextActions.join(', ') : 'No further actions';
  return `${result.newState ? `Now ${result.newState}. ` : ''}Next: ${nextActions}`;
}

const OFFER_CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'INR', 'CAD', 'AUD'];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toDateTimeLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function defaultScheduledAt() {
  return toDateTimeLocalValue(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));
}

function defaultOfferStartDate() {
  return toDateInputValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
}

function normalizeWorkerList(data: Worker[] | { items?: Worker[] } | undefined): Worker[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.items ?? [];
}

function workerDisplayName(worker: Worker): string {
  const joined = [worker.firstName, worker.lastName].filter(Boolean).join(' ').trim();
  return joined || worker.email || worker.id;
}

export function AdminRecruiting() {
  const { t } = useTranslation();
  const addNotification = useUIStore((state) => state.addNotification);
  const { user } = useAuth();
  const { tenantConfig } = useTenant();
  const tenantCurrency = tenantConfig.currency;
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('ALL');
  const [departmentFilter, setDepartmentFilter] = React.useState('');
  const [positionFilter, setPositionFilter] = React.useState('');
  const [selectedRequisitionId, setSelectedRequisitionId] = React.useState<string | undefined>();
  const [selectedCandidateId, setSelectedCandidateId] = React.useState<string | undefined>();
  const [selectedOfferId, setSelectedOfferId] = React.useState<string | undefined>();
  const [offerDialogOpen, setOfferDialogOpen] = React.useState(false);
  const [newRequisitionTitle, setNewRequisitionTitle] = React.useState('');
  const [newRequisitionPositionId, setNewRequisitionPositionId] = React.useState('');
  const [candidateEmail, setCandidateEmail] = React.useState('');
  const [candidateFullName, setCandidateFullName] = React.useState('');
  const [offerAmount, setOfferAmount] = React.useState('120000');
  const [offerStartDate, setOfferStartDate] = React.useState(defaultOfferStartDate);
  const [offerCurrency, setOfferCurrency] = React.useState(tenantCurrency);
  const [offerBenefits, setOfferBenefits] = React.useState('');
  const [interviewDialogOpen, setInterviewDialogOpen] = React.useState(false);
  const [interviewerSearch, setInterviewerSearch] = React.useState('');
  const [selectedInterviewers, setSelectedInterviewers] = React.useState<{ id: string; name: string }[]>([]);
  const [scheduledAtLocal, setScheduledAtLocal] = React.useState(defaultScheduledAt);
  const [lastCommand, setLastCommand] = React.useState<CommandResultView | null>(null);

  const currencyOptions = React.useMemo(
    () => Array.from(new Set([tenantCurrency, ...OFFER_CURRENCY_OPTIONS])),
    [tenantCurrency],
  );
  const minScheduledAt = toDateTimeLocalValue(new Date());
  const minOfferStartDate = toDateInputValue(new Date());

  const requisitionsPath = React.useMemo(() => {
    const params = new URLSearchParams();
    if (departmentFilter.trim()) params.set('department', departmentFilter.trim());
    if (!departmentFilter.trim() && positionFilter.trim()) params.set('position', positionFilter.trim());
    const query = params.toString();
    return query ? `/hr/recruiting/requisitions?${query}` : '/hr/recruiting/requisitions/open';
  }, [departmentFilter, positionFilter]);

  const requisitionsQuery = useApiQuery<JobRequisition[]>(
    ['admin-recruiting-requisitions', requisitionsPath],
    requisitionsPath,
    { retry: false },
  );

  const requisitions = React.useMemo(
    () => (requisitionsQuery.data ?? []).map(normalizeRequisition),
    [requisitionsQuery.data],
  );
  const filteredRequisitions = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return requisitions.filter((requisition) => {
      const matchesSearch = !needle
        || requisition.title.toLowerCase().includes(needle)
        || (requisition.requisitionNumber ?? '').toLowerCase().includes(needle)
        || (requisition.positionId ?? '').toLowerCase().includes(needle);
      const matchesStatus = statusFilter === 'ALL' || requisition.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [requisitions, search, statusFilter]);

  React.useEffect(() => {
    const firstId = filteredRequisitions[0]?.id;
    if (!selectedRequisitionId && firstId) setSelectedRequisitionId(firstId);
    if (selectedRequisitionId && filteredRequisitions.length > 0 && !filteredRequisitions.some((requisition) => requisition.id === selectedRequisitionId)) {
      setSelectedRequisitionId(firstId);
    }
  }, [filteredRequisitions, selectedRequisitionId]);

  const activeRequisitionId = selectedRequisitionId ?? filteredRequisitions[0]?.id;
  const requisitionDetailQuery = useApiQuery<JobRequisition>(
    ['admin-recruiting-requisition-detail', activeRequisitionId],
    activeRequisitionId ? `/hr/recruiting/requisitions/${activeRequisitionId}` : '/hr/recruiting/requisitions/none',
    { enabled: Boolean(activeRequisitionId), retry: false },
  );
  const candidatesQuery = useApiQuery<Candidate[]>(
    ['admin-recruiting-candidates', activeRequisitionId],
    activeRequisitionId ? `/hr/recruiting/candidates?requisition=${activeRequisitionId}` : '/hr/recruiting/candidates',
    { enabled: Boolean(activeRequisitionId), retry: false },
  );
  const offersQuery = useApiQuery<RecruitingOffer[]>(
    ['admin-recruiting-offers', activeRequisitionId],
    activeRequisitionId ? `/hr/recruiting/offers?requisition=${activeRequisitionId}` : '/hr/recruiting/offers',
    { enabled: Boolean(activeRequisitionId), retry: false },
  );

  const trimmedInterviewerSearch = interviewerSearch.trim();
  const interviewerSearchQuery = useApiQuery<Worker[] | { items?: Worker[] }>(
    ['admin-recruiting-interviewer-search', trimmedInterviewerSearch],
    `/hr/core/workers?search=${encodeURIComponent(trimmedInterviewerSearch)}&pageSize=10`,
    { enabled: trimmedInterviewerSearch.length > 1, retry: false },
  );
  const interviewerResults = React.useMemo(
    () => normalizeWorkerList(interviewerSearchQuery.data).filter(
      (worker) => !selectedInterviewers.some((selected) => selected.id === worker.id),
    ),
    [interviewerSearchQuery.data, selectedInterviewers],
  );

  const invalidateKeys = React.useMemo(
    () => [
      ['admin-recruiting-requisitions', requisitionsPath],
      ['admin-recruiting-requisition-detail', activeRequisitionId],
      ['admin-recruiting-candidates', activeRequisitionId],
      ['admin-recruiting-offers', activeRequisitionId],
    ],
    [activeRequisitionId, requisitionsPath],
  );

  const createRequisitionMutation = useApiMutation<CommandResultView, Record<string, unknown>>(
    '/hr/recruiting/requisitions',
    'post',
    invalidateKeys,
    {
      onSuccess: (result) => {
        setLastCommand(result);
        setNewRequisitionTitle('');
        setNewRequisitionPositionId('');
        addNotification({ title: t('adminRecruiting.notifications.requisitionCreatedTitle'), message: commandSummary(result), type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: t('adminRecruiting.notifications.requisitionFailedTitle'), message: error.message, type: 'error', read: false }),
    },
  );

  const requisitionCommandMutation = useApiMutation<CommandResultView, RequisitionCommand>(
    (variables) => `/hr/recruiting/requisitions/${variables.requisitionId}/commands/${variables.command}`,
    'post',
    invalidateKeys,
    {
      onSuccess: (result) => {
        setLastCommand(result);
        addNotification({ title: t('adminRecruiting.notifications.requisitionUpdatedTitle'), message: commandSummary(result), type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: t('adminRecruiting.notifications.requisitionActionFailedTitle'), message: error.message, type: 'error', read: false }),
    },
  );

  const submitCandidateMutation = useApiMutation<CommandResultView, Record<string, unknown>>(
    '/hr/recruiting/candidates',
    'post',
    invalidateKeys,
    {
      onSuccess: (result) => {
        setLastCommand(result);
        setCandidateEmail('');
        setCandidateFullName('');
        addNotification({ title: t('adminRecruiting.notifications.candidateCreatedTitle'), message: commandSummary(result), type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: t('adminRecruiting.notifications.candidateFailedTitle'), message: error.message, type: 'error', read: false }),
    },
  );

  const resetInterviewForm = React.useCallback(() => {
    setInterviewerSearch('');
    setSelectedInterviewers([]);
    setScheduledAtLocal(defaultScheduledAt());
  }, []);

  const resetOfferForm = React.useCallback(() => {
    setOfferAmount('120000');
    setOfferStartDate(defaultOfferStartDate());
    setOfferCurrency(tenantCurrency);
    setOfferBenefits('');
  }, [tenantCurrency]);

  const candidateCommandMutation = useApiMutation<CommandResultView, CandidateCommand>(
    (variables) => `/hr/recruiting/candidates/${variables.candidateId}/commands/${variables.command}`,
    'post',
    invalidateKeys,
    {
      onSuccess: (result) => {
        setLastCommand(result);
        setInterviewDialogOpen(false);
        resetInterviewForm();
        addNotification({ title: t('adminRecruiting.notifications.candidateUpdatedTitle'), message: commandSummary(result), type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: t('adminRecruiting.notifications.candidateActionFailedTitle'), message: error.message, type: 'error', read: false }),
    },
  );

  const createOfferMutation = useApiMutation<CommandResultView, Record<string, unknown>>(
    '/hr/recruiting/offers',
    'post',
    invalidateKeys,
    {
      onSuccess: (result) => {
        setLastCommand(result);
        setOfferDialogOpen(false);
        resetOfferForm();
        addNotification({ title: t('adminRecruiting.notifications.offerCreatedTitle'), message: commandSummary(result), type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: t('adminRecruiting.notifications.offerFailedTitle'), message: error.message, type: 'error', read: false }),
    },
  );

  const offerCommandMutation = useApiMutation<CommandResultView, OfferCommand>(
    (variables) => `/hr/recruiting/offers/${variables.offerId}/commands/${variables.command}`,
    'post',
    invalidateKeys,
    {
      onSuccess: (result) => {
        setLastCommand(result);
        addNotification({ title: t('adminRecruiting.notifications.offerUpdatedTitle'), message: commandSummary(result), type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: t('adminRecruiting.notifications.offerActionFailedTitle'), message: error.message, type: 'error', read: false }),
    },
  );

  const candidates = React.useMemo(() => (candidatesQuery.data ?? []).map(normalizeCandidate), [candidatesQuery.data]);
  const offers = React.useMemo(() => (offersQuery.data ?? []).map(normalizeOffer), [offersQuery.data]);
  const selectedRequisition = React.useMemo(
    () => (requisitionDetailQuery.data ? normalizeRequisition(requisitionDetailQuery.data) : filteredRequisitions.find((requisition) => requisition.id === activeRequisitionId)),
    [activeRequisitionId, filteredRequisitions, requisitionDetailQuery.data],
  );
  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedCandidateId) ?? candidates[0];
  const selectedOffer = offers.find((offer) => offer.id === selectedOfferId) ?? offers[0];
  const pipelineCounts = React.useMemo(() => {
    return candidates.reduce<Record<string, number>>((acc, candidate) => {
      const status = normalizedCandidateStatus(candidate.status);
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});
  }, [candidates]);

  const createRequisition = () => {
    if (!newRequisitionTitle.trim() || !newRequisitionPositionId.trim()) return;
    createRequisitionMutation.mutate({
      requisitionId: generateUUID(),
      positionId: newRequisitionPositionId.trim(),
      title: newRequisitionTitle.trim(),
    });
  };

  const submitCandidate = () => {
    if (!activeRequisitionId || !candidateEmail.trim() || !candidateFullName.trim()) return;
    const [firstName, ...lastNameParts] = candidateFullName.trim().split(/\s+/);
    submitCandidateMutation.mutate({
      applicationId: generateUUID(),
      requisitionId: activeRequisitionId,
      candidateEmail: candidateEmail.trim(),
      candidateName: candidateFullName.trim(),
      firstName,
      lastName: lastNameParts.join(' '),
      source: 'ADMIN_RECRUITING',
    });
  };

  const screenCandidate = React.useCallback((candidate: Candidate) => {
    candidateCommandMutation.mutate({
      command: 'screen',
      candidateId: candidate.id,
      screenedByWorkerId: user?.id ?? '',
      outcome: 'QUALIFIED',
    });
  }, [candidateCommandMutation, user?.id]);

  const openScheduleInterview = React.useCallback((candidate: Candidate) => {
    setSelectedCandidateId(candidate.id);
    setInterviewDialogOpen(true);
  }, []);

  const submitScheduleInterview = () => {
    if (!selectedCandidate || !scheduledAtLocal || selectedInterviewers.length === 0) return;
    candidateCommandMutation.mutate({
      command: 'schedule-interview',
      candidateId: selectedCandidate.id,
      interviewId: generateUUID(),
      scheduledAt: new Date(scheduledAtLocal).toISOString(),
      interviewerWorkerIds: selectedInterviewers.map((interviewer) => interviewer.id),
      format: 'VIDEO',
    });
  };

  const createOffer = () => {
    if (!selectedCandidate) return;
    const parsedSalary = Number(offerAmount);
    if (!Number.isFinite(parsedSalary) || parsedSalary <= 0) {
      addNotification({ title: t('adminRecruiting.notifications.invalidSalaryTitle'), message: t('adminRecruiting.notifications.invalidSalaryMessage'), type: 'error', read: false });
      return;
    }
    if (!offerStartDate) {
      addNotification({ title: t('adminRecruiting.notifications.invalidStartDateTitle'), message: t('adminRecruiting.notifications.invalidStartDateMessage'), type: 'error', read: false });
      return;
    }
    createOfferMutation.mutate({
      offerId: generateUUID(),
      applicationId: selectedCandidate.id,
      proposedSalary: parsedSalary,
      currency: offerCurrency,
      startDate: offerStartDate,
      benefitsPackage: offerBenefits.trim() ? { summary: offerBenefits.trim() } : undefined,
    });
  };

  const requisitionColumns = React.useMemo<DataTableColumn<JobRequisition>[]>(() => [
    {
      key: 'title',
      header: t('adminRecruiting.table.requisition'),
      cell: (row) => (
        <button type="button" className="text-start font-semibold text-foreground hover:text-primary" onClick={() => setSelectedRequisitionId(row.id)}>
          {row.title}
          <span className="block text-xs font-medium text-muted-foreground">{row.requisitionNumber || row.requisitionId || row.id}</span>
        </button>
      ),
    },
    { key: 'position', header: t('adminRecruiting.table.position'), cell: (row) => row.positionId ?? '-' },
    { key: 'status', header: t('adminRecruiting.table.status'), cell: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: t('adminRecruiting.table.actions'),
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          {row.status === 'PENDING_APPROVAL' ? <Button variant="outline" size="sm" onClick={() => requisitionCommandMutation.mutate({ command: 'approve', requisitionId: row.id })}>{t('adminRecruiting.actions.approve')}</Button> : null}
          {row.status === 'APPROVED' ? <Button variant="outline" size="sm" onClick={() => requisitionCommandMutation.mutate({ command: 'publish', requisitionId: row.id })}>{t('adminRecruiting.actions.publish')}</Button> : null}
          {!['CLOSED', 'FILLED', 'REJECTED'].includes(row.status) ? <Button variant="ghost" size="sm" onClick={() => requisitionCommandMutation.mutate({ command: 'close', requisitionId: row.id, reason: 'Closed from recruiting admin workspace' })}>{t('adminRecruiting.actions.close')}</Button> : null}
        </div>
      ),
    },
  ], [requisitionCommandMutation, t]);

  const candidateColumns = React.useMemo<DataTableColumn<Candidate>[]>(() => [
    {
      key: 'name',
      header: t('adminRecruiting.table.candidate'),
      cell: (row) => (
        <button type="button" className="text-start font-semibold text-foreground hover:text-primary" onClick={() => setSelectedCandidateId(row.id)}>
          {candidateName(row)}
          <span className="block text-xs font-medium text-muted-foreground">{row.email || row.candidateEmail || row.id}</span>
        </button>
      ),
    },
    { key: 'stage', header: t('adminRecruiting.table.stage'), cell: (row) => <StatusBadge status={normalizedCandidateStatus(row.status)} /> },
    {
      key: 'next',
      header: t('adminRecruiting.table.nextAction'),
      cell: (row) => {
        const status = normalizedCandidateStatus(row.status);
        if (status === 'NEW') return <Button size="sm" disabled={!user?.id} onClick={() => screenCandidate(row)}>{t('adminRecruiting.actions.screen')}</Button>;
        if (status === 'SCREENING') return <Button size="sm" variant="outline" disabled={!user?.id} onClick={() => openScheduleInterview(row)}>{t('adminRecruiting.actions.scheduleInterview')}</Button>;
        if (status === 'INTERVIEWING') {
          return <Button size="sm" variant="outline" onClick={() => { setSelectedCandidateId(row.id); setOfferDialogOpen(true); }}>{t('adminRecruiting.actions.createOffer')}</Button>;
        }
        return <span className="text-sm text-muted-foreground">{t('adminRecruiting.empty.noAction')}</span>;
      },
    },
  ], [openScheduleInterview, screenCandidate, t, user?.id]);

  if (requisitionsQuery.isError) {
    return <ErrorState title={t('adminRecruiting.errors.loadTitle')} error={requisitionsQuery.error} onRetry={() => requisitionsQuery.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <BusinessPageHeader
        eyebrow={t('adminRecruiting.eyebrow')}
        icon={Briefcase}
        title={t('adminRecruiting.title')}
        subtitle={t('adminRecruiting.subtitle')}
        actions={(
          <Dialog>
            <DialogTrigger asChild>
              <Button>{t('adminRecruiting.actions.newRequisition')}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('adminRecruiting.forms.requisitionTitle')}</DialogTitle>
                <DialogDescription className="sr-only">{t('adminRecruiting.forms.requisitionDescription')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="recruiting-title">{t('adminRecruiting.forms.title')}</Label>
                  <Input id="recruiting-title" value={newRequisitionTitle} onChange={(event) => setNewRequisitionTitle(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recruiting-position">{t('adminRecruiting.forms.positionId')}</Label>
                  <Input id="recruiting-position" value={newRequisitionPositionId} onChange={(event) => setNewRequisitionPositionId(event.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createRequisition} disabled={createRequisitionMutation.isPending || !newRequisitionTitle.trim() || !newRequisitionPositionId.trim()}>
                  {t('adminRecruiting.actions.saveRequisition')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <BusinessMetric label={t('adminRecruiting.metrics.requisitions')} value={filteredRequisitions.length} />
        <BusinessMetric label={t('adminRecruiting.metrics.candidates')} value={candidates.length} />
        <BusinessMetric label={t('adminRecruiting.metrics.interviews')} value={pipelineCounts.INTERVIEWING ?? 0} tone="warning" />
        <BusinessMetric label={t('adminRecruiting.metrics.offers')} value={offers.length} tone="success" />
      </div>

      {lastCommand ? (
        <div className="rounded-2xl border border-border bg-muted px-4 py-3 text-sm font-semibold text-foreground">
          {commandSummary(lastCommand)}
        </div>
      ) : null}

      <h2 className="sr-only">{t('adminRecruiting.sections.workspace')}</h2>

      <Card>
        <CardHeader>
          <CardTitle>{t('adminRecruiting.sections.requisitions')}</CardTitle>
          <CardDescription>{t('adminRecruiting.sections.requisitionsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(12rem,1fr)_12rem_minmax(12rem,0.8fr)_minmax(12rem,0.8fr)]">
            <Input aria-label={t('adminRecruiting.filters.search')} placeholder={t('adminRecruiting.filters.search')} value={search} onChange={(event) => setSearch(event.target.value)} />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label={t('adminRecruiting.filters.status')}><SelectValue /></SelectTrigger>
              <SelectContent>{requisitionStatuses.map((status) => <SelectItem key={status} value={status}>{status === 'ALL' ? t('adminRecruiting.filters.allStatuses') : status.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
            </Select>
            <Input aria-label={t('adminRecruiting.filters.department')} placeholder={t('adminRecruiting.filters.department')} value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} />
            <Input aria-label={t('adminRecruiting.filters.position')} placeholder={t('adminRecruiting.filters.position')} value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)} />
          </div>
          <DataTable columns={requisitionColumns} data={filteredRequisitions} keyExtractor={(row) => row.id} isLoading={requisitionsQuery.isLoading} emptyMessage={t('adminRecruiting.empty.noRequisitions')} total={filteredRequisitions.length} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(22rem,0.7fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t('adminRecruiting.sections.pipeline')}</CardTitle>
            <CardDescription>{selectedRequisition?.title ?? t('adminRecruiting.empty.selectRequisition')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              {candidateStages.map((stage) => (
                <div key={stage} className="rounded-2xl border border-border bg-muted p-3 text-center">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{stage.replace(/_/g, ' ')}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{pipelineCounts[stage] ?? 0}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <Input aria-label={t('adminRecruiting.forms.candidateName')} placeholder={t('adminRecruiting.forms.candidateName')} value={candidateFullName} onChange={(event) => setCandidateFullName(event.target.value)} />
              <Input aria-label={t('adminRecruiting.forms.candidateEmail')} placeholder={t('adminRecruiting.forms.candidateEmail')} value={candidateEmail} onChange={(event) => setCandidateEmail(event.target.value)} />
              <Button onClick={submitCandidate} disabled={!activeRequisitionId || !candidateFullName.trim() || !candidateEmail.trim() || submitCandidateMutation.isPending}>{t('adminRecruiting.actions.addCandidate')}</Button>
            </div>
            <DataTable columns={candidateColumns} data={candidates} keyExtractor={(row) => row.id} isLoading={candidatesQuery.isLoading} emptyMessage={t('adminRecruiting.empty.noCandidates')} total={candidates.length} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('adminRecruiting.sections.selectedOffer')}</CardTitle>
            <CardDescription>{t('adminRecruiting.sections.selectedOfferDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedOffer ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-2xl font-bold">{formatCurrency(selectedOffer.proposedSalary, selectedOffer.currency ?? tenantCurrency)}</p>
                      <p className="text-sm text-muted-foreground">{t('adminRecruiting.fields.startDate', { date: formatDate(selectedOffer.startDate) })}</p>
                    </div>
                    <StatusBadge status={selectedOffer.status} />
                  </div>
                  <p className="mt-3 break-all text-xs text-muted-foreground">{selectedOffer.id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedOffer.status === 'PENDING_APPROVAL' ? <Button onClick={() => offerCommandMutation.mutate({ command: 'approve', offerId: selectedOffer.id })}>{t('adminRecruiting.actions.approveOffer')}</Button> : null}
                  {selectedOffer.status === 'APPROVED' ? <Button variant="outline" onClick={() => offerCommandMutation.mutate({ command: 'send', offerId: selectedOffer.id, sentAt: new Date().toISOString() })}>{t('adminRecruiting.actions.sendOffer')}</Button> : null}
                  {selectedOffer.status === 'SENT' ? <Button variant="outline" onClick={() => offerCommandMutation.mutate({ command: 'accept', offerId: selectedOffer.id, acceptedAt: new Date().toISOString() })}>{t('adminRecruiting.actions.acceptOffer')}</Button> : null}
                </div>
                <div className="space-y-2">
                  {offers.map((offer) => (
                    <button key={offer.id} type="button" className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3 text-start hover:bg-muted" onClick={() => setSelectedOfferId(offer.id)}>
                      <span className="font-semibold">{formatCurrency(offer.proposedSalary, offer.currency ?? tenantCurrency)}</span>
                      <StatusBadge status={offer.status} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState icon={Send} title={t('adminRecruiting.empty.noOffers')} description={t('adminRecruiting.empty.noOffersDescription')} />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={interviewDialogOpen}
        onOpenChange={(open) => {
          setInterviewDialogOpen(open);
          if (!open) resetInterviewForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('adminRecruiting.forms.interviewTitle', { candidate: selectedCandidate ? candidateName(selectedCandidate) : t('adminRecruiting.table.candidate') })}</DialogTitle>
            <DialogDescription className="sr-only">{t('adminRecruiting.forms.interviewDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="interview-datetime">{t('adminRecruiting.forms.scheduledAtLabel')}</Label>
              <Input
                id="interview-datetime"
                type="datetime-local"
                min={minScheduledAt}
                value={scheduledAtLocal}
                onChange={(event) => setScheduledAtLocal(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interviewer-search">{t('adminRecruiting.forms.interviewerSearchLabel')}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="interviewer-search"
                  className="ps-9"
                  value={interviewerSearch}
                  onChange={(event) => setInterviewerSearch(event.target.value)}
                  placeholder={t('adminRecruiting.forms.interviewerSearchPlaceholder')}
                />
              </div>
              {interviewerSearch.trim().length > 1 ? (
                <div className="max-h-40 overflow-auto rounded-xl border border-border">
                  {interviewerSearchQuery.isLoading ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">{t('adminRecruiting.forms.searching')}</p>
                  ) : interviewerResults.length ? (
                    interviewerResults.map((worker) => (
                      <button
                        key={worker.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-muted"
                        onClick={() => {
                          setSelectedInterviewers((current) => [...current, { id: worker.id, name: workerDisplayName(worker) }]);
                          setInterviewerSearch('');
                        }}
                      >
                        <span>{workerDisplayName(worker)}</span>
                        <span className="text-xs text-muted-foreground">{worker.email}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-sm text-muted-foreground">{t('adminRecruiting.forms.noInterviewersFound')}</p>
                  )}
                </div>
              ) : null}
              {selectedInterviewers.length ? (
                <div className="flex flex-wrap gap-2">
                  {selectedInterviewers.map((interviewer) => (
                    <Badge key={interviewer.id} variant="outline" className="flex items-center gap-1.5">
                      {interviewer.name}
                      <button
                        type="button"
                        aria-label={`Remove ${interviewer.name}`}
                        onClick={() => setSelectedInterviewers((current) => current.filter((item) => item.id !== interviewer.id))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t('adminRecruiting.forms.selectInterviewerHint')}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={submitScheduleInterview}
              disabled={candidateCommandMutation.isPending || !scheduledAtLocal || selectedInterviewers.length === 0}
            >
              {t('adminRecruiting.actions.confirmScheduleInterview')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={offerDialogOpen}
        onOpenChange={(open) => {
          setOfferDialogOpen(open);
          if (!open) resetOfferForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('adminRecruiting.forms.offerTitle', { candidate: selectedCandidate ? candidateName(selectedCandidate) : t('adminRecruiting.table.candidate') })}</DialogTitle>
            <DialogDescription className="sr-only">{t('adminRecruiting.forms.offerDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="offer-amount">{t('adminRecruiting.forms.proposedSalary')}</Label>
              <Input id="offer-amount" value={offerAmount} onChange={(event) => setOfferAmount(event.target.value)} inputMode="numeric" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="offer-start-date">{t('adminRecruiting.forms.offerStartDateLabel')}</Label>
                <Input
                  id="offer-start-date"
                  type="date"
                  min={minOfferStartDate}
                  value={offerStartDate}
                  onChange={(event) => setOfferStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer-currency">{t('adminRecruiting.forms.offerCurrencyLabel')}</Label>
                <Select value={offerCurrency} onValueChange={setOfferCurrency}>
                  <SelectTrigger id="offer-currency" aria-label={t('adminRecruiting.forms.offerCurrencyLabel')}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="offer-benefits">{t('adminRecruiting.forms.offerBenefitsLabel')}</Label>
              <Input
                id="offer-benefits"
                value={offerBenefits}
                onChange={(event) => setOfferBenefits(event.target.value)}
                placeholder={t('adminRecruiting.forms.offerBenefitsPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createOffer} disabled={createOfferMutation.isPending || !selectedCandidate}>
              {t('adminRecruiting.actions.createOffer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminRecruiting;
