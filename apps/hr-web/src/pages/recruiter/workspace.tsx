import * as React from 'react';
import { Briefcase, CalendarClock, CheckCircle2, Send, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { formatDate, generateUUID } from '@/lib/utils';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { useUIStore } from '@/stores/ui-store';

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

export function RecruiterWorkspace() {
  const addNotification = useUIStore((state) => state.addNotification);
  const [selectedRequisitionId, setSelectedRequisitionId] = React.useState<string | undefined>();
  const [selectedCandidateId, setSelectedCandidateId] = React.useState<string | undefined>();
  const [lastCommand, setLastCommand] = React.useState<CommandResultView | null>(null);
  const [offerDialogOpen, setOfferDialogOpen] = React.useState(false);
  const [offerAmount, setOfferAmount] = React.useState('120000');

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

  const invalidateKeys = React.useMemo(
    () => [
      ['recruiter-requisitions'],
      ['recruiter-requisition-detail', activeRequisitionId],
      ['recruiter-candidates', activeRequisitionId],
      ['recruiter-offers', activeRequisitionId],
    ],
    [activeRequisitionId],
  );

  const candidateCommandMutation = useApiMutation<CommandResultView, CandidateCommand>(
    (variables) => `/hr/recruiting/candidates/${variables.candidateId}/commands/${variables.command}`,
    'post',
    invalidateKeys,
    {
      onSuccess: (result) => {
        setLastCommand(result);
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

  const scheduleInterview = (candidate: Candidate) => {
    candidateCommandMutation.mutateAsync({
      command: 'schedule-interview',
      candidateId: candidate.id,
      interviewId: generateUUID(),
      scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      interviewerWorkerIds: ['00000000-0000-0000-0000-000000000001'],
      format: 'VIDEO',
    });
  };

  const createOffer = () => {
    if (!selectedCandidate || !activeRequisitionId) return;
    createOfferMutation.mutateAsync({
      offerId: generateUUID(),
      candidateId: selectedCandidate.id,
      requisitionId: activeRequisitionId,
      proposedSalary: Number(offerAmount || 0),
      currency: 'EGP',
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      benefitsPackage: 'Standard employment benefits',
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
        if (status === 'SCREENING') return <Button size="sm" variant="outline" onClick={() => scheduleInterview(row)}>Schedule interview</Button>;
        if (status === 'INTERVIEWING') {
          return (
            <Dialog open={offerDialogOpen && selectedCandidate?.id === row.id} onOpenChange={(open) => { setSelectedCandidateId(row.id); setOfferDialogOpen(open); }}>
              <DialogTrigger asChild><Button size="sm" variant="outline">Create offer</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create offer for {candidateName(row)}</DialogTitle></DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="offer-amount">Proposed salary</Label>
                  <Input id="offer-amount" value={offerAmount} onChange={(event) => setOfferAmount(event.target.value)} inputMode="numeric" />
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
                  <p className="font-semibold text-slate-900">{offer.currency ?? 'EGP'} {offer.proposedSalary ?? '-'}</p>
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
