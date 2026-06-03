import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  PlugZap,
  RefreshCcw,
  Router,
  ShieldCheck,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type IntegrationDirection = 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL';
type IntegrationState = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

interface IntegrationStatus {
  adapterName: string;
  direction: IntegrationDirection;
  state: IntegrationState;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  consecutiveFailures: number;
  totalSuccesses: number;
  totalFailures: number;
}

interface IntegrationHealth {
  adapterName: string;
  direction: IntegrationDirection;
  healthy: boolean;
  lastCheckedAt: string;
  latencyMs?: number;
  errorMessage?: string;
}

interface IntegrationMetrics {
  adapterName: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageLatencyMs: number;
  lastCallAt?: string;
  p95LatencyMs?: number;
  p99LatencyMs?: number;
}

interface IntegrationResult {
  success: boolean;
  adapterName: string;
  operationId: string;
  timestamp: string;
  details?: Record<string, unknown>;
  error?: string;
}

function unwrapApiData<T>(response: { data: unknown }): T {
  const envelope = response.data as { data?: T; success?: boolean };
  if (envelope && typeof envelope === 'object' && envelope.success === true && 'data' in envelope) {
    return envelope.data as T;
  }
  return response.data as T;
}

function formatDate(value: string | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function stateClass(state: IntegrationState) {
  if (state === 'HEALTHY') return 'border-[#10b981]/30 bg-[#10b981]/10 text-[#006c49]';
  if (state === 'DEGRADED' || state === 'UNKNOWN') return 'border-[#e29100]/30 bg-[#ffddb8]/60 text-[#523200]';
  return 'border-[#ba1a1a]/30 bg-[#ba1a1a]/10 text-[#ba1a1a]';
}

function HealthBadge({ state }: { state: IntegrationState }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${stateClass(state)}`}>
      {state.replace(/_/g, ' ')}
    </span>
  );
}

function metricValue(value: number | undefined, suffix = '') {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${Math.round(value)}${suffix}`;
}

/**
 * Central integration admin surface backed by the existing integration management APIs.
 */
export function AdminIntegrations() {
  const queryClient = useQueryClient();
  const [selectedAdapter, setSelectedAdapter] = React.useState('');

  const statusQuery = useQuery({
    queryKey: ['integration-status'],
    queryFn: async () => unwrapApiData<{ adapters: IntegrationStatus[] }>(await apiClient.get('/hr/integrations/status')),
  });
  const healthQuery = useQuery({
    queryKey: ['integration-health'],
    queryFn: async () => unwrapApiData<{ adapters: IntegrationHealth[] }>(await apiClient.get('/hr/integrations/health')),
    enabled: false,
  });

  const adapters = statusQuery.data?.adapters ?? [];
  const selected = adapters.find((adapter) => adapter.adapterName === selectedAdapter) ?? adapters[0];

  React.useEffect(() => {
    if (!selectedAdapter && adapters[0]?.adapterName) setSelectedAdapter(adapters[0].adapterName);
  }, [adapters, selectedAdapter]);

  const metricsQuery = useQuery({
    queryKey: ['integration-metrics', selected?.adapterName],
    queryFn: async () => unwrapApiData<IntegrationMetrics>(await apiClient.get(`/hr/integrations/${selected?.adapterName}/metrics`)),
    enabled: Boolean(selected?.adapterName),
  });

  const triggerMutation = useMutation({
    mutationFn: async (adapterName: string) => (
      unwrapApiData<{ adapterName: string; result: IntegrationResult }>(await apiClient.post(`/hr/integrations/${adapterName}/trigger`))
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-status'] });
      queryClient.invalidateQueries({ queryKey: ['integration-metrics'] });
    },
  });

  const healthyCount = adapters.filter((adapter) => adapter.state === 'HEALTHY').length;
  const failedCount = adapters.reduce((total, adapter) => total + adapter.totalFailures, 0);
  const lastHealth = healthQuery.data?.adapters ?? [];
  const selectedHealth = selected ? lastHealth.find((item) => item.adapterName === selected.adapterName) : undefined;

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#bbcabf] bg-white px-3 py-1 font-mono text-xs uppercase tracking-wider text-[#3c4a42]">
              <PlugZap className="h-3.5 w-3.5 text-[#006c49]" />
              System Development Control
            </div>
            <h2 className="mt-3 font-headline text-4xl font-bold text-[#0b1c30]">System Control - Integrations</h2>
            <p className="mt-2 max-w-3xl text-lg leading-8 text-[#3c4a42]">
              Manage the integration area of the System Admin Console: registered adapters, health probes, metrics,
              and safe manual adapter checks.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild type="button" variant="outline">
              <Link to="/admin/system-console">
                <ArrowLeft className="mr-2 h-4 w-4" />
                System Console
              </Link>
            </Button>
            <Button type="button" variant="outline" onClick={() => healthQuery.refetch()} disabled={healthQuery.isFetching}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              {healthQuery.isFetching ? 'Checking...' : 'Run Health Check'}
            </Button>
            {selected ? (
              <Button
                type="button"
                onClick={() => triggerMutation.mutate(selected.adapterName)}
                disabled={triggerMutation.isPending}
              >
                <PlugZap className="mr-2 h-4 w-4" />
                {triggerMutation.isPending ? 'Triggering...' : 'Trigger Selected Adapter'}
              </Button>
            ) : null}
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Registered Adapters', value: adapters.length.toString(), helper: 'From /hr/integrations/status', icon: Router },
            { label: 'Healthy', value: healthyCount.toString(), helper: 'Cached adapter states', icon: CheckCircle2 },
            { label: 'Total Failures', value: failedCount.toString(), helper: 'All adapter failures', icon: AlertTriangle },
            { label: 'Last Health Probe', value: lastHealth.length ? `${lastHealth.filter((item) => item.healthy).length}/${lastHealth.length}` : '-', helper: 'Run health check to refresh', icon: Activity },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="relative overflow-hidden">
                <div className="absolute left-0 top-0 h-1 w-full bg-[#10b981]" />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-wider text-[#3c4a42]">{item.label}</p>
                      <p className="mt-2 font-headline text-4xl font-bold text-[#0b1c30]">{statusQuery.isLoading ? '-' : item.value}</p>
                      <p className="mt-2 text-sm leading-6 text-[#3c4a42]">{item.helper}</p>
                    </div>
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#eff4ff] text-[#006c49]">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
          <Card className="relative overflow-hidden">
            <div className="absolute left-0 top-0 h-1 w-full bg-[#006c49]" />
            <CardHeader className="p-5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Router className="h-5 w-5 text-[#006c49]" />
                Adapter Registry
              </CardTitle>
              <CardDescription>
                These are the adapters actually registered with the backend orchestrator.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {statusQuery.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : adapters.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-[#bbcabf] bg-white">
                  <div className="grid min-w-[760px] grid-cols-[1.1fr_.7fr_.7fr_.7fr_.7fr] border-b border-[#bbcabf] bg-[#eff4ff] px-4 py-3 font-mono text-xs uppercase tracking-wider text-[#3c4a42]">
                    <span>Adapter</span>
                    <span>Direction</span>
                    <span>State</span>
                    <span>Failures</span>
                    <span>Last Success</span>
                  </div>
                  <div className="max-h-[34rem] min-w-[760px] overflow-y-auto">
                    {adapters.map((adapter) => (
                      <button
                        key={adapter.adapterName}
                        type="button"
                        onClick={() => setSelectedAdapter(adapter.adapterName)}
                        className={`grid w-full grid-cols-[1.1fr_.7fr_.7fr_.7fr_.7fr] items-center gap-3 border-b border-[#bbcabf]/60 px-4 py-3 text-left text-sm transition-colors hover:bg-[#eff4ff] ${
                          selected?.adapterName === adapter.adapterName ? 'bg-[#10b981]/10' : ''
                        }`}
                      >
                        <span>
                          <span className="block font-semibold text-[#0b1c30]">{adapter.adapterName}</span>
                          <span className="font-mono text-[11px] uppercase tracking-wider text-[#6c7a71]">
                            {adapter.totalSuccesses} successes
                          </span>
                        </span>
                        <span>{adapter.direction}</span>
                        <span><HealthBadge state={adapter.state} /></span>
                        <span>{adapter.consecutiveFailures} consecutive / {adapter.totalFailures} total</span>
                        <span>{formatDate(adapter.lastSuccessAt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-[#bbcabf] bg-white p-4 text-sm text-[#3c4a42]">
                  No adapters are registered by the backend orchestrator.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="h-5 w-5 text-[#006c49]" />
                  Selected Adapter
                </CardTitle>
                <CardDescription>{selected?.adapterName ?? 'Select an adapter'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-[#3c4a42]">
                {selected ? (
                  <>
                    <div className="flex items-center justify-between rounded-lg border border-[#bbcabf] bg-[#f8f9ff] p-3">
                      <span>State</span>
                      <HealthBadge state={selected.state} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-[#bbcabf] bg-[#f8f9ff] p-3">
                      <span>Direction</span>
                      <span className="font-semibold text-[#0b1c30]">{selected.direction}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-[#bbcabf] bg-[#f8f9ff] p-3">
                      <span>Last failure</span>
                      <span className="font-semibold text-[#0b1c30]">{formatDate(selected.lastFailureAt)}</span>
                    </div>
                    {selectedHealth ? (
                      <div className="rounded-lg border border-[#bbcabf] bg-[#f8f9ff] p-3">
                        <p className="font-semibold text-[#0b1c30]">Last probe</p>
                        <p>{selectedHealth.healthy ? 'Healthy' : 'Unhealthy'} / {metricValue(selectedHealth.latencyMs, 'ms')}</p>
                        {selectedHealth.errorMessage ? <p className="mt-1 text-[#ba1a1a]">{selectedHealth.errorMessage}</p> : null}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p>No adapter selected.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock3 className="h-5 w-5 text-[#4648d4]" />
                  Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-[#3c4a42]">
                {metricsQuery.isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : metricsQuery.data ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-[#bbcabf] bg-[#f8f9ff] p-3 text-center">
                        <p className="text-2xl font-bold text-[#0b1c30]">{metricsQuery.data.totalCalls}</p>
                        <p className="text-xs">calls</p>
                      </div>
                      <div className="rounded-lg border border-[#bbcabf] bg-[#f8f9ff] p-3 text-center">
                        <p className="text-2xl font-bold text-[#006c49]">{metricsQuery.data.successfulCalls}</p>
                        <p className="text-xs">success</p>
                      </div>
                      <div className="rounded-lg border border-[#bbcabf] bg-[#f8f9ff] p-3 text-center">
                        <p className="text-2xl font-bold text-[#ba1a1a]">{metricsQuery.data.failedCalls}</p>
                        <p className="text-xs">failed</p>
                      </div>
                    </div>
                    <p>Average latency: {metricValue(metricsQuery.data.averageLatencyMs, 'ms')}</p>
                    <p>p95: {metricValue(metricsQuery.data.p95LatencyMs, 'ms')} / p99: {metricValue(metricsQuery.data.p99LatencyMs, 'ms')}</p>
                    <p>Last call: {formatDate(metricsQuery.data.lastCallAt)}</p>
                  </>
                ) : (
                  <p>No metrics available.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {triggerMutation.data ? (
          <Card className="border-[#10b981]/40 bg-[#10b981]/5">
            <CardContent className="p-4 text-sm text-[#0b1c30]">
              <CheckCircle2 className="mr-2 inline h-4 w-4 text-[#006c49]" />
              Manual trigger returned {triggerMutation.data.result.success ? 'success' : 'failure'} for {triggerMutation.data.adapterName}
              {' '}at {formatDate(triggerMutation.data.result.timestamp)}.
            </CardContent>
          </Card>
        ) : null}

        {triggerMutation.error ? (
          <Card className="border-[#ba1a1a]/40 bg-[#ba1a1a]/5">
            <CardContent className="p-4 text-sm text-[#ba1a1a]">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              Manual trigger failed: {triggerMutation.error.message}
            </CardContent>
          </Card>
        ) : null}

        <Card className="relative overflow-hidden">
          <div className="absolute left-0 top-0 h-1 w-full bg-[#e29100]" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-5 w-5 text-[#e29100]" />
              Integration Governance Gaps
            </CardTitle>
            <CardDescription>Visible on purpose so the console does not pretend these controls are production-complete.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {[
              ['Runtime secrets', 'No audited runtime secret/config endpoint exists yet. Google Maps is still build-time config.'],
              ['Persisted logs', 'The backend logs endpoint is currently a stub returning an empty list.'],
              ['Retry policy', 'Adapter retry/dead-letter controls need a governed backend workflow before UI actions are exposed.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg border border-[#bbcabf] bg-white p-4">
                <FileText className="h-5 w-5 text-[#006c49]" />
                <p className="mt-3 font-semibold text-[#0b1c30]">{title}</p>
                <p className="mt-2 text-sm leading-6 text-[#3c4a42]">{body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
