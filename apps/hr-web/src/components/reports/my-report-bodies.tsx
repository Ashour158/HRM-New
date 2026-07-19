import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { Umbrella, GraduationCap } from 'lucide-react';
import { ReportStatTile } from './stat-tile';
import type {
  CertificationRow,
  EntitlementCalculationRow,
  LeaveBalanceRow,
  LeaveHistoryRow,
  LearningAssignmentRow,
  LearningProgressReport,
  TimeOffBalanceReport,
} from './report-library-types';

function leaveStatusTone(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'APPROVED') return 'default';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'destructive';
  return 'secondary';
}

const balanceColumns: DataTableColumn<LeaveBalanceRow>[] = [
  { key: 'label', header: 'Leave type', cell: (row) => row.label },
  { key: 'total', header: 'Total', cell: (row) => `${row.total} ${row.unit}` },
  { key: 'used', header: 'Used', cell: (row) => `${row.used} ${row.unit}` },
  { key: 'remaining', header: 'Remaining', cell: (row) => `${row.remaining} ${row.unit}` },
];

const historyColumns: DataTableColumn<LeaveHistoryRow>[] = [
  { key: 'type', header: 'Type', cell: (row) => row.type },
  { key: 'startDate', header: 'Start', cell: (row) => row.startDate ?? '-' },
  { key: 'endDate', header: 'End', cell: (row) => row.endDate ?? '-' },
  { key: 'workingDays', header: 'Working days', cell: (row) => row.workingDays ?? '-' },
  { key: 'status', header: 'Status', cell: (row) => <Badge variant={leaveStatusTone(row.status)}>{row.status.replace('_', ' ')}</Badge> },
];

const entitlementColumns: DataTableColumn<EntitlementCalculationRow>[] = [
  { key: 'leaveType', header: 'Leave type', cell: (row) => row.leaveType },
  { key: 'calculatedEntitlement', header: 'Calculated', cell: (row) => row.calculatedEntitlement },
  { key: 'usedEntitlement', header: 'Used', cell: (row) => row.usedEntitlement },
  { key: 'remainingEntitlement', header: 'Remaining', cell: (row) => row.remainingEntitlement },
  { key: 'calculationDate', header: 'As of', cell: (row) => row.calculationDate ?? '-' },
];

export function TimeOffBalanceReportBody({ report }: { report: TimeOffBalanceReport }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <ReportStatTile label="Total remaining" value={report.summary.totalRemaining} />
        <ReportStatTile label="Pending requests" value={report.summary.pendingRequests} tone={report.summary.pendingRequests > 0 ? 'warning' : 'default'} />
        <ReportStatTile label="Approved requests" value={report.summary.approvedRequests} tone="success" />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Balances</p>
        {report.balances.length > 0 ? (
          <DataTable columns={balanceColumns} data={report.balances} keyExtractor={(row) => row.type} emptyMessage="No leave balances configured." />
        ) : (
          <EmptyState icon={Umbrella} title="No leave balances" description="No accrual balances have been recorded yet." />
        )}
      </div>

      {report.entitlementCalculations.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-semibold text-foreground">Entitlement calculations</p>
          <DataTable columns={entitlementColumns} data={report.entitlementCalculations} keyExtractor={(row) => `${row.leaveType}-${row.calculationDate}`} emptyMessage="No entitlement calculations yet." />
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Request history</p>
        {report.history.length > 0 ? (
          <DataTable columns={historyColumns} data={report.history} keyExtractor={(row) => row.id} emptyMessage="No leave requests yet." />
        ) : (
          <EmptyState icon={Umbrella} title="No leave requests" description="Your leave request history will appear here." />
        )}
      </div>
    </div>
  );
}

function assignmentStatusTone(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'COMPLETED') return 'default';
  if (status === 'EXPIRED' || status === 'CANCELLED') return 'destructive';
  return 'secondary';
}

function certificationStatusTone(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'ACTIVE' || status === 'RENEWED') return 'default';
  if (status === 'EXPIRED' || status === 'REVOKED') return 'destructive';
  return 'secondary';
}

const assignmentColumns: DataTableColumn<LearningAssignmentRow>[] = [
  { key: 'courseTitle', header: 'Course', cell: (row) => row.courseTitle },
  { key: 'status', header: 'Status', cell: (row) => <Badge variant={assignmentStatusTone(row.status)}>{row.status.replace('_', ' ')}</Badge> },
  { key: 'dueDate', header: 'Due', cell: (row) => row.dueDate ?? '-' },
  { key: 'completedAt', header: 'Completed', cell: (row) => row.completedAt ?? '-' },
  { key: 'score', header: 'Score', cell: (row) => row.score ?? '-' },
];

const certificationColumns: DataTableColumn<CertificationRow>[] = [
  { key: 'certificationName', header: 'Certification', cell: (row) => row.certificationName },
  { key: 'issuingBody', header: 'Issuing body', cell: (row) => row.issuingBody ?? '-' },
  { key: 'issueDate', header: 'Issued', cell: (row) => row.issueDate ?? '-' },
  { key: 'expiryDate', header: 'Expires', cell: (row) => row.expiryDate ?? '-' },
  { key: 'status', header: 'Status', cell: (row) => <Badge variant={certificationStatusTone(row.status)}>{row.status}</Badge> },
];

export function LearningProgressReportBody({ report }: { report: LearningProgressReport }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <ReportStatTile label="Assigned" value={report.summary.totalAssigned} />
        <ReportStatTile label="Completed" value={report.summary.completed} tone="success" />
        <ReportStatTile label="In progress" value={report.summary.inProgress} />
        <ReportStatTile label="Overdue" value={report.summary.overdue} tone={report.summary.overdue > 0 ? 'warning' : 'default'} />
        <ReportStatTile label="Active certifications" value={report.summary.activeCertifications} tone="success" />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Course assignments</p>
        {report.assignments.length > 0 ? (
          <DataTable columns={assignmentColumns} data={report.assignments} keyExtractor={(row) => row.id} emptyMessage="No course assignments yet." />
        ) : (
          <EmptyState icon={GraduationCap} title="No course assignments" description="Courses assigned to you will appear here." />
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Certifications</p>
        {report.certifications.length > 0 ? (
          <DataTable columns={certificationColumns} data={report.certifications} keyExtractor={(row) => row.id} emptyMessage="No certifications on file." />
        ) : (
          <EmptyState icon={GraduationCap} title="No certifications" description="Certifications you earn will appear here." />
        )}
      </div>
    </div>
  );
}
