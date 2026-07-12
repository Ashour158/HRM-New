import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Clock3, FileText, GraduationCap, Umbrella } from 'lucide-react';
import { useApiQuery } from '@/hooks/use-api';
import { BusinessPageHeader } from '@/components/common/business-page';
import { ErrorState } from '@/components/common/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportCard, ReportCardGrid } from '@/components/reports/report-card';
import { ReportRunDialog } from '@/components/reports/report-run-dialog';
import { TimeOffBalanceReportBody, LearningProgressReportBody } from '@/components/reports/my-report-bodies';
import { AttendanceSummaryReportBody } from '@/components/reports/attendance-summary-report-body';
import type {
  AttendanceSummaryReport,
  LearningProgressReport,
  ReportLibraryCatalog,
  ReportLibraryDefinition,
  TimeOffBalanceReport,
} from '@/components/reports/report-library-types';

const iconByKey: Record<string, typeof Umbrella> = {
  'my-time-off-balance': Umbrella,
  'my-attendance-summary': Clock3,
  'my-learning-progress': GraduationCap,
  'my-compensation-payslip': FileText,
};

/**
 * My Reports - a small library of prebuilt, one-click reports scoped
 * strictly to the logged-in employee's own data. Mirrors the same
 * report-card pattern used by Team Reports and Organization Reports.
 */
export function EmployeeReports() {
  const navigate = useNavigate();
  const [activeKey, setActiveKey] = React.useState<string | null>(null);

  const catalogQuery = useApiQuery<ReportLibraryCatalog>(['report-library-catalog'], '/reports/library/catalog');
  const myReports = React.useMemo(
    () => (catalogQuery.data?.reports ?? []).filter((report) => report.tier === 'MY'),
    [catalogQuery.data],
  );
  const activeDefinition = myReports.find((report) => report.key === activeKey);

  const reportQuery = useApiQuery<TimeOffBalanceReport | AttendanceSummaryReport | LearningProgressReport>(
    ['my-report', activeKey],
    `/reports/library/my/${activeKey}/run`,
    { enabled: Boolean(activeKey && activeDefinition?.kind === 'DATA') },
  );

  const openReport = (definition: ReportLibraryDefinition) => {
    if (definition.kind === 'LINK') {
      if (definition.linkTo) navigate(definition.linkTo);
      return;
    }
    setActiveKey(definition.key);
  };

  return (
    <div className="space-y-6">
      <BusinessPageHeader
        eyebrow="Insights"
        title="My Reports"
        subtitle="Prebuilt views of your own time-off, attendance, and learning data - always scoped to you."
        icon={BarChart3}
      />

      {catalogQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-48 rounded-2xl" />)}
        </div>
      ) : catalogQuery.isError ? (
        <ErrorState title="Unable to load your reports" error={catalogQuery.error} onRetry={() => catalogQuery.refetch()} />
      ) : (
        <ReportCardGrid>
          {myReports.map((definition) => (
            <ReportCard
              key={definition.key}
              icon={iconByKey[definition.key] ?? BarChart3}
              title={definition.title}
              description={definition.description}
              badge={definition.kind === 'LINK' ? 'Link' : undefined}
              actionLabel={definition.kind === 'LINK' ? 'Open' : 'View report'}
              onAction={() => openReport(definition)}
            />
          ))}
        </ReportCardGrid>
      )}

      <ReportRunDialog
        open={Boolean(activeKey && activeDefinition?.kind === 'DATA')}
        onOpenChange={(open) => { if (!open) setActiveKey(null); }}
        title={activeDefinition?.title ?? 'Report'}
        description={activeDefinition?.description ?? ''}
        isLoading={reportQuery.isLoading}
        isError={reportQuery.isError}
        error={reportQuery.error}
        onRetry={() => reportQuery.refetch()}
        generatedAt={reportQuery.data?.generatedAt}
      >
        {activeKey === 'my-time-off-balance' && reportQuery.data ? (
          <TimeOffBalanceReportBody report={reportQuery.data as TimeOffBalanceReport} />
        ) : null}
        {activeKey === 'my-attendance-summary' && reportQuery.data ? (
          <AttendanceSummaryReportBody report={reportQuery.data as AttendanceSummaryReport} />
        ) : null}
        {activeKey === 'my-learning-progress' && reportQuery.data ? (
          <LearningProgressReportBody report={reportQuery.data as LearningProgressReport} />
        ) : null}
      </ReportRunDialog>
    </div>
  );
}
