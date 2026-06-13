import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  RefreshCcw,
  ShieldAlert,
} from 'lucide-react';
import { useApiQuery } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { BusinessMetric, BusinessPageHeader } from '@/components/common/business-page';

type ProductionReadinessStatus = 'READY' | 'WARNING' | 'BLOCKED' | 'NOT_CONFIGURED';

interface ProductionReadinessDomain {
  code: string;
  label: string;
  status: ProductionReadinessStatus;
  summary: string;
  blockers: string[];
  warnings: string[];
  evidence: string[];
  metrics: Record<string, number | string | boolean>;
  actionPath: string;
}

interface ProductionReadinessSnapshot {
  tenantId: string;
  generatedAt: string;
  overallStatus: ProductionReadinessStatus;
  overallScore: number;
  productionReady: boolean;
  summary: Record<ProductionReadinessStatus, number>;
  domains: ProductionReadinessDomain[];
  criticalBlockers: string[];
  warnings: string[];
}

function statusLabel(status: ProductionReadinessStatus): string {
  if (status === 'READY') return 'Ready';
  if (status === 'WARNING') return 'Warning';
  if (status === 'BLOCKED') return 'Blocked';
  return 'Not configured';
}

function statusClasses(status: ProductionReadinessStatus): string {
  if (status === 'READY') return 'border-[#10b981]/30 bg-[#dcfce7] text-[#065f46]';
  if (status === 'WARNING') return 'border-[#f59e0b]/30 bg-[#fef3c7] text-[#78350f]';
  if (status === 'BLOCKED') return 'border-[#e11d48]/30 bg-[#ffe4e6] text-[#9f1239]';
  return 'border-[#64748b]/30 bg-[#f1f5f9] text-[#334155]';
}

function StatusPill({ status }: { status: ProductionReadinessStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

function ReadinessIcon({ status }: { status: ProductionReadinessStatus }) {
  if (status === 'READY') return <CheckCircle2 className="h-5 w-5 text-[#047857]" />;
  if (status === 'WARNING') return <AlertTriangle className="h-5 w-5 text-[#b45309]" />;
  if (status === 'BLOCKED') return <ShieldAlert className="h-5 w-5 text-[#be123c]" />;
  return <AlertCircle className="h-5 w-5 text-[#475569]" />;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function DomainCard({ domain }: { domain: ProductionReadinessDomain }) {
  const visibleFindings = [...domain.blockers, ...domain.warnings].slice(0, 4);

  return (
    <Card className="h-full border-[#e2e8f0] bg-white">
      <CardHeader className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#f8fafc]">
              <ReadinessIcon status={domain.status} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">{domain.label}</CardTitle>
              <p className="mt-1 text-sm leading-5 text-[#475569]">{domain.summary}</p>
            </div>
          </div>
          <StatusPill status={domain.status} />
        </div>
      </CardHeader>
      <CardContent className="flex h-[calc(100%-7rem)] flex-col gap-4 p-5 pt-0">
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(domain.metrics).slice(0, 4).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">{key}</p>
              <p className="mt-1 text-sm font-semibold text-[#0f172a]">{String(value)}</p>
            </div>
          ))}
        </div>

        {visibleFindings.length > 0 ? (
          <div className="space-y-2">
            {visibleFindings.map((finding) => (
              <div key={finding} className="flex items-start gap-2 text-sm leading-5 text-[#475569]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#f59e0b]" />
                <span>{finding}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-2 text-sm leading-5 text-[#475569]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#047857]" />
            <span>No blocker is reported for this area.</span>
          </div>
        )}

        <div className="mt-auto space-y-2 border-t border-[#e2e8f0] pt-3">
          {domain.evidence.slice(0, 3).map((item) => (
            <p key={item} className="text-xs leading-5 text-[#64748b]">{item}</p>
          ))}
          <Button asChild className="w-full" variant={domain.status === 'READY' ? 'outline' : 'default'}>
            <Link to={domain.actionPath}>
              Open Area
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminReadiness() {
  const readinessQuery = useApiQuery<ProductionReadinessSnapshot>(
    ['production-readiness'],
    '/admin/system-console/readiness',
    { retry: false },
  );

  const readiness = readinessQuery.data;
  const blockedDomains = readiness?.domains.filter((domain) => domain.status === 'BLOCKED') ?? [];
  const watchDomains = readiness?.domains.filter((domain) => domain.status === 'WARNING' || domain.status === 'NOT_CONFIGURED') ?? [];

  if (readinessQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] p-6">
        <Skeleton className="h-40 w-full" />
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (readinessQuery.isError || !readiness) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] p-6">
        <ErrorState error={readinessQuery.error} onRetry={() => readinessQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0f172a]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-6 xl:p-8">
        <BusinessPageHeader
          eyebrow="System Console"
          icon={ClipboardCheck}
          title="Production Readiness"
          subtitle="Go-live gate across setup, policies, modules, integrations, queues, audit, and deployment controls."
          actions={(
            <Button onClick={() => readinessQuery.refetch()} variant="outline">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          )}
        />

        <Card className="overflow-hidden border-[#e2e8f0] bg-white">
          <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_18rem]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill status={readiness.overallStatus} />
                <span className="text-sm font-semibold text-[#475569]">
                  Snapshot generated {formatDate(readiness.generatedAt)}
                </span>
              </div>
              <h2 className="mt-4 font-headline text-3xl font-bold text-[#0f172a]">
                {readiness.productionReady ? 'Ready for production gate approval' : 'Not ready for production release'}
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-[#475569]">
                This page does not certify the product by design alone. It requires live release checks across data,
                policies, queues, integrations, audit, and deployment controls.
              </p>
            </div>
            <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Readiness score</p>
              <p className="mt-2 font-headline text-5xl font-bold text-[#0f172a]">{readiness.overallScore}%</p>
              <p className="mt-2 text-sm text-[#475569]">{readiness.domains.length} domains checked</p>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <BusinessMetric label="Ready" value={readiness.summary.READY} tone="success" />
          <BusinessMetric label="Warnings" value={readiness.summary.WARNING} tone="warning" />
          <BusinessMetric label="Blocked" value={readiness.summary.BLOCKED} tone={readiness.summary.BLOCKED > 0 ? 'warning' : 'default'} />
          <BusinessMetric label="Not Configured" value={readiness.summary.NOT_CONFIGURED} tone={readiness.summary.NOT_CONFIGURED > 0 ? 'warning' : 'default'} />
        </section>

        {(blockedDomains.length > 0 || watchDomains.length > 0) ? (
          <section className="grid gap-4 xl:grid-cols-2">
            <Card className="border-[#fecdd3] bg-[#fff1f2]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ShieldAlert className="h-5 w-5 text-[#be123c]" />
                  Release Blockers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {blockedDomains.length > 0 ? blockedDomains.flatMap((domain) =>
                  domain.blockers.map((blocker) => (
                    <div key={`${domain.code}-${blocker}`} className="rounded-lg border border-[#fecdd3] bg-white p-3 text-sm leading-5 text-[#9f1239]">
                      <span className="font-semibold">{domain.label}:</span> {blocker}
                    </div>
                  )),
                ) : (
                  <p className="text-sm text-[#475569]">No blocking release issue is reported.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-[#fde68a] bg-[#fffbeb]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <AlertTriangle className="h-5 w-5 text-[#b45309]" />
                  Watch Items
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {watchDomains.length > 0 ? watchDomains.flatMap((domain) =>
                  [...domain.warnings, ...(domain.status === 'NOT_CONFIGURED' ? ['Area is not fully configured.'] : [])].map((warning) => (
                    <div key={`${domain.code}-${warning}`} className="rounded-lg border border-[#fde68a] bg-white p-3 text-sm leading-5 text-[#78350f]">
                      <span className="font-semibold">{domain.label}:</span> {warning}
                    </div>
                  )),
                ) : (
                  <p className="text-sm text-[#475569]">No warning item is reported.</p>
                )}
              </CardContent>
            </Card>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {readiness.domains.map((domain) => (
            <DomainCard key={domain.code} domain={domain} />
          ))}
        </section>
      </div>
    </div>
  );
}
