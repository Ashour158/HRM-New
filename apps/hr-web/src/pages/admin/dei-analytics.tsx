import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useTenant } from '@/hooks/use-tenant';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChartPanel, DonutChartPanel, type ChartDatum } from '@/components/ui/charts';
import { DataTable } from '@/components/common/data-table';
import { ErrorState } from '@/components/common/error-state';
import { formatDate, formatNumber } from '@/lib/utils';
import { BarChart3, Scale, TrendingDown, Users } from 'lucide-react';

type DeiReportStatus = 'DRAFT' | 'GENERATED' | 'REVIEWED' | 'PUBLISHED' | 'ARCHIVED';
type PayGapReportStatus = 'DRAFT' | 'CALCULATED' | 'REVIEWED' | 'PUBLISHED' | 'ARCHIVED';
type PayEquityReviewStatus = 'PLANNED' | 'IN_PROGRESS' | 'FINDINGS' | 'REMEDIATION' | 'CLOSED';
type AttritionSegmentReportStatus = 'DRAFT' | 'GENERATED' | 'PUBLISHED' | 'ARCHIVED';

interface DeiReport {
  id: string;
  reportType: string;
  reportingPeriod: string;
  countryCode: string;
  metrics?: Record<string, unknown>;
  suppressionApplied?: boolean;
  status: DeiReportStatus;
  updatedAt?: string;
}

interface PayGapReport {
  id: string;
  reportType: string;
  reportingYear: number;
  countryCode: string;
  meanHourlyGap?: number;
  medianHourlyGap?: number;
  quartileDistribution?: Record<string, unknown>;
  status: PayGapReportStatus;
  updatedAt?: string;
}

interface PayEquityReview {
  id: string;
  reviewName: string;
  reviewPeriod: string;
  findings?: Record<string, unknown>;
  remediationActions?: Record<string, unknown>;
  status: PayEquityReviewStatus;
  updatedAt?: string;
}

interface AttritionSegmentReport {
  id: string;
  reportPeriod: string;
  segmentType: string;
  segments?: Record<string, unknown>;
  status: AttritionSegmentReportStatus;
  updatedAt?: string;
}

const emptyDeiReports: DeiReport[] = [];
const emptyPayGapReports: PayGapReport[] = [];
const emptyPayEquityReviews: PayEquityReview[] = [];
const emptyAttritionReports: AttritionSegmentReport[] = [];

function apiData<T>(payload: unknown): T {
  const response = payload as { success?: boolean; data?: T };
  if (response.success === true && response.data !== undefined) return response.data;
  return payload as T;
}

function unwrap<T>(response: { data: unknown }) {
  return apiData<T>(response.data);
}

function humanize(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numericValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function recordToChartData(record: Record<string, unknown>, fallback: ChartDatum[]): ChartDatum[] {
  const data = Object.entries(record)
    .map(([label, value]) => ({ label: humanize(label), value: numericValue(value) }))
    .filter((entry): entry is ChartDatum => typeof entry.value === 'number');
  return data.length > 0 ? data : fallback;
}

function latestByUpdatedAt<T extends { updatedAt?: string }>(records: T[]): T | undefined {
  return [...records].sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())[0];
}

function statusTone(status: string) {
  if (['PUBLISHED', 'CLOSED'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['GENERATED', 'CALCULATED', 'FINDINGS', 'REMEDIATION'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-indigo-200 bg-indigo-50 text-indigo-700';
}

export function AdminDeiAnalytics() {
  const { tenantId } = useTenant();

  const deiReportsQuery = useQuery({
    enabled: Boolean(tenantId),
    queryKey: ['admin-dei-reports', tenantId],
    queryFn: async () => unwrap<DeiReport[]>(await apiClient.get(`/dei-analytics/dei-reports/tenant/${tenantId}`)),
  });
  const payGapReportsQuery = useQuery({
    enabled: Boolean(tenantId),
    queryKey: ['admin-dei-pay-gap-reports', tenantId],
    queryFn: async () => unwrap<PayGapReport[]>(await apiClient.get(`/dei-analytics/pay-gap-reports/tenant/${tenantId}`)),
  });
  const payEquityReviewsQuery = useQuery({
    enabled: Boolean(tenantId),
    queryKey: ['admin-dei-pay-equity-reviews', tenantId],
    queryFn: async () => unwrap<PayEquityReview[]>(await apiClient.get(`/dei-analytics/pay-equity-reviews/tenant/${tenantId}`)),
  });
  const attritionReportsQuery = useQuery({
    enabled: Boolean(tenantId),
    queryKey: ['admin-dei-attrition-segment-reports', tenantId],
    queryFn: async () => unwrap<AttritionSegmentReport[]>(await apiClient.get(`/dei-analytics/attrition-segment-reports/tenant/${tenantId}`)),
  });

  const deiReports = React.useMemo(() => (Array.isArray(deiReportsQuery.data) ? deiReportsQuery.data : emptyDeiReports), [deiReportsQuery.data]);
  const payGapReports = React.useMemo(() => (Array.isArray(payGapReportsQuery.data) ? payGapReportsQuery.data : emptyPayGapReports), [payGapReportsQuery.data]);
  const payEquityReviews = React.useMemo(() => (Array.isArray(payEquityReviewsQuery.data) ? payEquityReviewsQuery.data : emptyPayEquityReviews), [payEquityReviewsQuery.data]);
  const attritionReports = React.useMemo(() => (Array.isArray(attritionReportsQuery.data) ? attritionReportsQuery.data : emptyAttritionReports), [attritionReportsQuery.data]);

  const latestDeiReport = latestByUpdatedAt(deiReports) ?? deiReports[0];
  const latestPayGapReport = latestByUpdatedAt(payGapReports) ?? payGapReports[0];
  const latestPayEquityReview = latestByUpdatedAt(payEquityReviews) ?? payEquityReviews[0];
  const latestAttritionReport = latestByUpdatedAt(attritionReports) ?? attritionReports[0];

  const genderDistribution = recordToChartData(asRecord(latestDeiReport?.metrics?.genderDistribution), [
    { label: 'Female', value: 0 },
    { label: 'Male', value: 0 },
  ]);
  const locationDistribution = recordToChartData(asRecord(latestDeiReport?.metrics?.locationDistribution), [
    { label: 'Configured locations', value: 0 },
  ]);
  const payGapData = [
    { label: 'Mean', value: latestPayGapReport?.meanHourlyGap ?? 0 },
    { label: 'Median', value: latestPayGapReport?.medianHourlyGap ?? 0 },
  ];
  const attritionData = recordToChartData(latestAttritionReport?.segments ?? {}, [{ label: 'No segments', value: 0 }]);
  const equityFindings = asRecord(latestPayEquityReview?.findings);
  const remediationActions = asRecord(latestPayEquityReview?.remediationActions);
  const impactedEmployees = numericValue(equityFindings.impactedEmployees) ?? 0;
  const salaryAdjustments = numericValue(remediationActions.salaryAdjustments) ?? 0;

  const totalReports = deiReports.length + payGapReports.length + payEquityReviews.length + attritionReports.length;
  const publishedReports = deiReports.filter((report) => report.status === 'PUBLISHED').length
    + payGapReports.filter((report) => report.status === 'PUBLISHED').length
    + attritionReports.filter((report) => report.status === 'PUBLISHED').length;
  const openReviews = payEquityReviews.filter((review) => review.status !== 'CLOSED').length;

  const reportColumns = React.useMemo(() => [
    {
      key: 'report',
      header: 'Report',
      cell: (row: DeiReport) => (
        <div>
          <p className="font-semibold text-slate-950">{humanize(row.reportType)}</p>
          <p className="text-xs text-slate-500">{row.reportingPeriod} - {row.countryCode}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: DeiReport) => <Badge variant="outline" className={statusTone(row.status)}>{humanize(row.status)}</Badge>,
    },
    {
      key: 'privacy',
      header: 'Privacy',
      cell: (row: DeiReport) => row.suppressionApplied ? <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">Suppression applied</Badge> : <span className="text-xs text-slate-500">Pending suppression</span>,
    },
  ], []);

  const payGapColumns = React.useMemo(() => [
    {
      key: 'report',
      header: 'Pay gap',
      cell: (row: PayGapReport) => (
        <div>
          <p className="font-semibold text-slate-950">{humanize(row.reportType)}</p>
          <p className="text-xs text-slate-500">{row.countryCode} - {row.reportingYear}</p>
        </div>
      ),
    },
    {
      key: 'gap',
      header: 'Gap',
      cell: (row: PayGapReport) => <span className="font-semibold text-slate-900">{formatNumber(row.meanHourlyGap ?? 0, 1)}% mean / {formatNumber(row.medianHourlyGap ?? 0, 1)}% median</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: PayGapReport) => <Badge variant="outline" className={statusTone(row.status)}>{humanize(row.status)}</Badge>,
    },
  ], []);

  const equityColumns = React.useMemo(() => [
    {
      key: 'review',
      header: 'Review',
      cell: (row: PayEquityReview) => (
        <div>
          <p className="font-semibold text-slate-950">{row.reviewName}</p>
          <p className="text-xs text-slate-500">{row.reviewPeriod}</p>
        </div>
      ),
    },
    {
      key: 'findings',
      header: 'Findings',
      cell: (row: PayEquityReview) => <span>{formatNumber(numericValue(asRecord(row.findings).impactedEmployees) ?? 0)} impacted employees</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: PayEquityReview) => <Badge variant="outline" className={statusTone(row.status)}>{humanize(row.status)}</Badge>,
    },
  ], []);

  const isLoading = deiReportsQuery.isLoading || payGapReportsQuery.isLoading || payEquityReviewsQuery.isLoading || attritionReportsQuery.isLoading;

  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3">People Insight</Badge>
          <h1 className="font-headline text-3xl font-semibold text-slate-950">DEI Analytics</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Monitor workforce representation, pay equity, pay gaps, and attrition patterns from governed DEI reports.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          Latest update: {formatDate(latestDeiReport?.updatedAt ?? latestPayGapReport?.updatedAt)}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: 'Analytics records', value: totalReports, icon: BarChart3 },
          { label: 'Published outputs', value: publishedReports, icon: Users },
          { label: 'Open equity reviews', value: openReviews, icon: Scale },
          { label: 'Employees in findings', value: impactedEmployees, icon: TrendingDown },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
                  <p className="text-2xl font-bold text-slate-950">{metric.value}</p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-primary">
                  <Icon className="h-5 w-5" />
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {deiReportsQuery.isError ? <ErrorState error={deiReportsQuery.error} onRetry={() => deiReportsQuery.refetch()} /> : null}
      {payGapReportsQuery.isError ? <ErrorState error={payGapReportsQuery.error} onRetry={() => payGapReportsQuery.refetch()} /> : null}
      {payEquityReviewsQuery.isError ? <ErrorState error={payEquityReviewsQuery.error} onRetry={() => payEquityReviewsQuery.refetch()} /> : null}
      {attritionReportsQuery.isError ? <ErrorState error={attritionReportsQuery.error} onRetry={() => attritionReportsQuery.refetch()} /> : null}

      <h2 className="sr-only">DEI analytics dashboard</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        <DonutChartPanel title="Gender distribution" data={genderDistribution} />
        <BarChartPanel title="Location distribution" data={locationDistribution} />
        <BarChartPanel title="Pay gap" data={payGapData} />
        <BarChartPanel title="Attrition segments" data={attritionData} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Current equity review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-slate-950">{latestPayEquityReview?.reviewName ?? 'No active review'}</p>
            <p className="mt-1 text-sm text-slate-500">{latestPayEquityReview?.reviewPeriod ?? 'Start a review to track findings'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pay gap signal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-slate-950">{formatNumber(latestPayGapReport?.meanHourlyGap ?? 0, 1)}% mean gap</p>
            <p className="mt-1 text-sm text-slate-500">{latestPayGapReport ? humanize(latestPayGapReport.reportType) : 'No pay gap report'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Attrition focus</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-slate-950">{latestAttritionReport ? humanize(latestAttritionReport.segmentType) : 'No segment selected'}</p>
            <p className="mt-1 text-sm text-slate-500">{latestAttritionReport?.reportPeriod ?? 'Create an attrition segment report'}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="reports" className="space-y-4">
        <TabsList>
          <TabsTrigger value="reports">DEI Reports</TabsTrigger>
          <TabsTrigger value="pay-gap">Pay Gap</TabsTrigger>
          <TabsTrigger value="pay-equity">Pay Equity</TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Report outputs</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={reportColumns}
                data={deiReports}
                emptyMessage="No DEI reports found."
                isLoading={isLoading}
                keyExtractor={(row) => row.id}
                total={deiReports.length}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pay-gap">
          <Card>
            <CardHeader>
              <CardTitle>Pay gap reports</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={payGapColumns}
                data={payGapReports}
                emptyMessage="No pay gap reports found."
                isLoading={isLoading}
                keyExtractor={(row) => row.id}
                total={payGapReports.length}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pay-equity">
          <Card>
            <CardHeader>
              <CardTitle>Pay equity reviews</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current finding</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{formatNumber(numericValue(equityFindings.unexplainedGapPercent) ?? 0, 1)}% unexplained gap</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Remediation</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{formatNumber(salaryAdjustments)} salary adjustments</p>
                </div>
              </div>
              <DataTable
                columns={equityColumns}
                data={payEquityReviews}
                emptyMessage="No pay equity reviews found."
                isLoading={isLoading}
                keyExtractor={(row) => row.id}
                total={payEquityReviews.length}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
