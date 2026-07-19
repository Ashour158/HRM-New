import * as React from 'react';
import { Briefcase, CalendarClock, CheckCircle2, Search, Send, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { formatDate, generateUUID } from '@/lib/utils';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { useTenant } from '@/hooks/use-tenant';
import { useUIStore } from '@/stores/ui-store';
import type { Worker } from '@/types';

type RequisitionStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'OPEN' | 'FILLED' | 'CLOSED' | 'REJECTED';
type CandidateStatus = 'NEW' | 'SCREENING' | 'INTERVIEWING' | 'INTERVIEW' | 'OFFER_PENDING' | 'HIRED' | 'REJECTED' | 'WITHDRAWN';
type OfferStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'WITHDRAWN';

interface JobRequisition {
  id: string;
  requisitionId?: string;
  requisitionNumber?: string;
  positionId?: string;
  title: string;
  description?: string;
  status: RequisitionStatus | string;
  version?: number;
  allowedNextActions?: string[];
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
  allowedNextActions?: string[];
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
  allowedNextActions?: string[];
}

interface CommandResultView {
  newState?: string;
  allowedNextActions?: string[];
  message?: string;
}

type CandidateCommand =
  | { command: 'screen'; candidateId: string; outcome: string }
  | { command: 'schedule-interview'; candidateId: string; interviewId: string; scheduledAt: string; interviewerWorkerIds: string[]; format: 'PHONE' | 'VIDEO' | 'ONSITE' | 'PANEL' | 'TAKE_HOME' };

type RequisitionCommand = { command: 'approve' | 'publish' | 'close'; requisitionId: string };
type OfferCommand = { command: 'approve' | 'send' | 'accept'; offerId: string };

function statusBadgeTone(status: string) {
  if (['OPEN', 'APPROVED', 'PUBLISHED', 'HIRED', 'ACCEPTED'].includes(status)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['REJECTED', 'WITHDRAWN', 'DECLINED', 'CLOSED', 'EXPIRED'].includes(status)) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (['SCREENING', 'INTERVIEWING', 'INTERVIEW', 'OFFER_PENDING', 'PENDING_APPROVAL', 'SENT'].includes(status)) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function candidateName(candidate: Candidate) {
  const joined = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim();
  return candidate.candidateName || joined || candidate.email || candidate.candidateEmail || 'Candidate';
}

function normalizedCandidateStatus(status: string) {
  return status === 'INTERVIEW' ? 'INTERVIEWING' : status;
}

function stageLabel(status: string) {
  if (status === 'NEW') return 'New';
  if (status === 'INTERVIEWING') return 'Interview';
  return status.replace(/_/g, ' ');
}

function commandSummary(result: CommandResultView | null) {
  if (!result) return null;
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

export function RecruiterWorkspace() {
  const addNotification = useUIStore((state) => state.addNotification);
  const { tenantConfig } = useTenant();
  const tenantCurrency = tenantConfig.currency;
  const [selectedRequisitionId, setSelectedRequisitionId] = React.useState<string | undefined>();
  const [selectedCandidateId, setSelectedCandidateId] = React.useState<string | undefined>();
  const [lastCommand, setLastCommand] = React.useState<CommandResultView | null>(null);
  const [offerDialogOpen, setOfferDialogOpen] = React.useState(false);
  const [offerAmount, setOfferAmount] = React.useState('120000');
  const [offerStartDate, setOfferStartDate] = React.useState(defaultOfferStartDate);
  const [offerCurrency, setOfferCurrency] = React.useState(tenantCurrency);
  const [offerBenefits, setOfferBenefits] = React.useState('');
  const [interviewDialogOpen, setInterviewDialogOpen] = React.useState(false);
  const [interviewCandidateId, setInterviewCandidateId] = React.useState<string | undefined>();
  const [interviewerSearch, setInterviewerSearch] = React.useState('');
  const [selectedInterviewers, setSelectedInterviewers] = React.useState<{ id: string; name: string }[]>([]);
  const [scheduledAtLocal, setScheduledAtLocal] = React.useState(defaultScheduledAt);

  const currencyOptions = React.useMemo(
    () => Array.from(new Set([tenantCurrency, ...OFFER_CURRENCY_OPTIONS])),
    [tenantCurrency],
  );
  const minScheduledAt = toDateTimeLocalValue(new Date());
  const minOfferStartDate = toDateInputValue(new Date());

  const requisitionsQuery = useApiQuery<JobRequisition[]>(
    ['recruiter-requisitions'],
    '/hr/recruiting/requisitions/open',
    { retry: false },
  );

  const requisitions = React.useMemo(() => requisitionsQuery.data ?? [], [requisitionsQuery.data]);
  const activeRequisitionId = selectedRequisitionId ?? requisitions[0]?.id;

  React.useEffect(() => {
    if (!selectedRequisitionId && requisitions[0]?.id) {
      setSelectedRequisitionId(requisitions[0].id);
    }
  }, [requisitions, selectedRequisitionId]);

  const requisitionDetailQuery = useApiQuery<JobRequisition>(
    ['recruiter-requisition-detail', activeRequisitionId],
    activeRequisitionId ? `/hr/recruiting/requisitions/${activeRequisitionId}` : '/hr/recruiting/requisitions/none',
    { enabled: Boolean(activeRequisitionId), retry: false },
  );

  const candidatesQuery = useApiQuery<Candidate[]>(
    ['recruiter-candidates', activeRequisitionId],
    activeRequisitionId ? `/hr/recruiting/candidates?requisition=${activeRequisitionId}` : '/hr/recruiting/candidates',
    { enabled: Boolean(activeRequisitionId), retry: false },
  );

  const offersQuery = useApiQuery<RecruitingOffer[]>(
    ['recruiter-offers', activeRequisitionId],
    activeRequisitionId ? `/hr/recruiting/offers?requisition=${activeRequisitionId}` : '/hr/recruiting/offers',
    { enabled: Boolean(activeRequisitionId), retry: false },
  );

  const trimmedInterviewerSearch = interviewerSearch.trim();
  const interviewerSearchQuery = useApiQuery<Worker[] | { items?: Worker[] }>(
    ['recruiter-interviewer-search', trimmedInterviewerSearch],
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
      ['recruiter-requisitions'],
      ['recruiter-requisition-detail', activeRequisitionId],
      ['recruiter-candidates', activeRequisitionId],
      ['recruiter-offers', activeRequisitionId],
    ],
    [activeRequisitionId],
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
        addNotification({ title: 'Candidate updated', message: commandSummary(result) ?? 'Pipeline state changed.', type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: 'Candidate action failed', message: error.message, type: 'error', read: false }),
    },
  );

  const requisitionCommandMutation = useApiMutation<CommandResultView, RequisitionCommand>(
    (variables) => `/hr/recruiting/requisitions/${variables.requisitionId}/commands/${variables.command}`,
    'post',
    invalidateKeys,
    {
      onSuccess: (result) => {
        setLastCommand(result);
        addNotification({ title: 'Requisition updated', message: commandSummary(result) ?? 'Requisition state changed.', type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: 'Requisition action failed', message: error.message, type: 'error', read: false }),
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
        addNotification({ title: 'Offer created', message: commandSummary(result) ?? 'Offer is ready for approval.', type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: 'Offer creation failed', message: error.message, type: 'error', read: false }),
    },
  );

  const offerCommandMutation = useApiMutation<CommandResultView, OfferCommand>(
    (variables) => `/hr/recruiting/offers/${variables.offerId}/commands/${variables.command}`,
    'post',
    invalidateKeys,
    {
      onSuccess: (result) => {
        setLastCommand(result);
        addNotification({ title: 'Offer updated', message: commandSummary(result) ?? 'Offer state changed.', type: 'success', read: false });
      },
      onError: (error) => addNotification({ title: 'Offer action failed', message: error.message, type: 'error', read: false }),
    },
  );

  const candidates = React.useMemo(() => candidatesQuery.data ?? [], [candidatesQuery.data]);
  const offers = offersQuery.data ?? [];
  const selectedRequisition = requisitionDetailQuery.data ?? requisitions.find((requisition) => requisition.id === activeRequisitionId);
  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedCandidateId) ?? candidates[0];
  const pipelineCounts = React.useMemo(() => {
    return candidates.reduce<Record<string, number>>((acc, candidate) => {
      const status = normalizedCandidateStatus(candidate.status);
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});
  }, [candidates]);

  const screenCandidate = (candidate: Candidate) => {
    candidateCommandMutation.mutateAsync({
      command: 'screen',
      candidateId: candidate.id,
      outcome: 'QUALIFIED',
    });
  };

  const submitScheduleInterview = () => {
    if (!interviewCandidateId || !scheduledAtLocal || selectedInterviewers.length === 0) return;
    candidateCommandMutation.mutateAsync({
      command: 'schedule-interview',
      candidateId: interviewCandidateId,
      interviewId: generateUUID(),
      scheduledAt: new Date(scheduledAtLocal).toISOString(),
      interviewerWorkerIds: selectedInterviewers.map((interviewer) => interviewer.id),
      format: 'VIDEO',
    });
  };

  const createOffer = () => {
    if (!selectedCandidate || !activeRequisitionId) return;
    const parsedSalary = Number(offerAmount);
    if (!Number.isFinite(parsedSalary) || parsedSalary <= 0) {
      addNotification({
        title: 'Invalid salary',
        message: 'Enter a valid positive salary amount before creating the offer.',
        type: 'error',
        read: false,
      });
      return;
    }
    if (!offerStartDate) {
      addNotification({
        title: 'Start date required',
        message: 'Choose a start date before creating the offer.',
        type: 'error',
        read: false,
      });
      return;
    }
    createOfferMutation.mutateAsync({
      offerId: generateUUID(),
      applicationId: selectedCandidate.id,
      requisitionId: activeRequisitionId,
      proposedSalary: parsedSalary,
      currency: offerCurrency,
      startDate: offerStartDate,
      benefitsPackage: offerBenefits.trim() ? { summary: offerBenefits.trim() } : undefined,
    });
  };

  const requisitionColumns: DataTableColumn<JobRequisition>[] = [
    {
      key: 'title',
      header: 'Requisition',
      cell: (row) => (
        <button className="text-left font-semibold text-slate-900 hover:text-indigo-700" onClick={() => setSelectedRequisitionId(row.id)}>
          {row.title}
          <span className="block text-xs font-medium text-slate-500">{row.requisitionNumber || row.requisitionId || row.id}</span>
        </button>
      ),
    },
    { key: 'status', header: 'Status', cell: (row) => <Badge className={statusBadgeTone(row.status)}>{row.status}</Badge> },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => requisitionCommandMutation.mutateAsync({ command: 'approve', requisitionId: row.id })}>Approve</Button>
          <Button variant="outline" size="sm" onClick={() => requisitionCommandMutation.mutateAsync({ command: 'publish', requisitionId: row.id })}>Publish</Button>
          <Button variant="ghost" size="sm" onClick={() => requisitionCommandMutation.mutateAsync({ command: 'close', requisitionId: row.id })}>Close</Button>
        </div>
      ),
    },
  ];

  const candidateColumns: DataTableColumn<Candidate>[] = [
    {
      key: 'name',
      header: 'Candidate',
      cell: (row) => (
        <button className="text-left font-semibold text-slate-900 hover:text-indigo-700" onClick={() => setSelectedCandidateId(row.id)}>
          {candidateName(row)}
          <span className="block text-xs font-medium text-slate-500">{row.email || row.candidateEmail || row.id}</span>
        </button>
      ),
    },
    { key: 'status', header: 'Stage', cell: (row) => <Badge className={statusBadgeTone(normalizedCandidateStatus(row.status))}>{stageLabel(normalizedCandidateStatus(row.status))}</Badge> },
    {
      key: 'actions',
      header: 'Next action',
      cell: (row) => {
        const status = normalizedCandidateStatus(row.status);
        if (status === 'NEW') return <Button size="sm" onClick={() => screenCandidate(row)}>Screen candidate</Button>;
        if (status === 'SCREENING') {
          return (
            <Dialog
              open={interviewDialogOpen && interviewCandidateId === row.id}
              onOpenChange={(open) => {
                setInterviewCandidateId(row.id);
                setInterviewDialogOpen(open);
                if (!open) resetInterviewForm();
              }}
            >
              <DialogTrigger asChild><Button size="sm" variant="outline">Schedule interview</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule interview with {candidateName(row)}</DialogTitle>
                  <DialogDescription className="sr-only">Search for interviewers and choose a date and time before scheduling.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="interview-datetime">Date &amp; time</Label>
                    <Input
                      id="interview-datetime"
                      type="datetime-local"
                      min={minScheduledAt}
                      value={scheduledAtLocal}
                      onChange={(event) => setScheduledAtLocal(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interviewer-search">Interviewers</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="interviewer-search"
                        className="pl-9"
                        value={interviewerSearch}
                        onChange={(event) => setInterviewerSearch(event.target.value)}
                        placeholder="Search by name or email"
                      />
                    </div>
                    {interviewerSearch.trim().length > 1 ? (
                      <div className="max-h-40 overflow-auto rounded-lg border border-slate-200">
                        {interviewerSearchQuery.isLoading ? (
                          <p className="px-3 py-2 text-sm text-slate-500">Searching…</p>
                        ) : interviewerResults.length ? (
                          interviewerResults.map((worker) => (
                            <button
                              key={worker.id}
                              type="button"
                              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                              onClick={() => {
                                setSelectedInterviewers((current) => [...current, { id: worker.id, name: workerDisplayName(worker) }]);
                                setInterviewerSearch('');
                              }}
                            >
                              <span>{workerDisplayName(worker)}</span>
                              <span className="text-xs text-slate-500">{worker.email}</span>
                            </button>
                          ))
                        ) : (
                          <p className="px-3 py-2 text-sm text-slate-500">No matching workers</p>
                        )}
                      </div>
                    ) : null}
                    {selectedInterviewers.length ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedInterviewers.map((interviewer) => (
                          <Badge key={interviewer.id} className="flex items-center gap-1.5 border-slate-200 bg-slate-100 text-slate-700">
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
                      <p className="text-xs text-slate-500">Search and select at least one interviewer.</p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={submitScheduleInterview}
                    disabled={candidateCommandMutation.isPending || !scheduledAtLocal || selectedInterviewers.length === 0}
                  >
                    Schedule interview
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        }
        if (status === 'INTERVIEWING') {
          return (
            <Dialog
              open={offerDialogOpen && selectedCandidate?.id === row.id}
              onOpenChange={(open) => {
                setSelectedCandidateId(row.id);
                setOfferDialogOpen(open);
                if (!open) resetOfferForm();
              }}
            >
              <DialogTrigger asChild><Button size="sm" variant="outline">Create offer</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create offer for {candidateName(row)}</DialogTitle>
                  <DialogDescription className="sr-only">Set the proposed salary, start date, currency, and benefits before creating the offer.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="offer-amount">Proposed salary</Label>
                    <Input id="offer-amount" value={offerAmount} onChange={(event) => setOfferAmount(event.target.value)} inputMode="numeric" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="offer-start-date">Start date</Label>
                      <Input
                        id="offer-start-date"
                        type="date"
                        min={minOfferStartDate}
                        value={offerStartDate}
                        onChange={(event) => setOfferStartDate(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="offer-currency">Currency</Label>
                      <Select value={offerCurrency} onValueChange={setOfferCurrency}>
                        <SelectTrigger id="offer-currency" aria-label="Currency"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {currencyOptions.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="offer-benefits">Benefits summary</Label>
                    <Input
                      id="offer-benefits"
                      value={offerBenefits}
                      onChange={(event) => setOfferBenefits(event.target.value)}
                      placeholder="e.g. Health, dental, 20 PTO days"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={createOffer} disabled={createOfferMutation.isPending}>Create offer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        }
        return <span className="text-sm text-slate-500">No action</span>;
      },
    },
  ];

  if (requisitionsQuery.isError) {
    return <ErrorState title="Unable to load recruiting workspace" error={requisitionsQuery.error} onRetry={() => requisitionsQuery.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-headline text-3xl font-extrabold text-slate-950">Recruiting Workspace</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Manage requisitions, candidate stages, interviews, and offers.</p>
        </div>
        <Button variant="outline" onClick={() => selectedRequisition && requisitionCommandMutation.mutateAsync({ command: 'publish', requisitionId: selectedRequisition.id })}>
          <Send className="mr-2 h-4 w-4" />
          Publish selected requisition
        </Button>
      </div>

      {/* Establishes the h2 level between the page h1 and the card titles (h3) below,
          so the heading order is valid (a11y: heading-order). */}
      <h2 className="sr-only">Recruiting workspace sections</h2>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-3xl border-white/60 bg-white/70 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Open reqs</p><p className="text-3xl font-extrabold text-slate-950">{requisitions.length}</p></div>
            <Briefcase className="h-8 w-8 text-indigo-500" />
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-white/60 bg-white/70 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Candidates</p><p className="text-3xl font-extrabold text-slate-950">{candidates.length}</p></div>
            <Users className="h-8 w-8 text-violet-500" />
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-white/60 bg-white/70 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Interviews</p><p className="text-3xl font-extrabold text-slate-950">{pipelineCounts.INTERVIEWING ?? 0}</p></div>
            <CalendarClock className="h-8 w-8 text-amber-500" />
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-white/60 bg-white/70 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Offers</p><p className="text-3xl font-extrabold text-slate-950">{offers.length}</p></div>
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </CardContent>
        </Card>
      </div>

      {lastCommand ? (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800">
          {commandSummary(lastCommand)}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
        <Card className="rounded-3xl border-white/60 bg-white/75 shadow-sm">
          <CardHeader><CardTitle>Requisitions</CardTitle></CardHeader>
          <CardContent>
            {requisitions.length ? (
              <DataTable columns={requisitionColumns} data={requisitions} keyExtractor={(row) => row.id} isLoading={requisitionsQuery.isLoading} total={requisitions.length} />
            ) : (
              <EmptyState icon={Briefcase} title="No open requisitions" description="Approved and published requisitions will appear here." />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/60 bg-white/75 shadow-sm">
          <CardHeader><CardTitle>Pipeline funnel</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {['NEW', 'SCREENING', 'INTERVIEWING', 'OFFER_PENDING', 'HIRED'].map((stage) => (
              <div key={stage} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500">{stage === 'INTERVIEWING' ? 'INTERVIEW' : stage}</span>
                <span className="text-xl font-extrabold text-slate-950">{pipelineCounts[stage] ?? 0}</span>
              </div>
            ))}
            {selectedRequisition ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold text-slate-900">Selected requisition</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{selectedRequisition.description || 'Pipeline activity is scoped to this requisition.'}</p>
                <Badge className={`mt-3 ${statusBadgeTone(selectedRequisition.status)}`}>{selectedRequisition.status}</Badge>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border-white/60 bg-white/75 shadow-sm">
        <CardHeader><CardTitle>Candidate pipeline</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={candidateColumns} data={candidates} keyExtractor={(row) => row.id} isLoading={candidatesQuery.isLoading} emptyMessage="No candidates for this requisition" total={candidates.length} />
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-white/60 bg-white/75 shadow-sm">
        <CardHeader><CardTitle>Offers</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {offers.length ? offers.map((offer) => (
            <div key={offer.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{offer.currency ?? tenantCurrency} {offer.proposedSalary ?? '-'}</p>
                  <p className="text-xs font-medium text-slate-500">Start {formatDate(offer.startDate)}</p>
                </div>
                <Badge className={statusBadgeTone(offer.status)}>{offer.status}</Badge>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => offerCommandMutation.mutateAsync({ command: 'approve', offerId: offer.id })}>Approve offer</Button>
                <Button size="sm" variant="outline" onClick={() => offerCommandMutation.mutateAsync({ command: 'send', offerId: offer.id })}>Send</Button>
              </div>
            </div>
          )) : (
            <EmptyState icon={Send} title="No offers yet" description="Create an offer from an interviewed candidate." className="md:col-span-2" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default RecruiterWorkspace;
