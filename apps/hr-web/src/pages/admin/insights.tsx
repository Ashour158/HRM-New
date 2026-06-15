import * as React from 'react';
import { useTenant } from '@/hooks/use-tenant';
import { useApiQuery } from '@/hooks/use-api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChartPanel, DonutChartPanel, type ChartDatum } from '@/components/ui/charts';
import { DataTable } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { formatDate, formatNumber } from '@/lib/utils';
import { AlertTriangle, BrainCircuit } from 'lucide-react';

type InsightBand = 'LOW' | 'MEDIUM' | 'HIGH';

interface InsightFactor {
  factor: string;
  weight: number;
  detail: string;
}

interface AttritionRiskSnapshot {
  id: string;
  workerId: string;
  periodKey: string;
  score: number;
  band: InsightBand;
  factors: InsightFactor[];
  modelVersion: string;
  createdAt: string;
}

interface AttendancePayrollAnomalySnapshot {
  id: string;
  workerId: string;
  periodKey: string;
  anomalyType: string;
  score: number;
  band: InsightBand;
  factors: InsightFactor[];
  createdAt: string;
}

const emptyAttrition: AttritionRiskSnapshot[] = [];
const emptyAnomalies: AttendancePayrollAnomalySnapshot[] = [];

function bandTone(band: InsightBand) {
  if (band === 'HIGH') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (band === 'MEDIUM') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

function bandDistribution(rows: Array<{ band: InsightBand }>): ChartDatum[] {
  const counts = rows.reduce<Record<InsightBand, number>>((acc, row) => {
    acc[row.band] += 1;
    return acc;
  }, { LOW: 0, MEDIUM: 0, HIGH: 0 });
  return [
    { label: 'Low', value: counts.LOW },
    { label: 'Medium', value: counts.MEDIUM },
    { label: 'High', value: counts.HIGH },
  ];
}

function topFactor(row: { factors?: InsightFactor[] }) {
  return [...(row.factors ?? [])].sort((a, b) => b.weight - a.weight)[0];
}

export function AdminInsights() {
  const { tenantId } = useTenant();
  const attritionQuery = useApiQuery<AttritionRiskSnapshot[]>(
    ['intelligence-attrition-risk', tenantId],
    `/intelligence/attrition-risk/tenant/${tenantId}`,
    { enabled: Boolean(tenantId) },
  );
  const anomalyQuery = useApiQuery<AttendancePayrollAnomalySnapshot[]>(
    ['intelligence-anomalies', tenantId],
    `/intelligence/anomalies/tenant/${tenantId}`,
    { enabled: Boolean(tenantId) },
  );

  const attritionRows = React.useMemo(
    () => (Array.isArray(attritionQuery.data) ? attritionQuery.data : emptyAttrition),
    [attritionQuery.data],
  );
  const anomalyRows = React.useMemo(
    () => (Array.isArray(anomalyQuery.data) ? anomalyQuery.data : emptyAnomalies),
    [anomalyQuery.data],
  );
  const riskChart = React.useMemo(() => bandDistribution(attritionRows), [attritionRows]);
  const anomalyChart = React.useMemo(() => bandDistribution(anomalyRows), [anomalyRows]);
  const highRiskCount = attritionRows.filter((row) => row.band === 'HIGH').length;
  const highAnomalyCount = anomalyRows.filter((row) => row.band === 'HIGH').length;

  const attritionColumns = React.useMemo(() => [
    {
      key: 'worker',
      header: 'Worker',
      cell: (row: AttritionRiskSnapshot) => (
        <div>
          <p className="font-semibold text-foreground">{row.workerId}</p>
          <p className="text-xs text-muted-foreground">{row.periodKey}</p>
        </div>
      ),
    },
    {
      key: 'score',
      header: 'Risk',
      cell: (row: AttritionRiskSnapshot) => (
        <Badge variant="outline" className={bandTone(row.band)}>
          {row.band} - {formatNumber(row.score * 100, 1)}%
        </Badge>
      ),
    },
    {
      key: 'factor',
      header: 'Main factor',
      cell: (row: AttritionRiskSnapshot) => topFactor(row)?.detail ?? 'No factor',
    },
    {
      key: 'createdAt',
      header: 'Scored',
      cell: (row: AttritionRiskSnapshot) => formatDate(row.createdAt),
    },
  ], []);

  const anomalyColumns = React.useMemo(() => [
    {
      key: 'worker',
      header: 'Worker',
      cell: (row: AttendancePayrollAnomalySnapshot) => (
        <div>
          <p className="font-semibold text-foreground">{row.workerId}</p>
          <p className="text-xs text-muted-foreground">{row.anomalyType}</p>
        </div>
      ),
    },
    {
      key: 'score',
      header: 'Severity',
      cell: (row: AttendancePayrollAnomalySnapshot) => (
        <Badge variant="outline" className={bandTone(row.band)}>
          {row.band} - {formatNumber(row.score * 100, 1)}%
        </Badge>
      ),
    },
    {
      key: 'factor',
      header: 'Main factor',
      cell: (row: AttendancePayrollAnomalySnapshot) => topFactor(row)?.detail ?? 'No factor',
    },
    {
      key: 'createdAt',
      header: 'Detected',
      cell: (row: AttendancePayrollAnomalySnapshot) => formatDate(row.createdAt),
    },
  ], []);

  if (attritionQuery.isError) {
    return <ErrorState error={attritionQuery.error} onRetry={() => attritionQuery.refetch()} />;
  }
  if (anomalyQuery.isError) {
    return <ErrorState error={anomalyQuery.error} onRetry={() => anomalyQuery.refetch()} />;
  }

  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3">Explainable intelligence</Badge>
          <h1 className="font-headline text-3xl font-semibold text-foreground">Workforce Insights</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Review deterministic attrition and anomaly signals with contributing factors.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          Heuristic v1
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risk snapshots</p>
              <p className="text-2xl font-bold text-foreground">{attritionRows.length}</p>
            </div>
            <BrainCircuit className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">High attrition risk</p>
              <p className="text-2xl font-bold text-foreground">{highRiskCount}</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Anomalies</p>
              <p className="text-2xl font-bold text-foreground">{anomalyRows.length}</p>
            </div>
            <BrainCircuit className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">High anomalies</p>
              <p className="text-2xl font-bold text-foreground">{highAnomalyCount}</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DonutChartPanel title="Attrition risk bands" data={riskChart} />
        <BarChartPanel title="Anomaly severity bands" data={anomalyChart} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attrition risk</CardTitle>
          </CardHeader>
          <CardContent>
            {attritionRows.length === 0 ? (
              <EmptyState icon={BrainCircuit} title="No attrition signals yet" description="Signals appear after workforce events are scored." />
            ) : (
              <DataTable
                columns={attritionColumns}
                data={attritionRows}
                keyExtractor={(row) => row.id}
                total={attritionRows.length}
                emptyMessage="No attrition risk snapshots found."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance and payroll anomalies</CardTitle>
          </CardHeader>
          <CardContent>
            {anomalyRows.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="No anomalies detected" description="High-risk anomalies will notify HR operations automatically." />
            ) : (
              <DataTable
                columns={anomalyColumns}
                data={anomalyRows}
                keyExtractor={(row) => row.id}
                total={anomalyRows.length}
                emptyMessage="No anomaly snapshots found."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
