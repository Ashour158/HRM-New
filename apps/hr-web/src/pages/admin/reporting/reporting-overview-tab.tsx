import { FileText, ShieldAlert } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { BusinessMetric } from '@/components/common/business-page';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { readinessTone, type HrReportGroup, type HrReportsDashboard } from './reporting-model';

export function ReportingOverviewTab({
  attentionReports,
  dashboard,
}: {
  attentionReports: HrReportGroup[];
  dashboard: HrReportsDashboard;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <BusinessMetric label="Report Groups" value={`${dashboard.totals.activeReportGroups}/${dashboard.totals.reportGroups}`} tone="success" />
        <BusinessMetric label="Activity" value={dashboard.totals.totalActivity} />
        <BusinessMetric label="Queue Backlog" value={dashboard.totals.queueBacklog} tone={dashboard.totals.queueBacklog > 0 ? 'warning' : 'success'} />
        <BusinessMetric label="Open Issues" value={dashboard.totals.issues} tone={dashboard.totals.issues > 0 ? 'warning' : 'success'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <Card className="rounded-2xl border-border">
          <CardHeader>
            <h2 className="flex items-center gap-2 font-headline text-2xl font-semibold leading-tight text-card-foreground">
              <FileText className="h-5 w-5 text-primary" />
              Report Activity
            </h2>
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

        <Card className="rounded-2xl border-border">
          <CardHeader>
            <h2 className="flex items-center gap-2 font-headline text-2xl font-semibold leading-tight text-card-foreground">
              <ShieldAlert className="h-5 w-5 text-warning" />
              Attention Queue
            </h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {attentionReports.length > 0 ? attentionReports.map((report) => (
              <div key={report.code} className="rounded-xl border border-warning bg-warning/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">{report.title}</p>
                  <Badge variant="outline" className={cn('border', readinessTone(report.readiness))}>{report.readiness}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{report.issues} issue(s), {report.queueBacklog} queued item(s)</p>
              </div>
            )) : (
              <div className="rounded-xl border border-success bg-success/15 p-4 text-sm text-success-foreground">
                All report groups are clear.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
