import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  BellRing,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCcw,
  ShieldAlert,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiClient } from '@/lib/api-client';
import { BusinessMetric, BusinessPageHeader, SectionHeading } from '@/components/common/business-page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/common/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';

type HrReportReadiness = 'Live' | 'Attention' | 'No Data';

type HrReportGroup = {
  code: string;
  title: string;
  category: string;
  services?: string[];
  serviceUsageLinks?: string[];
  analyticsOutputs?: string[];
  template?: {
    module: string;
    columns: string[];
    exportArtifact: string;
  };
  brain?: {
    engine: string;
    nervousSystem: string;
  };
  activity: number;
  commands: number;
  events: number;
  notifications: number;
  workflowTransitions: number;
  queueBacklog: number;
  issues: number;
  readiness: HrReportReadiness;
  lastActivityAt?: string;
  chartData: Array<{ label: string; value: number }>;
};

type HrReportsDashboard = {
  generatedAt: string;
  totals: {
    reportGroups: number;
    activeReportGroups: number;
    totalActivity: number;
    queueBacklog: number;
    issues: number;
  };
  reports: HrReportGroup[];
  activityByReport: Array<{ label: string; activity: number; issues: number }>;
};

type HrAnalyticsMetric = {
  label: string;
  value: number;
  unit?: 'days' | 'hours' | 'currency' | 'rating';
  currency?: string;
};

type HrAnalyticsModule = {
  code: string;
  title: string;
  category: string;
  primary: HrAnalyticsMetric;
  secondary: HrAnalyticsMetric;
  risk: HrAnalyticsMetric;
  chart: {
    type: 'bar';
    data: Array<{ label: string; value: number; secondaryValue?: number }>;
  };
  lastActivityAt?: string;
};

type HrAnalyticsDashboard = {
  generatedAt: string;
  totals: {
    activeModules: number;
    riskSignals: number;
    attendanceEmployeeDays: number;
    leaveRequests: number;
    payrollNetPay: number;
    performanceReviews: number;
    benefitsEnrollments: number;
    headcountPositions?: number;
    complianceAcknowledgements?: number;
    serviceCases?: number;
  };
  headlineMetrics: HrAnalyticsMetric[];
  modules: HrAnalyticsModule[];
  riskSignals: Array<{ label: string; value: number }>;
};

function unwrapApiData<T>(payload: unknown): T {
  const response = payload as { success?: boolean; data?: T };
  return response?.success === true && response.data !== undefined ? response.data : payload as T;
}

function readinessTone(readiness: HrReportReadiness) {
  if (readiness === 'Attention') return 'border-[#f59e0b]/35 bg-[#fef3c7] text-[#92400e]';
  if (readiness === 'Live') return 'border-[#10b981]/25 bg-[#d1fae5] text-[#065f46]';
  return 'border-[#cbd5e1] bg-white text-[#475569]';
}

function formatMetricValue(metric: HrAnalyticsMetric) {
  const value = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(metric.value);
  if (metric.unit === 'currency') return `${metric.currency ?? 'USD'} ${value}`;
  if (metric.unit === 'hours') return `${value}h`;
  if (metric.unit === 'days') return `${value}d`;
  if (metric.unit === 'rating') return value;
  return value;
}

const chartColors = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899'];

const migrationTemplates = [
  { module: 'employees', title: 'Employees', owner: 'People Operations' },
  { module: 'attendance', title: 'Attendance', owner: 'Workforce Operations' },
  { module: 'leave', title: 'Leave', owner: 'Absence Administration' },
  { module: 'payroll', title: 'Payroll', owner: 'Payroll Administration' },
  { module: 'performance', title: 'Performance', owner: 'Talent Management' },
  { module: 'benefits', title: 'Benefits', owner: 'Reward Operations' },
  { module: 'headcount-org', title: 'Headcount & Org', owner: 'People Operations' },
  { module: 'compliance', title: 'Compliance', owner: 'Compliance Operations' },
  { module: 'services', title: 'HR Services', owner: 'HR Service Delivery' },
] as const;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminReporting() {
  const addNotification = useUIStore((state) => state.addNotification);
  const dashboardQuery = useQuery({
    queryKey: ['hr-reports-dashboard'],
    queryFn: async () => unwrapApiData<HrReportsDashboard>((await apiClient.get('/reporting/hr-dashboard')).data),
  });
  const analyticsQuery = useQuery({
    queryKey: ['hr-analytics-dashboard'],
    queryFn: async () => unwrapApiData<HrAnalyticsDashboard>((await apiClient.get('/reporting/hr-analytics')).data),
  });

  const downloadCsv = async (path: string, filename: string) => {
    try {
      const response = await apiClient.get(path, { responseType: 'blob' });
      downloadBlob(response.data as Blob, filename);
    } catch (err) {
      addNotification({ title: 'Download failed', message: err instanceof Error ? err.message : 'Could not download reporting file.', type: 'error', read: false });
    }
  };

  const dashboard = dashboardQuery.data;
  const analytics = analyticsQuery.data;
  const topReports = [...(dashboard?.reports ?? [])].sort((a, b) => b.activity - a.activity).slice(0, 5);
  const attentionReports = (dashboard?.reports ?? []).filter((report) => report.readiness === 'Attention');

  return (
    <div className="space-y-6">
      <BusinessPageHeader
        eyebrow="Insights"
        title="HR Reporting"
        subtitle="Track workforce, reward, talent, service, and governance activity from one reporting workspace."
        icon={BarChart3}
        actions={(
          <>
            <Button
              variant="outline"
              onClick={() => {
                void dashboardQuery.refetch();
                void analyticsQuery.refetch();
              }}
              disabled={dashboardQuery.isFetching || analyticsQuery.isFetching}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => downloadCsv('/reporting/employee-import-template.csv', 'employee-import-template.csv')}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Employee Template
            </Button>
            <Button variant="outline" onClick={() => downloadCsv('/reporting/migration-manifest/export.csv', 'hr-migration-manifest.csv')}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Migration Manifest
            </Button>
            <Button variant="outline" onClick={() => downloadCsv('/reporting/hr-dashboard/export.csv', 'hr-reporting-dashboard.csv')}>
              <Download className="mr-2 h-4 w-4" />
              Export Pack
            </Button>
          </>
        )}
      />

      {dashboardQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-24 rounded-2xl" />)}
        </div>
      ) : dashboardQuery.isError ? (
        <ErrorState title="Unable to load reporting" error={dashboardQuery.error} onRetry={() => dashboardQuery.refetch()} />
      ) : dashboard ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <BusinessMetric label="Report Groups" value={`${dashboard.totals.activeReportGroups}/${dashboard.totals.reportGroups}`} tone="success" />
            <BusinessMetric label="Activity" value={dashboard.totals.totalActivity} />
            <BusinessMetric label="Queue Backlog" value={dashboard.totals.queueBacklog} tone={dashboard.totals.queueBacklog > 0 ? 'warning' : 'success'} />
            <BusinessMetric label="Open Issues" value={dashboard.totals.issues} tone={dashboard.totals.issues > 0 ? 'warning' : 'success'} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
            <Card className="rounded-2xl border-[#e2e8f0]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#4f46e5]" />
                  Report Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.activityByReport} margin={{ top: 10, right: 16, left: 0, bottom: 36 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" angle={-25} textAnchor="end" interval={0} height={70} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="activity" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="issues" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#e2e8f0]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-[#f59e0b]" />
                  Attention Queue
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {attentionReports.length > 0 ? attentionReports.map((report) => (
                  <div key={report.code} className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-[#0f172a]">{report.title}</p>
                      <Badge variant="outline" className={cn('border', readinessTone(report.readiness))}>{report.readiness}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[#475569]">{report.issues} issue(s), {report.queueBacklog} queued item(s)</p>
                  </div>
                )) : (
                  <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-sm text-[#166534]">
                    All report groups are clear.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {analyticsQuery.isLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-24 rounded-2xl" />)}
            </div>
          ) : analyticsQuery.isError ? (
            <ErrorState title="Unable to load analytics" error={analyticsQuery.error} onRetry={() => analyticsQuery.refetch()} />
          ) : analytics ? (
            <>
              <SectionHeading title="Cross-Module Analytics" />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {analytics.headlineMetrics.map((metric) => (
                  <BusinessMetric
                    key={metric.label}
                    label={metric.label}
                    value={formatMetricValue(metric)}
                    tone={metric.label === 'Risk Signals' && metric.value > 0 ? 'warning' : 'default'}
                  />
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
                <Card className="rounded-2xl border-[#e2e8f0]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-[#4f46e5]" />
                      Analytics Mix
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.modules.map((module) => ({
                          label: module.code,
                          value: module.primary.value,
                          risk: module.risk.value,
                        }))}
                        margin={{ top: 10, right: 16, left: 0, bottom: 12 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="risk" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-[#e2e8f0]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-[#f59e0b]" />
                      Analytics Signals
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analytics.riskSignals.length > 0 ? analytics.riskSignals.map((signal) => (
                      <div key={signal.label} className="flex items-center justify-between rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3">
                        <span className="text-sm font-medium text-[#0f172a]">{signal.label}</span>
                        <Badge variant="outline" className="border-[#f59e0b]/35 bg-[#fef3c7] text-[#92400e]">{signal.value}</Badge>
                      </div>
                    )) : (
                      <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-sm text-[#166534]">
                        No analytics signals for the selected period.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {analytics.modules.map((module) => (
                  <Card key={module.code} className="rounded-2xl border-[#e2e8f0]">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">{module.title}</CardTitle>
                          <p className="mt-1 text-sm text-[#64748b]">{module.category}</p>
                        </div>
                        <Badge variant="outline" className={module.risk.value > 0 ? 'border-[#f59e0b]/35 bg-[#fef3c7] text-[#92400e]' : 'border-[#10b981]/25 bg-[#d1fae5] text-[#065f46]'}>
                          {module.risk.value > 0 ? `${module.risk.value} signal(s)` : 'Clear'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-[#64748b]">{module.primary.label}</p>
                          <p className="text-lg font-bold text-[#0f172a]">{formatMetricValue(module.primary)}</p>
                        </div>
                        <div>
                          <p className="text-[#64748b]">{module.secondary.label}</p>
                          <p className="text-lg font-bold text-[#0f172a]">{formatMetricValue(module.secondary)}</p>
                        </div>
                        <div>
                          <p className="text-[#64748b]">{module.risk.label}</p>
                          <p className={cn('text-lg font-bold', module.risk.value > 0 ? 'text-[#b45309]' : 'text-[#047857]')}>{formatMetricValue(module.risk)}</p>
                        </div>
                      </div>
                      <div className="h-40">
                        {module.chart.data.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={module.chart.data} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="label" angle={-20} textAnchor="end" interval={0} height={50} tick={{ fontSize: 10 }} />
                              <YAxis allowDecimals={false} />
                              <Tooltip />
                              <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] text-sm text-[#64748b]">
                            No analytics data yet.
                          </div>
                        )}
                      </div>
                      {module.lastActivityAt ? (
                        <p className="text-xs text-[#64748b]">Last activity: {new Date(module.lastActivityAt).toLocaleString()}</p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : null}

          <SectionHeading title="Report Library" />
          <Card className="rounded-2xl border-[#e2e8f0]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-[#10b981]" />
                Migration Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {migrationTemplates.map((template) => (
                  <div key={template.module} className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#0f172a]">{template.title}</p>
                        <p className="mt-1 text-sm text-[#64748b]">{template.owner}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadCsv(`/reporting/module-import-template.csv?module=${template.module}`, `${template.module}-import-template.csv`)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Template
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {dashboard.reports.map((report) => (
              <Card key={report.code} className="rounded-2xl border-[#e2e8f0]">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{report.title}</CardTitle>
                      <p className="mt-1 text-sm text-[#64748b]">{report.category}</p>
                    </div>
                    <Badge variant="outline" className={cn('border', readinessTone(report.readiness))}>{report.readiness}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-[11rem_1fr]">
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={report.chartData.filter((item) => item.value > 0)} dataKey="value" nameKey="label" innerRadius={34} outerRadius={56}>
                          {report.chartData.map((_entry, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[#64748b]">Activity</p>
                      <p className="text-xl font-bold text-[#0f172a]">{report.activity}</p>
                    </div>
                    <div>
                      <p className="text-[#64748b]">Issues</p>
                      <p className="text-xl font-bold text-[#0f172a]">{report.issues}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <BellRing className="h-4 w-4 text-[#4f46e5]" />
                      <span>{report.notifications} notifications</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-[#10b981]" />
                      <span>{report.workflowTransitions} workflows</span>
                    </div>
                    <div className="col-span-2 text-[#64748b]">
                      Last activity: {report.lastActivityAt ? new Date(report.lastActivityAt).toLocaleString() : 'No activity yet'}
                    </div>
                    {report.template ? (
                      <p className="col-span-2 text-xs font-medium text-[#475569]">Template: {report.template.module}</p>
                    ) : null}
                    {report.brain ? (
                      <p className="col-span-2 text-xs font-medium text-[#475569]">Engine: {report.brain.engine}</p>
                    ) : null}
                    {report.analyticsOutputs && report.analyticsOutputs.length > 0 ? (
                      <div className="col-span-2 flex flex-wrap gap-2">
                        {report.analyticsOutputs.slice(0, 4).map((output) => (
                          <Badge key={output} variant="outline" className="border-[#cbd5e1] bg-white text-[#475569]">
                            {output}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="rounded-2xl border-[#e2e8f0]">
            <CardHeader>
              <CardTitle>Top Report Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topReports.map((report) => (
                <div key={report.code} className="grid gap-2 rounded-xl bg-[#f8fafc] p-3 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <p className="font-semibold text-[#0f172a]">{report.title}</p>
                    <p className="text-sm text-[#64748b]">{report.commands} commands, {report.events} events, {report.notifications} notifications</p>
                  </div>
                  <Badge variant="outline" className={cn('border', readinessTone(report.readiness))}>{report.activity} activity</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
