import * as React from 'react';
import { BarChart3, CalendarDays, Clock3, Star } from 'lucide-react';
import { useApiQuery } from '@/hooks/use-api';
import { BusinessPageHeader } from '@/components/common/business-page';
import { ErrorState } from '@/components/common/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportCard, ReportCardGrid } from '@/components/reports/report-card';
import { ReportRunDialog } from '@/components/reports/report-run-dialog';
import { AttendanceSummaryReportBody } from '@/components/reports/attendance-summary-report-body';
import { TeamLeaveCalendarReportBody, TeamPerformanceDistributionReportBody } from '@/components/reports/team-report-bodies';
import type {
  AttendanceSummaryReport,
  ReportLibraryCatalog,
  ReportLibraryDefinition,
  TeamLeaveCalendarReport,
  TeamPerformanceDistributionReport,
} from '@/components/reports/report-library-types';

const iconByKey: Record<string, typeof Clock3> = {
  'team-attendance-summary': Clock3,
  'team-leave-calendar': CalendarDays,
  'team-performance-distribution': Star,
};

/**
 * Team Reports - a small library of prebuilt, one-click reports scoped
 * strictly to the manager's own direct reports. Mirrors the same
 * report-card pattern used by My Reports and Organization Reports.
 */
export function ManagerReports() {
  const [activeKey, setActiveKey] = React.useState<string | null>(null);

  const catalogQuery = useApiQuery<ReportLibraryCatalog>(['report-library-catalog'], '/reports/library/catalog');
  const teamReports = React.useMemo(
    () => (catalogQuery.data?.reports ?? []).filter((report) => report.tier === 'TEAM'),
    [catalogQuery.data],
  );
  const activeDefinition = teamReports.find((report) => report.key === activeKey);

  const reportQuery = useApiQuery<AttendanceSummaryReport | TeamLeaveCalendarReport | TeamPerformanceDistributionReport>(
    ['team-report', activeKey],
    `/reports/library/team/${activeKey}/run`,
    { enabled: Boolean(activeKey && activeDefinition?.kind === 'DATA') },
  );

  const openReport = (definition: ReportLibraryDefinition) => {
    setActiveKey(definition.key);
  };

  return (
    <div className="space-y-6">
      <BusinessPageHeader
        eyebrow="Insights"
        title="Team Reports"
        subtitle="Prebuilt views of your direct reports' attendance, leave, and performance - never another manager's team."
        icon={BarChart3}
      />

      {catalogQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-48 rounded-2xl" />)}
        </div>
      ) : catalogQuery.isError ? (
        <ErrorState title="Unable to load team reports" error={catalogQuery.error} onRetry={() => catalogQuery.refetch()} />
      ) : (
        <ReportCardGrid>
          {teamReports.map((definition) => (
            <ReportCard
              key={definition.key}
              icon={iconByKey[definition.key] ?? BarChart3}
              title={definition.title}
              description={definition.description}
              actionLabel="View report"
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
        {activeKey === 'team-attendance-summary' && reportQuery.data ? (
          <AttendanceSummaryReportBody report={reportQuery.data as AttendanceSummaryReport} />
        ) : null}
        {activeKey === 'team-leave-calendar' && reportQuery.data ? (
          <TeamLeaveCalendarReportBody report={reportQuery.data as TeamLeaveCalendarReport} />
        ) : null}
        {activeKey === 'team-performance-distribution' && reportQuery.data ? (
          <TeamPerformanceDistributionReportBody report={reportQuery.data as TeamPerformanceDistributionReport} />
        ) : null}
      </ReportRunDialog>
    </div>
  );
}
