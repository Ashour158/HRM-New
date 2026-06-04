import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Inbox,
  MailWarning,
  RefreshCcw,
  Search,
  ShieldCheck,
  SkipForward,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type InboxStatus = 'IN_PROGRESS' | 'FAILED_RETRYABLE' | 'FAILED_NON_RETRYABLE' | 'SKIPPED' | 'SUCCESS';
type OutboxStatus = 'PENDING' | 'EXHAUSTED' | 'PUBLISHED' | 'OPERATOR_SKIPPED';
type Queue = 'inbox' | 'outbox';

interface DeadLetterSummary {
  generatedAt: string;
  inbox: {
    failedRetryable: number;
    failedNonRetryable: number;
    inProgress: number;
    skipped: number;
    success: number;
    totalNonSuccess: number;
  };
  outbox: {
    pending: number;
    exhausted: number;
    operatorSkipped: number;
    published: number;
    totalUnresolved: number;
  };
}

interface InboxEventRow {
  queue: 'inbox';
  id: string;
  status: InboxStatus;
  consumerName: string;
  consumerVersion: string;
  sourceEventId: string;
  sourceTopic: string;
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  retryCount: number;
  nextRetryAt: string | null;
  errorSummary: string | null;
  processedAt: string | null;
  createdAt: string;
}

interface OutboxEventRow {
  queue: 'outbox';
  id: string;
  status: OutboxStatus;
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  correlationId: string | null;
  causationId: string | null;
  publishAttemptCount: number;
  publishedAt: string | null;
  createdAt: string;
  metadata: unknown;
  payload: unknown;
  operatorAction: unknown | null;
}

interface CommandResult {
  action: string;
  id: string;
  status: string;
  replayed?: number;
  published?: number;
}

interface BulkCommandResult {
  action: string;
  queue: Queue;
  command: 'retry' | 'skip';
  requested: number;
  succeeded: number;
  failed: Array<{ id: string; error: string }>;
  results: CommandResult[];
}

function unwrapApiData<T>(response: { data: unknown }): T {
  const envelope = response.data as { data?: T; success?: boolean };
  if (envelope && typeof envelope === 'object' && envelope.success === true && 'data' in envelope) {
    return envelope.data as T;
  }
  return response.data as T;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusClasses(status: string) {
  if (status === 'FAILED_NON_RETRYABLE' || status === 'EXHAUSTED') {
    return 'border-[#ba1a1a]/30 bg-[#ba1a1a]/10 text-[#ba1a1a]';
  }
  if (status === 'FAILED_RETRYABLE' || status === 'PENDING' || status === 'IN_PROGRESS') {
    return 'border-[#e29100]/30 bg-[#ffddb8]/60 text-[#523200]';
  }
  if (status === 'SKIPPED' || status === 'OPERATOR_SKIPPED') {
    return 'border-[#4648d4]/30 bg-[#4648d4]/10 text-[#4648d4]';
  }
  return 'border-[#10b981]/30 bg-[#10b981]/10 text-[#006c49]';
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(status)}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

export function AdminDeadLetterEvents() {
  const queryClient = useQueryClient();
  const [queue, setQueue] = React.useState<Queue>('inbox');
  const [inboxStatus, setInboxStatus] = React.useState<InboxStatus | 'ALL'>('FAILED_NON_RETRYABLE');
  const [outboxStatus, setOutboxStatus] = React.useState<OutboxStatus | 'ALL'>('EXHAUSTED');
  const [consumerName, setConsumerName] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<InboxEventRow | OutboxEventRow | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [operatorReason, setOperatorReason] = React.useState('');

  const summaryQuery = useQuery({
    queryKey: ['dead-letter-summary'],
    queryFn: async () => unwrapApiData<DeadLetterSummary>(await apiClient.get('/admin/dead-letter/summary')),
  });
  const inboxQuery = useQuery({
    queryKey: ['dead-letter-inbox', inboxStatus, consumerName, search],
    queryFn: async () => unwrapApiData<InboxEventRow[]>(await apiClient.get('/admin/dead-letter/inbox', {
      params: {
        status: inboxStatus === 'ALL' ? undefined : inboxStatus,
        consumerName: consumerName || undefined,
        search: search || undefined,
        limit: 100,
      },
    })),
  });
  const outboxQuery = useQuery({
    queryKey: ['dead-letter-outbox', outboxStatus, search],
    queryFn: async () => unwrapApiData<OutboxEventRow[]>(await apiClient.get('/admin/dead-letter/outbox', {
      params: {
        status: outboxStatus === 'ALL' ? undefined : outboxStatus,
        search: search || undefined,
        limit: 100,
      },
    })),
  });

  const refreshAll = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dead-letter-summary'] });
    queryClient.invalidateQueries({ queryKey: ['dead-letter-inbox'] });
    queryClient.invalidateQueries({ queryKey: ['dead-letter-outbox'] });
  }, [queryClient]);

  const runCommand = useMutation({
    mutationFn: async ({ targetQueue, id, command, reason }: { targetQueue: Queue; id: string; command: 'retry' | 'skip'; reason: string }) => {
      const response = await apiClient.post(`/admin/dead-letter/${targetQueue}/${id}/commands/${command}`, { reason });
      return unwrapApiData<CommandResult>(response);
    },
    onSuccess: () => {
      refreshAll();
      setOperatorReason('');
    },
  });

  const runBulkCommand = useMutation({
    mutationFn: async ({ targetQueue, ids, command, reason }: { targetQueue: Queue; ids: string[]; command: 'retry' | 'skip'; reason: string }) => {
      const response = await apiClient.post(`/admin/dead-letter/${targetQueue}/commands/bulk`, { ids, command, reason });
      return unwrapApiData<BulkCommandResult>(response);
    },
    onSuccess: () => {
      refreshAll();
      setSelectedIds(new Set());
      setOperatorReason('');
    },
  });

  const activeRows = queue === 'inbox' ? inboxQuery.data ?? [] : outboxQuery.data ?? [];
  const activeLoading = queue === 'inbox' ? inboxQuery.isLoading : outboxQuery.isLoading;
  const activeStatus = queue === 'inbox' ? inboxStatus : outboxStatus;
  const selectedQueue = selected?.queue ?? queue;
  const reasonRequired = selectedQueue === 'outbox' || selected?.status === 'FAILED_NON_RETRYABLE' || selected?.status === 'EXHAUSTED';
  const commandDisabled = !selected || runCommand.isPending || (reasonRequired && operatorReason.trim().length < 8);
  const activeRowIds = React.useMemo(() => activeRows.map((row) => row.id), [activeRows]);
  const allVisibleSelected = activeRowIds.length > 0 && activeRowIds.every((id) => selectedIds.has(id));
  const bulkDisabled = selectedIds.size === 0 || runBulkCommand.isPending;
  const bulkSkipDisabled = bulkDisabled || operatorReason.trim().length < 8;
  const redactedEvidence = React.useMemo(() => {
    if (!selected) return null;
    if (selected.queue === 'outbox') {
      return {
        ...selected,
        payload: '[redacted in UI export - use controlled CSV or database audit access]',
        metadata: selected.operatorAction ? { deadLetterOperator: selected.operatorAction } : '[redacted in UI]',
      };
    }
    return selected;
  }, [selected]);

  React.useEffect(() => {
    setSelected(null);
    setSelectedIds(new Set());
    setOperatorReason('');
  }, [queue, inboxStatus, outboxStatus, consumerName, search]);

  const exportCsv = async () => {
    const response = await apiClient.get('/admin/dead-letter/export.csv', {
      responseType: 'blob',
      params: {
        queue,
        status: activeStatus === 'ALL' ? undefined : activeStatus,
        consumerName: queue === 'inbox' && consumerName ? consumerName : undefined,
        search: search || undefined,
        limit: 1000,
      },
    });
    downloadBlob(response.data as Blob, `dead-letter-events-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const toggleVisibleRows = (checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const id of activeRowIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectedIdList = React.useCallback(() => Array.from(selectedIds), [selectedIds]);

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#bbcabf] bg-white px-3 py-1 font-mono text-xs uppercase tracking-wider text-[#3c4a42]">
              <MailWarning className="h-3.5 w-3.5 text-[#ba1a1a]" />
              System Console
            </div>
            <h2 className="mt-3 font-headline text-4xl font-bold text-[#0b1c30]">Dead-Letter Events</h2>
            <p className="mt-2 max-w-3xl text-lg leading-8 text-[#3c4a42]">
              Inspect failed inbox consumers and exhausted outbox events, then retry or skip them with operator evidence.
              Retryable inbox rows remain separated from true intervention rows.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild type="button" variant="outline">
              <Link to="/admin/system-console">
                <ArrowLeft className="mr-2 h-4 w-4" />
                System Console
              </Link>
            </Button>
            <Button type="button" variant="outline" onClick={refreshAll}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button type="button" onClick={() => void exportCsv()}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'Inbox Intervention',
              value: String(summaryQuery.data?.inbox.failedNonRetryable ?? '-'),
              helper: 'FAILED_NON_RETRYABLE rows',
              icon: AlertTriangle,
              tone: 'text-[#ba1a1a]',
            },
            {
              label: 'Inbox Auto-Replay',
              value: String(summaryQuery.data?.inbox.failedRetryable ?? '-'),
              helper: 'FAILED_RETRYABLE rows',
              icon: RefreshCcw,
              tone: 'text-[#e29100]',
            },
            {
              label: 'Outbox Exhausted',
              value: String(summaryQuery.data?.outbox.exhausted ?? '-'),
              helper: 'Unpublished with max attempts',
              icon: MailWarning,
              tone: 'text-[#ba1a1a]',
            },
            {
              label: 'Resolved / Skipped',
              value: String((summaryQuery.data?.inbox.skipped ?? 0) + (summaryQuery.data?.outbox.operatorSkipped ?? 0)),
              helper: 'Operator resolved rows',
              icon: CheckCircle2,
              tone: 'text-[#006c49]',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="relative overflow-hidden">
                <div className="absolute left-0 top-0 h-1 w-full bg-[#10b981]" />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-wider text-[#3c4a42]">{item.label}</p>
                      <p className="mt-2 font-headline text-4xl font-bold text-[#0b1c30]">
                        {summaryQuery.isLoading ? '-' : item.value}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#3c4a42]">{item.helper}</p>
                    </div>
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#eff4ff]">
                      <Icon className={`h-5 w-5 ${item.tone}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_26rem]">
          <Card className="relative overflow-hidden">
            <div className="absolute left-0 top-0 h-1 w-full bg-[#006c49]" />
            <CardHeader className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Inbox className="h-5 w-5 text-[#006c49]" />
                    Operator Queue
                  </CardTitle>
                  <CardDescription>
                    Select a row to inspect payload evidence and run controlled retry or skip actions.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant={queue === 'inbox' ? 'default' : 'outline'} onClick={() => setQueue('inbox')}>
                    Failed Inbox
                  </Button>
                  <Button type="button" variant={queue === 'outbox' ? 'default' : 'outline'} onClick={() => setQueue('outbox')}>
                    Failed Outbox
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              <div className="grid gap-3 lg:grid-cols-[12rem_14rem_1fr]">
                <select
                  className="h-10 rounded-lg border border-[#d5dfec] bg-white px-3 text-sm outline-none focus:border-[#006c49] focus:ring-2 focus:ring-[#006c49]/10"
                  value={activeStatus}
                  onChange={(event) => {
                    if (queue === 'inbox') setInboxStatus(event.target.value as InboxStatus | 'ALL');
                    else setOutboxStatus(event.target.value as OutboxStatus | 'ALL');
                  }}
                >
                  {queue === 'inbox' ? (
                    <>
                      <option value="FAILED_NON_RETRYABLE">Needs intervention</option>
                      <option value="FAILED_RETRYABLE">Auto-replayable</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="SKIPPED">Skipped</option>
                      <option value="ALL">All inbox rows</option>
                    </>
                  ) : (
                    <>
                      <option value="EXHAUSTED">Exhausted</option>
                      <option value="PENDING">Pending publish</option>
                      <option value="OPERATOR_SKIPPED">Operator skipped</option>
                      <option value="ALL">All outbox rows</option>
                    </>
                  )}
                </select>
                {queue === 'inbox' ? (
                  <input
                    className="h-10 rounded-lg border border-[#d5dfec] bg-white px-3 text-sm outline-none placeholder:text-[#6c7a71] focus:border-[#006c49] focus:ring-2 focus:ring-[#006c49]/10"
                    onChange={(event) => setConsumerName(event.target.value)}
                    placeholder="Consumer name"
                    value={consumerName}
                  />
                ) : (
                  <div className="hidden lg:block" />
                )}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6c7a71]" />
                  <input
                    className="h-10 w-full rounded-lg border border-[#d5dfec] bg-white pl-9 pr-3 text-sm outline-none placeholder:text-[#6c7a71] focus:border-[#006c49] focus:ring-2 focus:ring-[#006c49]/10"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search id, event, aggregate, error"
                    value={search}
                  />
                </div>
              </div>

              {selectedIds.size > 0 ? (
                <div className="flex flex-col gap-3 rounded-lg border border-[#bbcabf] bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#0b1c30]">
                      {selectedIds.size} {queue} event{selectedIds.size === 1 ? '' : 's'} selected
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#3c4a42]">
                      Bulk retry replays each selected row independently. Bulk skip requires an operator reason and records audit evidence per event.
                    </p>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 lg:max-w-xl lg:flex-row lg:items-center">
                    <input
                      className="h-10 min-w-0 flex-1 rounded-lg border border-[#d5dfec] bg-white px-3 text-sm outline-none placeholder:text-[#6c7a71] focus:border-[#006c49] focus:ring-2 focus:ring-[#006c49]/10"
                      onChange={(event) => setOperatorReason(event.target.value)}
                      placeholder="Operator reason for bulk action"
                      value={operatorReason}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedIds(new Set())}
                      disabled={runBulkCommand.isPending}
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      onClick={() => runBulkCommand.mutate({
                        targetQueue: queue,
                        ids: selectedIdList(),
                        command: 'retry',
                        reason: operatorReason.trim(),
                      })}
                      disabled={bulkDisabled}
                    >
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Retry selected
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => runBulkCommand.mutate({
                        targetQueue: queue,
                        ids: selectedIdList(),
                        command: 'skip',
                        reason: operatorReason.trim(),
                      })}
                      disabled={bulkSkipDisabled}
                    >
                      <SkipForward className="mr-2 h-4 w-4" />
                      Skip selected
                    </Button>
                  </div>
                </div>
              ) : null}

              {runBulkCommand.data ? (
                <div className="rounded-lg border border-[#10b981]/30 bg-[#10b981]/10 p-3 text-sm text-[#006c49]">
                  {runBulkCommand.data.action.replace(/_/g, ' ')} completed: {runBulkCommand.data.succeeded}/{runBulkCommand.data.requested} succeeded
                  {runBulkCommand.data.failed.length > 0 ? `, ${runBulkCommand.data.failed.length} failed.` : '.'}
                </div>
              ) : null}
              {runBulkCommand.isError ? (
                <div className="rounded-lg border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 p-3 text-sm text-[#ba1a1a]">
                  Bulk operator action failed. Check MFA, row state, and API logs.
                </div>
              ) : null}

              {activeLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : activeRows.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input
                          aria-label="Select all visible events"
                          checked={allVisibleSelected}
                          className="h-4 w-4 rounded border-[#bbcabf] text-[#006c49] focus:ring-[#006c49]"
                          onChange={(event) => toggleVisibleRows(event.target.checked)}
                          type="checkbox"
                        />
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeRows.map((row) => (
                      <TableRow
                        key={`${row.queue}-${row.id}`}
                        className="cursor-pointer"
                        data-state={selected?.id === row.id && selected.queue === row.queue ? 'selected' : undefined}
                        onClick={() => setSelected(row)}
                      >
                        <TableCell>
                          <input
                            aria-label={`Select ${row.eventName}`}
                            checked={selectedIds.has(row.id)}
                            className="h-4 w-4 rounded border-[#bbcabf] text-[#006c49] focus:ring-[#006c49]"
                            onChange={(event) => toggleRow(row.id, event.target.checked)}
                            onClick={(event) => event.stopPropagation()}
                            type="checkbox"
                          />
                        </TableCell>
                        <TableCell><StatusBadge status={row.status} /></TableCell>
                        <TableCell>
                          <p className="font-semibold text-[#0b1c30]">{row.eventName}</p>
                          <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-[#6c7a71]">
                            {row.aggregateType} / {shortId(row.aggregateId)}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm text-[#3c4a42]">
                          {row.queue === 'inbox' ? row.consumerName : shortId(row.id)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.queue === 'inbox' ? row.retryCount : row.publishAttemptCount}
                        </TableCell>
                        <TableCell className="text-sm text-[#3c4a42]">{formatDate(row.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="rounded-lg border border-dashed border-[#bbcabf] bg-white p-8 text-center text-sm text-[#3c4a42]">
                  No rows match the selected queue filters.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute left-0 top-0 h-1 w-full bg-[#e29100]" />
            <CardHeader className="p-5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <ShieldCheck className="h-5 w-5 text-[#006c49]" />
                Event Detail And Action
              </CardTitle>
              <CardDescription>Retry or skip requires a reason and platform administrator scope.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              {selected ? (
                <>
                  <div className="space-y-3 rounded-lg border border-[#bbcabf] bg-white p-4 text-sm leading-6">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-[#0b1c30]">{selected.eventName}</span>
                      <StatusBadge status={selected.status} />
                    </div>
                    <p className="font-mono text-xs text-[#6c7a71]">{selected.id}</p>
                    <div className="grid gap-2 text-[#3c4a42]">
                      <p><strong>Queue:</strong> {selected.queue}</p>
                      <p><strong>Aggregate:</strong> {selected.aggregateType} / {shortId(selected.aggregateId)}</p>
                      <p><strong>Created:</strong> {formatDate(selected.createdAt)}</p>
                      {selected.queue === 'inbox' ? (
                        <>
                          <p><strong>Consumer:</strong> {selected.consumerName} v{selected.consumerVersion}</p>
                          <p><strong>Source event:</strong> {shortId(selected.sourceEventId)}</p>
                          <p><strong>Error:</strong> {selected.errorSummary ?? '-'}</p>
                          <p><strong>Next retry:</strong> {formatDate(selected.nextRetryAt)}</p>
                        </>
                      ) : (
                        <>
                          <p><strong>Attempts:</strong> {selected.publishAttemptCount}</p>
                          <p><strong>Correlation:</strong> {selected.correlationId ? shortId(selected.correlationId) : '-'}</p>
                          <p><strong>Published:</strong> {formatDate(selected.publishedAt)}</p>
                        </>
                      )}
                    </div>
                  </div>

                  <label className="block text-sm font-semibold text-[#0b1c30]">
                    Operator reason
                    <textarea
                      className="mt-2 min-h-[96px] w-full rounded-lg border border-[#d5dfec] bg-white p-3 text-sm font-normal outline-none placeholder:text-[#6c7a71] focus:border-[#006c49] focus:ring-2 focus:ring-[#006c49]/10"
                      onChange={(event) => setOperatorReason(event.target.value)}
                      placeholder="Explain the fix, reason for retry, or why this event is safe to skip."
                      value={operatorReason}
                    />
                  </label>
                  {reasonRequired && operatorReason.trim().length < 8 ? (
                    <p className="rounded-lg border border-[#e29100]/30 bg-[#ffddb8]/40 p-3 text-sm text-[#523200]">
                      Enter at least 8 characters before running this operator action.
                    </p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      onClick={() => runCommand.mutate({ targetQueue: selected.queue, id: selected.id, command: 'retry', reason: operatorReason.trim() })}
                      disabled={commandDisabled}
                    >
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Retry
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => runCommand.mutate({ targetQueue: selected.queue, id: selected.id, command: 'skip', reason: operatorReason.trim() })}
                      disabled={commandDisabled}
                    >
                      <SkipForward className="mr-2 h-4 w-4" />
                      Skip
                    </Button>
                  </div>
                  {runCommand.data ? (
                    <div className="rounded-lg border border-[#10b981]/30 bg-[#10b981]/10 p-3 text-sm text-[#006c49]">
                      {runCommand.data.action.replace(/_/g, ' ')} completed. Status: {runCommand.data.status}.
                    </div>
                  ) : null}
                  {runCommand.isError ? (
                    <div className="rounded-lg border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 p-3 text-sm text-[#ba1a1a]">
                      Operator action failed. Check role, MFA, row status, and API logs.
                    </div>
                  ) : null}
                  <details className="rounded-lg border border-[#bbcabf] bg-white p-3 text-sm">
                    <summary className="cursor-pointer font-semibold text-[#0b1c30]">Raw evidence summary</summary>
                    <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-5 text-[#3c4a42]">
                      {JSON.stringify(redactedEvidence, null, 2)}
                    </pre>
                  </details>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-[#bbcabf] bg-white p-8 text-center text-sm text-[#3c4a42]">
                  Select an inbox or outbox row to inspect evidence and run operator actions.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
