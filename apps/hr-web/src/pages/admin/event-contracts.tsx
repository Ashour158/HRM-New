import * as React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, GitBranch, Network, Search, ShieldCheck } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface EventContractRegistry {
  topics: string[];
  topicMappings: Record<string, string>;
  eventPrefixMappings: Array<[string, string]>;
  defaults: {
    topic: string;
    eventSchemaVersion: number;
    envelopeVersion: number;
  };
  consumerGroupNaming: {
    convention: string;
    domainExample: string;
    purposeExample: string;
    versionExample: number;
    example: string;
  };
}

function unwrapApiData<T>(response: { data: unknown }): T {
  const envelope = response.data as { data?: T; success?: boolean };
  if (envelope && typeof envelope === 'object' && envelope.success === true && 'data' in envelope) {
    return envelope.data as T;
  }
  return response.data as T;
}

export function AdminEventContracts() {
  const [search, setSearch] = React.useState('');
  const registryQuery = useQuery({
    queryKey: ['admin-event-contract-registry'],
    queryFn: async () => unwrapApiData<EventContractRegistry>(await apiClient.get('/admin/event-contracts/registry')),
  });

  const aggregateMappings = React.useMemo(() => {
    const value = search.trim().toLowerCase();
    const rows = Object.entries(registryQuery.data?.topicMappings ?? {}).map(([aggregateType, topic]) => ({ aggregateType, topic }));
    if (!value) return rows;
    return rows.filter((row) => row.aggregateType.toLowerCase().includes(value) || row.topic.toLowerCase().includes(value));
  }, [registryQuery.data?.topicMappings, search]);

  return (
    <main className="p-6 text-foreground md:p-8">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <div>
          <Link className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" to="/admin/system-console">
            <ArrowLeft className="h-4 w-4" />
            Admin Panel
          </Link>
          <h1 className="font-['Hanken_Grotesk'] text-3xl font-bold fusion-gradient-text md:text-4xl">Event Contracts</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
            Inspect the canonical event topics, aggregate routes, schema defaults, and consumer group naming rules used by outbox replay and notification delivery.
          </p>
        </div>

        {registryQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        ) : registryQuery.isError ? (
          <ErrorState error={registryQuery.error} onRetry={() => registryQuery.refetch()} />
        ) : (
          <>
            <h2 className="sr-only">Event contract registry details</h2>
            <section className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Network className="h-5 w-5 text-primary" />
                    Topics
                  </CardTitle>
                  <CardDescription>Canonical event streams</CardDescription>
                </CardHeader>
                <CardContent className="text-3xl font-bold">{registryQuery.data?.topics.length ?? 0}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <GitBranch className="h-5 w-5 text-primary" />
                    Aggregate Routes
                  </CardTitle>
                  <CardDescription>Aggregate-to-topic mappings</CardDescription>
                </CardHeader>
                <CardContent className="text-3xl font-bold">{Object.keys(registryQuery.data?.topicMappings ?? {}).length}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-5 w-5 text-secondary" />
                    Defaults
                  </CardTitle>
                  <CardDescription>Replay-safe envelope versions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <div>Topic: <span className="font-mono text-foreground">{registryQuery.data?.defaults.topic}</span></div>
                  <div>Event schema v{registryQuery.data?.defaults.eventSchemaVersion} / envelope v{registryQuery.data?.defaults.envelopeVersion}</div>
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Consumer Group Convention</CardTitle>
                <CardDescription>Used by inbox consumers so replay does not duplicate or downgrade event envelopes.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                <div className="fusion-glass rounded-2xl p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Convention</div>
                  <div className="mt-1 font-mono">{registryQuery.data?.consumerGroupNaming.convention}</div>
                </div>
                <div className="fusion-glass rounded-2xl p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Example</div>
                  <div className="mt-1 font-mono">{registryQuery.data?.consumerGroupNaming.example}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-[2rem]">
              <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Aggregate Topic Mappings</CardTitle>
                  <CardDescription>These mappings are the runtime contract for outbox topic selection.</CardDescription>
                </div>
                <div className="relative w-full md:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm" placeholder="Search aggregate or topic" aria-label="Search aggregate or topic" value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-accent">
                        <TableHead>Aggregate Type</TableHead>
                        <TableHead>Topic</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aggregateMappings.map((row) => (
                        <TableRow key={row.aggregateType}>
                          <TableCell className="font-semibold">{row.aggregateType}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">{row.topic}</TableCell>
                        </TableRow>
                      ))}
                      {!aggregateMappings.length && (
                        <TableRow>
                          <TableCell colSpan={2} className="py-10 text-center text-muted-foreground">No event mappings match this search.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Event Prefix Fallbacks</CardTitle>
                <CardDescription>Fallback routing when legacy producers only provide an event name.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-2">
                {(registryQuery.data?.eventPrefixMappings ?? []).map(([prefix, topic]) => (
                  <div key={`${prefix}-${topic}`} className="fusion-glass rounded-2xl p-3 text-sm">
                    <span className="font-mono font-semibold">{prefix}</span>
                    <span className="mx-2 text-muted-foreground">{'->'}</span>
                    <span className="font-mono text-muted-foreground">{topic}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
