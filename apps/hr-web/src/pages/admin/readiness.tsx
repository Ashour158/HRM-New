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
  if (status === 'READY') return 'border-success/30 bg-success/15 text-success-foreground';
  if (status === 'WARNING') return 'border-warning/30 bg-warning/10 text-warning-foreground';
  if (status === 'BLOCKED') return 'border-destructive/30 bg-destructive/10 text-destructive-foreground';
  return 'border-muted-foreground/30 bg-muted text-muted-foreground';
}

function StatusPill({ status }: { status: ProductionReadinessStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

function ReadinessIcon({ status }: { status: ProductionReadinessStatus }) {
  if (status === 'READY') return <CheckCircle2 className="h-5 w-5 text-success" />;
  if (status === 'WARNING') return <AlertTriangle className="h-5 w-5 text-warning-foreground" />;
  if (status === 'BLOCKED') return <ShieldAlert className="h-5 w-5 text-destructive" />;
  return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
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
    <Card className="h-full border-border bg-white">
      <CardHeader className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted">
              <ReadinessIcon status={domain.status} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">{domain.label}</CardTitle>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{domain.summary}</p>
            </div>
          </div>
          <StatusPill status={domain.status} />
        </div>
      </CardHeader>
      <CardContent className="flex h-[calc(100%-7rem)] flex-col gap-4 p-5 pt-0">
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(domain.metrics).slice(0, 4).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-border bg-muted p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{key}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{String(value)}</p>
            </div>
          ))}
        </div>

        {visibleFindings.length > 0 ? (
          <div className="space-y-2">
            {visibleFindings.map((finding) => (
              <div key={finding} className="flex items-start gap-2 text-sm leading-5 text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <span>{finding}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-2 text-sm leading-5 text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>No blocker is reported for this area.</span>
          </div>
        )}

        <div className="mt-auto space-y-2 border-t border-border pt-3">
          {domain.evidence.slice(0, 3).map((item) => (
            <p key={item} className="text-xs leading-5 text-muted-foreground">{item}</p>
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
      <div className="min-h-screen bg-muted p-6">
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
      <div className="min-h-screen bg-muted p-6">
        <ErrorState error={readinessQuery.error} onRetry={() => readinessQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted text-foreground">
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

        <Card className="overflow-hidden border-border bg-white">
          <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_18rem]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill status={readiness.overallStatus} />
                <span className="text-sm font-semibold text-muted-foreground">
                  Snapshot generated {formatDate(readiness.generatedAt)}
                </span>
              </div>
              <h2 className="mt-4 font-headline text-3xl font-bold text-foreground">
                {readiness.productionReady ? 'Ready for production gate approval' : 'Not ready for production release'}
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
                This page does not certify the product by design alone. It requires live release checks across data,
                policies, queues, integrations, audit, and deployment controls.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-muted p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Readiness score</p>
              <p className="mt-2 font-headline text-5xl font-bold text-foreground">{readiness.overallScore}%</p>
              <p className="mt-2 text-sm text-muted-foreground">{readiness.domains.length} domains checked</p>
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
            <Card className="border-destructive bg-destructive/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                  Release Blockers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {blockedDomains.length > 0 ? blockedDomains.flatMap((domain) =>
                  domain.blockers.map((blocker) => (
                    <div key={`${domain.code}-${blocker}`} className="rounded-lg border border-destructive bg-white p-3 text-sm leading-5 text-destructive-foreground">
                      <span className="font-semibold">{domain.label}:</span> {blocker}
                    </div>
                  )),
                ) : (
                  <p className="text-sm text-muted-foreground">No blocking release issue is reported.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-warning bg-warning/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <AlertTriangle className="h-5 w-5 text-warning-foreground" />
                  Watch Items
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {watchDomains.length > 0 ? watchDomains.flatMap((domain) =>
                  [...domain.warnings, ...(domain.status === 'NOT_CONFIGURED' ? ['Area is not fully configured.'] : [])].map((warning) => (
                    <div key={`${domain.code}-${warning}`} className="rounded-lg border border-warning bg-white p-3 text-sm leading-5 text-warning-foreground">
                      <span className="font-semibold">{domain.label}:</span> {warning}
                    </div>
                  )),
                ) : (
                  <p className="text-sm text-muted-foreground">No warning item is reported.</p>
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
