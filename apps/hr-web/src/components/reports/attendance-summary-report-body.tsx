import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { Clock3 } from 'lucide-react';
import { ReportStatTile } from './stat-tile';
import type { AttendancePeriodViewDay, AttendancePeriodViewWorker, AttendanceSummaryReport } from './report-library-types';

const dayColumns: DataTableColumn<AttendancePeriodViewDay>[] = [
  { key: 'workDate', header: 'Date', cell: (row) => row.workDate },
  { key: 'present', header: 'Present', cell: (row) => row.present },
  { key: 'absent', header: 'Absent', cell: (row) => row.absent },
  { key: 'onLeave', header: 'On leave', cell: (row) => row.onLeave },
  { key: 'payableHours', header: 'Payable hrs', cell: (row) => row.payableHours.toFixed(1) },
  { key: 'exceptions', header: 'Exceptions', cell: (row) => row.exceptions },
];

const workerColumns: DataTableColumn<AttendancePeriodViewWorker>[] = [
  { key: 'name', header: 'Name', cell: (row) => row.name },
  { key: 'present', header: 'Present days', cell: (row) => row.present },
  { key: 'absent', header: 'Absent days', cell: (row) => row.absent },
  { key: 'onLeave', header: 'On leave', cell: (row) => row.onLeave },
  { key: 'payableHours', header: 'Payable hrs', cell: (row) => row.payableHours.toFixed(1) },
  { key: 'overtimeHours', header: 'Overtime hrs', cell: (row) => row.overtimeHours.toFixed(1) },
  { key: 'exceptions', header: 'Exceptions', cell: (row) => row.exceptions },
];

/**
 * Shared attendance summary body - used for both My Reports (scope SELF)
 * and Team Reports (scope TEAM), since the underlying period-view shape
 * is identical and only the scope + worker breakdown differ.
 */
export function AttendanceSummaryReportBody({ report }: { report: AttendanceSummaryReport }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {report.periodStart} to {report.periodEnd} <Badge variant="outline" className="ms-2">{report.scope === 'TEAM' ? 'Team' : 'Self'}</Badge>
      </p>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <ReportStatTile label="Present days" value={report.totals.present} />
        <ReportStatTile label="Absent days" value={report.totals.absent} tone={report.totals.absent > 0 ? 'warning' : 'default'} />
        <ReportStatTile label="Payable hours" value={report.totals.payableHours.toFixed(1)} />
        <ReportStatTile label="Overtime hours" value={report.totals.overtimeHours.toFixed(1)} />
        <ReportStatTile label="Exceptions" value={report.totals.exceptions} tone={report.totals.exceptions > 0 ? 'warning' : 'default'} />
        <ReportStatTile label="Missing checkout" value={report.totals.missingCheckout} />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Daily breakdown</p>
        {report.series.length > 0 ? (
          <DataTable columns={dayColumns} data={report.series} keyExtractor={(row) => row.workDate} emptyMessage="No attendance activity in this period." />
        ) : (
          <EmptyState icon={Clock3} title="No attendance activity" description="No clock events were recorded in this period." />
        )}
      </div>

      {report.scope === 'TEAM' ? (
        <div>
          <p className="mb-2 text-sm font-semibold text-foreground">By team member</p>
          <DataTable columns={workerColumns} data={report.workers} keyExtractor={(row) => row.workerId} emptyMessage="No direct reports with attendance activity." />
        </div>
      ) : null}
    </div>
  );
}
