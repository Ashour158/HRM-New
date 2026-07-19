import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { CalendarDays, Star } from 'lucide-react';
import { ReportStatTile } from './stat-tile';
import type { TeamLeaveCalendarReport, TeamPerformanceDistributionReport, TeamPerformanceWorkerRow, UpcomingLeaveRow } from './report-library-types';

function leaveStatusTone(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'APPROVED') return 'default';
  return 'secondary';
}

const upcomingColumns: DataTableColumn<UpcomingLeaveRow>[] = [
  { key: 'workerName', header: 'Employee', cell: (row) => row.workerName },
  { key: 'type', header: 'Type', cell: (row) => row.type },
  { key: 'startDate', header: 'Start', cell: (row) => row.startDate ?? '-' },
  { key: 'endDate', header: 'End', cell: (row) => row.endDate ?? '-' },
  { key: 'status', header: 'Status', cell: (row) => <Badge variant={leaveStatusTone(row.status)}>{row.status.replace('_', ' ')}</Badge> },
];

export function TeamLeaveCalendarReportBody({ report }: { report: TeamLeaveCalendarReport }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <ReportStatTile label="Team size" value={report.summary.teamSize} />
        <ReportStatTile label="Upcoming absences" value={report.summary.totalUpcoming} />
        <ReportStatTile label="On leave today" value={report.summary.onLeaveToday} tone={report.summary.onLeaveToday > 0 ? 'warning' : 'default'} />
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Upcoming and active absences</p>
        {report.upcoming.length > 0 ? (
          <DataTable columns={upcomingColumns} data={report.upcoming} keyExtractor={(row) => row.id} emptyMessage="No upcoming absences." />
        ) : (
          <EmptyState icon={CalendarDays} title="No upcoming absences" description="Your team has no upcoming or active leave right now." />
        )}
      </div>
    </div>
  );
}

const ratingBandLabels: Record<string, string> = {
  NOT_RATED: 'Not rated',
  BELOW_EXPECTATIONS: 'Below expectations',
  MEETS_EXPECTATIONS: 'Meets expectations',
  EXCEEDS_EXPECTATIONS: 'Exceeds expectations',
  OUTSTANDING: 'Outstanding',
};

const workerColumns: DataTableColumn<TeamPerformanceWorkerRow>[] = [
  { key: 'workerName', header: 'Employee', cell: (row) => row.workerName },
  { key: 'latestRating', header: 'Latest rating', cell: (row) => row.latestRating ?? 'Not rated' },
  { key: 'ratingBand', header: 'Band', cell: (row) => <Badge variant="outline">{ratingBandLabels[row.ratingBand] ?? row.ratingBand}</Badge> },
  { key: 'openGoals', header: 'Open goals', cell: (row) => row.openGoals },
  { key: 'achievedGoals', header: 'Achieved goals', cell: (row) => row.achievedGoals },
  { key: 'averageGoalProgress', header: 'Avg goal progress', cell: (row) => `${row.averageGoalProgress}%` },
];

export function TeamPerformanceDistributionReportBody({ report }: { report: TeamPerformanceDistributionReport }) {
  const maxRatingCount = Math.max(1, ...report.ratingDistribution.map((item) => item.count));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <ReportStatTile label="Team size" value={report.workerCount} />
        <ReportStatTile label="Average rating" value={report.averageRating ?? 'Not rated'} />
        <ReportStatTile
          label="Achieved goals"
          value={report.goalStatusDistribution.find((item) => item.status === 'ACHIEVED')?.count ?? 0}
          tone="success"
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Rating distribution</p>
        {report.ratingDistribution.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-border bg-white p-4">
            {report.ratingDistribution.map((item) => (
              <div key={item.band} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-xs font-medium text-muted-foreground">{ratingBandLabels[item.band] ?? item.band}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(item.count / maxRatingCount) * 100}%` }} />
                </div>
                <span className="w-6 shrink-0 text-right text-xs font-semibold text-foreground">{item.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={Star} title="No ratings yet" description="No finalized reviews for your team yet." />
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">By team member</p>
        {report.workers.length > 0 ? (
          <DataTable columns={workerColumns} data={report.workers} keyExtractor={(row) => row.workerId} emptyMessage="No direct reports found." />
        ) : (
          <EmptyState icon={Star} title="No direct reports" description="Assign direct reports to see performance distribution." />
        )}
      </div>
    </div>
  );
}
