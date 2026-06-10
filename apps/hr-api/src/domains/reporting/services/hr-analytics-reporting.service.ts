import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { sql } from 'kysely';

export interface HrAnalyticsSummaryOptions {
  from?: Date;
  to?: Date;
}

export interface RawSqlLoaderContract {
  name: string;
  tables: Array<{
    schema: string;
    table: string;
    columns: string[];
  }>;
}

export const HR_ANALYTICS_RAW_SQL_LOADERS: RawSqlLoaderContract[] = [
  {
    name: 'hr-analytics.attendance',
    tables: [{ schema: 'hr_time', table: 'attendance_daily_ledgers', columns: ['tenant_id', 'status', 'work_date', 'exception_count', 'late_minutes', 'overtime_minutes', 'payable_minutes', 'ready_for_payroll', 'updated_at'] }],
  },
  {
    name: 'hr-analytics.leave',
    tables: [{ schema: 'hr_absence', table: 'absence_requests', columns: ['tenant_id', 'status', 'start_date', 'end_date', 'updated_at'] }],
  },
  {
    name: 'hr-analytics.payroll',
    tables: [
      { schema: 'hr_payroll', table: 'payroll_calculation_runs', columns: ['tenant_id', 'payroll_cycle_id', 'status', 'currency', 'total_workers', 'total_gross_pay', 'total_net_pay', 'created_at', 'updated_at'] },
      { schema: 'hr_payroll', table: 'payroll_cycles', columns: ['tenant_id', 'id', 'pay_period_start', 'pay_period_end'] },
    ],
  },
  {
    name: 'hr-analytics.performance',
    tables: [{ schema: 'hr_performance', table: 'performance_reviews', columns: ['tenant_id', 'status', 'final_rating', 'calibrated_rating', 'created_at', 'updated_at'] }],
  },
  {
    name: 'hr-analytics.benefits',
    tables: [
      { schema: 'hr_benefits', table: 'benefits_enrollments', columns: ['tenant_id', 'status', 'coverage_level', 'dependents', 'effective_date', 'updated_at'] },
      { schema: 'hr_benefits', table: 'benefits_programs', columns: ['tenant_id', 'status', 'program_type', 'effective_from', 'effective_until', 'created_at'] },
    ],
  },
  {
    name: 'hr-analytics.headcount-org',
    tables: [
      { schema: 'hr_position', table: 'positions', columns: ['tenant_id', 'status', 'filled_by_worker_id', 'created_at', 'updated_at'] },
      { schema: 'hr_position', table: 'headcount_requests', columns: ['tenant_id', 'status', 'positions_approved', 'created_at', 'updated_at'] },
    ],
  },
  {
    name: 'hr-analytics.compliance',
    tables: [
      { schema: 'hr_compliance', table: 'policy_acknowledgements', columns: ['tenant_id', 'status', 'acknowledged_at', 'due_date', 'created_at', 'updated_at'] },
      { schema: 'hr_compliance', table: 'statutory_reports', columns: ['tenant_id', 'status', 'created_at', 'updated_at'] },
    ],
  },
  {
    name: 'hr-analytics.services',
    tables: [
      { schema: 'hr_service_delivery', table: 'hr_service_cases', columns: ['tenant_id', 'status', 'sla_deadline', 'resolved_at', 'created_at', 'updated_at'] },
      { schema: 'hr_service_delivery', table: 'hr_case_tasks', columns: ['tenant_id', 'status', 'created_at'] },
      { schema: 'hr_service_delivery', table: 'hr_service_catalog_items', columns: ['tenant_id', 'status', 'sla_hours', 'created_at'] },
    ],
  },
];

export type HrAnalyticsModuleCode =
  | 'ATTENDANCE'
  | 'LEAVE'
  | 'PAYROLL'
  | 'PERFORMANCE'
  | 'BENEFITS'
  | 'HEADCOUNT_ORG'
  | 'COMPLIANCE'
  | 'SERVICES';
export type HrAnalyticsMetricUnit = 'days' | 'hours' | 'currency' | 'rating';

export interface HrAnalyticsMetric {
  label: string;
  value: number;
  unit?: HrAnalyticsMetricUnit;
  currency?: string;
}

export interface HrAnalyticsChartPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

export interface HrAnalyticsModule {
  code: HrAnalyticsModuleCode;
  title: string;
  category: string;
  primary: HrAnalyticsMetric;
  secondary: HrAnalyticsMetric;
  risk: HrAnalyticsMetric;
  chart: {
    type: 'bar';
    data: HrAnalyticsChartPoint[];
  };
  lastActivityAt?: string;
}

export interface HrAnalyticsDashboard {
  tenantId: string;
  generatedAt: string;
  period: {
    from?: string;
    to?: string;
  };
  totals: {
    activeModules: number;
    riskSignals: number;
    attendanceEmployeeDays: number;
    leaveRequests: number;
    payrollNetPay: number;
    performanceReviews: number;
    benefitsEnrollments: number;
    headcountPositions: number;
    complianceAcknowledgements: number;
    serviceCases: number;
  };
  headlineMetrics: HrAnalyticsMetric[];
  modules: HrAnalyticsModule[];
  riskSignals: Array<{ label: string; value: number }>;
}

export interface AttendanceAnalyticsRow {
  status: string;
  employeeDays: number;
  exceptionCount: number;
  lateMinutes: number;
  overtimeMinutes: number;
  payableMinutes: number;
  readyForPayrollDays: number;
  lastActivityAt?: Date | string | null;
}

export interface LeaveAnalyticsRow {
  status: string;
  requestCount: number;
  requestedDays: number;
  lastActivityAt?: Date | string | null;
}

export interface PayrollAnalyticsRow {
  status: string;
  currency: string;
  runCount: number;
  workerCount: number;
  grossPay: number;
  netPay: number;
  lastActivityAt?: Date | string | null;
}

export interface PerformanceAnalyticsRow {
  status: string;
  reviewCount: number;
  averageRating?: number | null;
  lastActivityAt?: Date | string | null;
}

export interface PerformanceRatingAnalyticsRow {
  ratingBand: string;
  reviewCount: number;
}

export interface BenefitsAnalyticsRow {
  status: string;
  coverageLevel: string;
  enrollmentCount: number;
  dependentCount: number;
  lastActivityAt?: Date | string | null;
}

export interface BenefitsProgramAnalyticsRow {
  programType: string;
  programCount: number;
  activeCount: number;
}

export interface HeadcountOrgAnalyticsRow {
  status: string;
  positionCount: number;
  filledCount: number;
  vacantCount: number;
  headcountRequests: number;
  approvedHeadcount: number;
  lastActivityAt?: Date | string | null;
}

export interface ComplianceAnalyticsRow {
  status: string;
  acknowledgementCount: number;
  overdueCount: number;
  lastActivityAt?: Date | string | null;
}

export interface StatutoryReportAnalyticsRow {
  status: string;
  reportCount: number;
  lastActivityAt?: Date | string | null;
}

export interface ServiceDeliveryAnalyticsRow {
  status: string;
  caseCount: number;
  breachedSlaCount: number;
  openTaskCount: number;
  lastActivityAt?: Date | string | null;
}

export interface ServiceCatalogAnalyticsRow {
  status: string;
  itemCount: number;
  averageSlaHours: number;
}

export interface HrAnalyticsSourceRows {
  attendance: AttendanceAnalyticsRow[];
  leave: LeaveAnalyticsRow[];
  payroll: PayrollAnalyticsRow[];
  performance: PerformanceAnalyticsRow[];
  performanceRatings: PerformanceRatingAnalyticsRow[];
  benefits: BenefitsAnalyticsRow[];
  benefitsPrograms: BenefitsProgramAnalyticsRow[];
  headcountOrg: HeadcountOrgAnalyticsRow[];
  compliance: ComplianceAnalyticsRow[];
  statutoryReports: StatutoryReportAnalyticsRow[];
  services: ServiceDeliveryAnalyticsRow[];
  serviceCatalog: ServiceCatalogAnalyticsRow[];
}

interface AttendanceSqlRow {
  status: string;
  employee_days: string | number | bigint;
  exception_count: string | number | bigint | null;
  late_minutes: string | number | bigint | null;
  overtime_minutes: string | number | bigint | null;
  payable_minutes: string | number | bigint | null;
  ready_for_payroll_days: string | number | bigint | null;
  last_activity_at: Date | string | null;
}

interface LeaveSqlRow {
  status: string;
  request_count: string | number | bigint;
  requested_days: string | number | bigint | null;
  last_activity_at: Date | string | null;
}

interface PayrollSqlRow {
  status: string;
  currency: string | null;
  run_count: string | number | bigint;
  worker_count: string | number | bigint | null;
  gross_pay: string | number | bigint | null;
  net_pay: string | number | bigint | null;
  last_activity_at: Date | string | null;
}

interface PerformanceSqlRow {
  status: string;
  review_count: string | number | bigint;
  average_rating: string | number | bigint | null;
  last_activity_at: Date | string | null;
}

interface PerformanceRatingSqlRow {
  rating_band: string;
  review_count: string | number | bigint;
}

interface BenefitsSqlRow {
  status: string;
  coverage_level: string | null;
  enrollment_count: string | number | bigint;
  dependent_count: string | number | bigint | null;
  last_activity_at: Date | string | null;
}

interface BenefitsProgramSqlRow {
  program_type: string | null;
  program_count: string | number | bigint;
  active_count: string | number | bigint | null;
}

interface HeadcountOrgSqlRow {
  status: string;
  position_count: string | number | bigint | null;
  filled_count: string | number | bigint | null;
  vacant_count: string | number | bigint | null;
  headcount_requests: string | number | bigint | null;
  approved_headcount: string | number | bigint | null;
  last_activity_at: Date | string | null;
}

interface ComplianceSqlRow {
  status: string;
  acknowledgement_count: string | number | bigint;
  overdue_count: string | number | bigint | null;
  last_activity_at: Date | string | null;
}

interface StatutoryReportSqlRow {
  status: string;
  report_count: string | number | bigint;
  last_activity_at: Date | string | null;
}

interface ServiceDeliverySqlRow {
  status: string;
  case_count: string | number | bigint;
  breached_sla_count: string | number | bigint | null;
  open_task_count: string | number | bigint | null;
  last_activity_at: Date | string | null;
}

interface ServiceCatalogSqlRow {
  status: string;
  item_count: string | number | bigint;
  average_sla_hours: string | number | bigint | null;
}

export function buildHrAnalyticsDashboard(
  tenantId: string,
  source: HrAnalyticsSourceRows,
  generatedAt = new Date(),
  options: HrAnalyticsSummaryOptions = {},
): HrAnalyticsDashboard {
  const modules = [
    buildAttendanceModule(source.attendance),
    buildLeaveModule(source.leave),
    buildPayrollModule(source.payroll),
    buildPerformanceModule(source.performance, source.performanceRatings),
    buildBenefitsModule(source.benefits, source.benefitsPrograms),
    buildHeadcountOrgModule(source.headcountOrg),
    buildComplianceModule(source.compliance, source.statutoryReports),
    buildServicesModule(source.services, source.serviceCatalog),
  ];
  const totals = {
    activeModules: modules.filter((module) => module.primary.value > 0).length,
    riskSignals: modules.reduce((total, module) => total + module.risk.value, 0),
    attendanceEmployeeDays: modules[0].primary.value,
    leaveRequests: modules[1].primary.value,
    payrollNetPay: modules[2].primary.value,
    performanceReviews: modules[3].primary.value,
    benefitsEnrollments: modules[4].primary.value,
    headcountPositions: modules[5].primary.value,
    complianceAcknowledgements: modules[6].primary.value,
    serviceCases: modules[7].primary.value,
  };

  return {
    tenantId,
    generatedAt: generatedAt.toISOString(),
    period: {
      ...(options.from ? { from: options.from.toISOString() } : {}),
      ...(options.to ? { to: options.to.toISOString() } : {}),
    },
    totals,
    headlineMetrics: [
      { label: 'Analytics Modules', value: totals.activeModules },
      { label: 'Risk Signals', value: totals.riskSignals },
      { label: 'Payroll Net Pay', value: totals.payrollNetPay, unit: 'currency', currency: modules[2].primary.currency },
      { label: 'Service Cases', value: totals.serviceCases },
    ],
    modules,
    riskSignals: modules
      .filter((module) => module.risk.value > 0)
      .map((module) => ({ label: module.title, value: module.risk.value })),
  };
}

@Injectable()
export class HrAnalyticsReportingService {
  private readonly db = createKyselyInstance(getPool());

  async getDashboard(tenantId: Uuid, options: HrAnalyticsSummaryOptions = {}): Promise<HrAnalyticsDashboard> {
    const [
      attendance,
      leave,
      payroll,
      performance,
      performanceRatings,
      benefits,
      benefitsPrograms,
      headcountOrg,
      compliance,
      statutoryReports,
      services,
      serviceCatalog,
    ] = await Promise.all([
      this.loadAttendance(tenantId, options),
      this.loadLeave(tenantId, options),
      this.loadPayroll(tenantId, options),
      this.loadPerformance(tenantId, options),
      this.loadPerformanceRatings(tenantId, options),
      this.loadBenefits(tenantId, options),
      this.loadBenefitsPrograms(tenantId, options),
      this.loadHeadcountOrg(tenantId, options),
      this.loadCompliance(tenantId, options),
      this.loadStatutoryReports(tenantId, options),
      this.loadServices(tenantId, options),
      this.loadServiceCatalog(tenantId, options),
    ]);

    return buildHrAnalyticsDashboard(
      tenantId.value,
      {
        attendance,
        leave,
        payroll,
        performance,
        performanceRatings,
        benefits,
        benefitsPrograms,
        headcountOrg,
        compliance,
        statutoryReports,
        services,
        serviceCatalog,
      },
      new Date(),
      options,
    );
  }

  private async loadAttendance(tenantId: Uuid, options: HrAnalyticsSummaryOptions): Promise<AttendanceAnalyticsRow[]> {
    const from = options.from ?? null;
    const to = options.to ?? null;
    const result = await sql<AttendanceSqlRow>`
      SELECT
        status,
        COUNT(*) AS employee_days,
        COALESCE(SUM(exception_count), 0) AS exception_count,
        COALESCE(SUM(late_minutes), 0) AS late_minutes,
        COALESCE(SUM(overtime_minutes), 0) AS overtime_minutes,
        COALESCE(SUM(payable_minutes), 0) AS payable_minutes,
        COUNT(*) FILTER (WHERE ready_for_payroll) AS ready_for_payroll_days,
        MAX(updated_at) AS last_activity_at
      FROM hr_time.attendance_daily_ledgers
      WHERE tenant_id = ${tenantId.value}
        AND (${from}::date IS NULL OR work_date >= ${from}::date)
        AND (${to}::date IS NULL OR work_date <= ${to}::date)
      GROUP BY status
    `.execute(this.db);

    return result.rows.map((row) => ({
      status: row.status,
      employeeDays: numberValue(row.employee_days),
      exceptionCount: numberValue(row.exception_count),
      lateMinutes: numberValue(row.late_minutes),
      overtimeMinutes: numberValue(row.overtime_minutes),
      payableMinutes: numberValue(row.payable_minutes),
      readyForPayrollDays: numberValue(row.ready_for_payroll_days),
      lastActivityAt: row.last_activity_at,
    }));
  }

  private async loadLeave(tenantId: Uuid, options: HrAnalyticsSummaryOptions): Promise<LeaveAnalyticsRow[]> {
    const from = options.from ?? null;
    const to = options.to ?? null;
    const result = await sql<LeaveSqlRow>`
      SELECT
        status,
        COUNT(*) AS request_count,
        COALESCE(SUM(GREATEST((end_date - start_date) + 1, 0)), 0) AS requested_days,
        MAX(updated_at) AS last_activity_at
      FROM hr_absence.absence_requests
      WHERE tenant_id = ${tenantId.value}
        AND (${from}::date IS NULL OR end_date >= ${from}::date)
        AND (${to}::date IS NULL OR start_date <= ${to}::date)
      GROUP BY status
    `.execute(this.db);

    return result.rows.map((row) => ({
      status: row.status,
      requestCount: numberValue(row.request_count),
      requestedDays: numberValue(row.requested_days),
      lastActivityAt: row.last_activity_at,
    }));
  }

  private async loadPayroll(tenantId: Uuid, options: HrAnalyticsSummaryOptions): Promise<PayrollAnalyticsRow[]> {
    const from = options.from ?? null;
    const to = options.to ?? null;
    const result = await sql<PayrollSqlRow>`
      SELECT
        runs.status,
        COALESCE(runs.currency, 'UNKNOWN') AS currency,
        COUNT(*) AS run_count,
        COALESCE(SUM(runs.total_workers), 0) AS worker_count,
        COALESCE(SUM(runs.total_gross_pay), 0) AS gross_pay,
        COALESCE(SUM(runs.total_net_pay), 0) AS net_pay,
        MAX(runs.updated_at) AS last_activity_at
      FROM hr_payroll.payroll_calculation_runs runs
      LEFT JOIN hr_payroll.payroll_cycles cycles
        ON cycles.id = runs.payroll_cycle_id
       AND cycles.tenant_id = runs.tenant_id
      WHERE runs.tenant_id = ${tenantId.value}
        AND (${from}::date IS NULL OR COALESCE(cycles.pay_period_end, runs.created_at::date) >= ${from}::date)
        AND (${to}::date IS NULL OR COALESCE(cycles.pay_period_start, runs.created_at::date) <= ${to}::date)
      GROUP BY runs.status, runs.currency
    `.execute(this.db);

    return result.rows.map((row) => ({
      status: row.status,
      currency: row.currency ?? 'UNKNOWN',
      runCount: numberValue(row.run_count),
      workerCount: numberValue(row.worker_count),
      grossPay: numberValue(row.gross_pay),
      netPay: numberValue(row.net_pay),
      lastActivityAt: row.last_activity_at,
    }));
  }

  private async loadPerformance(tenantId: Uuid, options: HrAnalyticsSummaryOptions): Promise<PerformanceAnalyticsRow[]> {
    const from = options.from ?? null;
    const to = options.to ?? null;
    const result = await sql<PerformanceSqlRow>`
      SELECT
        status,
        COUNT(*) AS review_count,
        AVG(COALESCE(final_rating, calibrated_rating)) AS average_rating,
        MAX(updated_at) AS last_activity_at
      FROM hr_performance.performance_reviews
      WHERE tenant_id = ${tenantId.value}
        AND (${from}::date IS NULL OR created_at::date >= ${from}::date)
        AND (${to}::date IS NULL OR created_at::date <= ${to}::date)
      GROUP BY status
    `.execute(this.db);

    return result.rows.map((row) => ({
      status: row.status,
      reviewCount: numberValue(row.review_count),
      averageRating: row.average_rating === null ? null : numberValue(row.average_rating),
      lastActivityAt: row.last_activity_at,
    }));
  }

  private async loadPerformanceRatings(tenantId: Uuid, options: HrAnalyticsSummaryOptions): Promise<PerformanceRatingAnalyticsRow[]> {
    const from = options.from ?? null;
    const to = options.to ?? null;
    const result = await sql<PerformanceRatingSqlRow>`
      SELECT
        CASE
          WHEN COALESCE(final_rating, calibrated_rating) IS NULL THEN 'Unrated'
          WHEN COALESCE(final_rating, calibrated_rating) >= 4 THEN '4-5'
          WHEN COALESCE(final_rating, calibrated_rating) >= 3 THEN '3-4'
          WHEN COALESCE(final_rating, calibrated_rating) >= 2 THEN '2-3'
          ELSE '1-2'
        END AS rating_band,
        COUNT(*) AS review_count
      FROM hr_performance.performance_reviews
      WHERE tenant_id = ${tenantId.value}
        AND (${from}::date IS NULL OR created_at::date >= ${from}::date)
        AND (${to}::date IS NULL OR created_at::date <= ${to}::date)
      GROUP BY rating_band
    `.execute(this.db);

    return result.rows.map((row) => ({
      ratingBand: row.rating_band,
      reviewCount: numberValue(row.review_count),
    }));
  }

  private async loadBenefits(tenantId: Uuid, options: HrAnalyticsSummaryOptions): Promise<BenefitsAnalyticsRow[]> {
    const from = options.from ?? null;
    const to = options.to ?? null;
    const result = await sql<BenefitsSqlRow>`
      SELECT
        status,
        COALESCE(coverage_level, 'UNKNOWN') AS coverage_level,
        COUNT(*) AS enrollment_count,
        COALESCE(SUM(jsonb_array_length(dependents)), 0) AS dependent_count,
        MAX(updated_at) AS last_activity_at
      FROM hr_benefits.benefits_enrollments
      WHERE tenant_id = ${tenantId.value}
        AND (${from}::date IS NULL OR effective_date >= ${from}::date)
        AND (${to}::date IS NULL OR effective_date <= ${to}::date)
      GROUP BY status, coverage_level
    `.execute(this.db);

    return result.rows.map((row) => ({
      status: row.status,
      coverageLevel: row.coverage_level ?? 'UNKNOWN',
      enrollmentCount: numberValue(row.enrollment_count),
      dependentCount: numberValue(row.dependent_count),
      lastActivityAt: row.last_activity_at,
    }));
  }

  private async loadBenefitsPrograms(tenantId: Uuid, options: HrAnalyticsSummaryOptions): Promise<BenefitsProgramAnalyticsRow[]> {
    const from = options.from ?? null;
    const to = options.to ?? null;
    const result = await sql<BenefitsProgramSqlRow>`
      SELECT
        COALESCE(program_type, 'UNKNOWN') AS program_type,
        COUNT(*) AS program_count,
        COUNT(*) FILTER (WHERE status IN ('ACTIVE', 'PUBLISHED')) AS active_count
      FROM hr_benefits.benefits_programs
      WHERE tenant_id = ${tenantId.value}
        AND (${from}::date IS NULL OR COALESCE(effective_until, created_at::date) >= ${from}::date)
        AND (${to}::date IS NULL OR COALESCE(effective_from, created_at::date) <= ${to}::date)
      GROUP BY program_type
    `.execute(this.db);

    return result.rows.map((row) => ({
      programType: row.program_type ?? 'UNKNOWN',
      programCount: numberValue(row.program_count),
      activeCount: numberValue(row.active_count),
    }));
  }

  private async loadHeadcountOrg(tenantId: Uuid, options: HrAnalyticsSummaryOptions): Promise<HeadcountOrgAnalyticsRow[]> {
    const from = options.from ?? null;
    const to = options.to ?? null;
    const result = await sql<HeadcountOrgSqlRow>`
      WITH position_usage AS (
        SELECT
          status,
          COUNT(*) AS position_count,
          COUNT(*) FILTER (WHERE filled_by_worker_id IS NOT NULL) AS filled_count,
          COUNT(*) FILTER (WHERE filled_by_worker_id IS NULL) AS vacant_count,
          MAX(updated_at) AS last_activity_at
        FROM hr_position.positions
        WHERE tenant_id = ${tenantId.value}
          AND (${from}::date IS NULL OR created_at::date >= ${from}::date)
          AND (${to}::date IS NULL OR created_at::date <= ${to}::date)
        GROUP BY status
      ),
      request_usage AS (
        SELECT
          status,
          COUNT(*) AS headcount_requests,
          COALESCE(SUM(positions_approved), 0) AS approved_headcount,
          MAX(updated_at) AS last_activity_at
        FROM hr_position.headcount_requests
        WHERE tenant_id = ${tenantId.value}
          AND (${from}::date IS NULL OR created_at::date >= ${from}::date)
          AND (${to}::date IS NULL OR created_at::date <= ${to}::date)
        GROUP BY status
      )
      SELECT
        COALESCE(position_usage.status, request_usage.status, 'UNKNOWN') AS status,
        COALESCE(position_usage.position_count, 0) AS position_count,
        COALESCE(position_usage.filled_count, 0) AS filled_count,
        COALESCE(position_usage.vacant_count, 0) AS vacant_count,
        COALESCE(request_usage.headcount_requests, 0) AS headcount_requests,
        COALESCE(request_usage.approved_headcount, 0) AS approved_headcount,
        GREATEST(position_usage.last_activity_at, request_usage.last_activity_at) AS last_activity_at
      FROM position_usage
      FULL OUTER JOIN request_usage
        ON request_usage.status = position_usage.status
    `.execute(this.db);

    return result.rows.map((row) => ({
      status: row.status,
      positionCount: numberValue(row.position_count),
      filledCount: numberValue(row.filled_count),
      vacantCount: numberValue(row.vacant_count),
      headcountRequests: numberValue(row.headcount_requests),
      approvedHeadcount: numberValue(row.approved_headcount),
      lastActivityAt: row.last_activity_at,
    }));
  }

  private async loadCompliance(tenantId: Uuid, options: HrAnalyticsSummaryOptions): Promise<ComplianceAnalyticsRow[]> {
    const from = options.from ?? null;
    const to = options.to ?? null;
    const result = await sql<ComplianceSqlRow>`
      SELECT
        status,
        COUNT(*) AS acknowledgement_count,
        COUNT(*) FILTER (
          WHERE acknowledged_at IS NULL
            AND due_date IS NOT NULL
            AND due_date < now()
        ) AS overdue_count,
        MAX(updated_at) AS last_activity_at
      FROM hr_compliance.policy_acknowledgements
      WHERE tenant_id = ${tenantId.value}
        AND (${from}::date IS NULL OR created_at::date >= ${from}::date)
        AND (${to}::date IS NULL OR created_at::date <= ${to}::date)
      GROUP BY status
    `.execute(this.db);

    return result.rows.map((row) => ({
      status: row.status,
      acknowledgementCount: numberValue(row.acknowledgement_count),
      overdueCount: numberValue(row.overdue_count),
      lastActivityAt: row.last_activity_at,
    }));
  }

  private async loadStatutoryReports(tenantId: Uuid, options: HrAnalyticsSummaryOptions): Promise<StatutoryReportAnalyticsRow[]> {
    const from = options.from ?? null;
    const to = options.to ?? null;
    const result = await sql<StatutoryReportSqlRow>`
      SELECT
        status,
        COUNT(*) AS report_count,
        MAX(updated_at) AS last_activity_at
      FROM hr_compliance.statutory_reports
      WHERE tenant_id = ${tenantId.value}
        AND (${from}::date IS NULL OR created_at::date >= ${from}::date)
        AND (${to}::date IS NULL OR created_at::date <= ${to}::date)
      GROUP BY status
    `.execute(this.db);

    return result.rows.map((row) => ({
      status: row.status,
      reportCount: numberValue(row.report_count),
      lastActivityAt: row.last_activity_at,
    }));
  }

  private async loadServices(tenantId: Uuid, options: HrAnalyticsSummaryOptions): Promise<ServiceDeliveryAnalyticsRow[]> {
    const from = options.from ?? null;
    const to = options.to ?? null;
    const result = await sql<ServiceDeliverySqlRow>`
      WITH case_usage AS (
        SELECT
          status,
          COUNT(*) AS case_count,
          COUNT(*) FILTER (
            WHERE sla_deadline IS NOT NULL
              AND sla_deadline < COALESCE(resolved_at, now())
              AND status NOT IN ('CLOSED', 'RESOLVED', 'CANCELLED')
          ) AS breached_sla_count,
          MAX(updated_at) AS last_activity_at
        FROM hr_service_delivery.hr_service_cases
        WHERE tenant_id = ${tenantId.value}
          AND (${from}::date IS NULL OR created_at::date >= ${from}::date)
          AND (${to}::date IS NULL OR created_at::date <= ${to}::date)
        GROUP BY status
      ),
      task_usage AS (
        SELECT
          COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'CANCELLED', 'CLOSED')) AS open_task_count
        FROM hr_service_delivery.hr_case_tasks
        WHERE tenant_id = ${tenantId.value}
          AND (${from}::date IS NULL OR created_at::date >= ${from}::date)
          AND (${to}::date IS NULL OR created_at::date <= ${to}::date)
      )
      SELECT
        case_usage.status,
        case_usage.case_count,
        case_usage.breached_sla_count,
        CASE
          WHEN case_usage.status NOT IN ('CLOSED', 'RESOLVED', 'CANCELLED')
          THEN task_usage.open_task_count
          ELSE 0
        END AS open_task_count,
        case_usage.last_activity_at
      FROM case_usage
      CROSS JOIN task_usage
    `.execute(this.db);

    return result.rows.map((row) => ({
      status: row.status,
      caseCount: numberValue(row.case_count),
      breachedSlaCount: numberValue(row.breached_sla_count),
      openTaskCount: numberValue(row.open_task_count),
      lastActivityAt: row.last_activity_at,
    }));
  }

  private async loadServiceCatalog(tenantId: Uuid, options: HrAnalyticsSummaryOptions): Promise<ServiceCatalogAnalyticsRow[]> {
    const from = options.from ?? null;
    const to = options.to ?? null;
    const result = await sql<ServiceCatalogSqlRow>`
      SELECT
        status,
        COUNT(*) AS item_count,
        AVG(sla_hours) AS average_sla_hours
      FROM hr_service_delivery.hr_service_catalog_items
      WHERE tenant_id = ${tenantId.value}
        AND (${from}::date IS NULL OR created_at::date >= ${from}::date)
        AND (${to}::date IS NULL OR created_at::date <= ${to}::date)
      GROUP BY status
    `.execute(this.db);

    return result.rows.map((row) => ({
      status: row.status,
      itemCount: numberValue(row.item_count),
      averageSlaHours: round(numberValue(row.average_sla_hours)),
    }));
  }
}

function buildAttendanceModule(rows: AttendanceAnalyticsRow[]): HrAnalyticsModule {
  const employeeDays = sum(rows, (row) => row.employeeDays);
  const overtimeHours = round(sum(rows, (row) => row.overtimeMinutes) / 60);
  const exceptionSignals = sum(rows, (row) => row.exceptionCount);

  return {
    code: 'ATTENDANCE',
    title: 'Attendance Exceptions',
    category: 'Workforce',
    primary: { label: 'Employee days', value: employeeDays, unit: 'days' },
    secondary: { label: 'Overtime hours', value: overtimeHours, unit: 'hours' },
    risk: { label: 'Exception signals', value: exceptionSignals },
    chart: {
      type: 'bar',
      data: rows
        .map((row) => ({ label: displayLabel(row.status), value: row.employeeDays }))
        .filter((point) => point.value > 0)
        .sort(sortChartPoints),
    },
    ...latestActivity(rows),
  };
}

function buildLeaveModule(rows: LeaveAnalyticsRow[]): HrAnalyticsModule {
  const requests = sum(rows, (row) => row.requestCount);
  const requestedDays = sum(rows, (row) => row.requestedDays);
  const openRequests = sum(rows.filter((row) => !isClosedLeaveStatus(row.status)), (row) => row.requestCount);

  return {
    code: 'LEAVE',
    title: 'Leave Pipeline',
    category: 'Workforce',
    primary: { label: 'Requests', value: requests },
    secondary: { label: 'Requested days', value: requestedDays, unit: 'days' },
    risk: { label: 'Open requests', value: openRequests },
    chart: {
      type: 'bar',
      data: rows
        .map((row) => ({ label: displayLabel(row.status), value: row.requestCount, secondaryValue: row.requestedDays }))
        .filter((point) => point.value > 0)
        .sort(sortChartPoints),
    },
    ...latestActivity(rows),
  };
}

function buildPayrollModule(rows: PayrollAnalyticsRow[]): HrAnalyticsModule {
  const netPay = sum(rows, (row) => row.netPay);
  const workerCount = sum(rows, (row) => row.workerCount);
  const attentionRuns = sum(rows.filter((row) => isPayrollAttentionStatus(row.status)), (row) => row.runCount);
  const currency = primaryCurrency(rows);
  const byCurrency = new Map<string, HrAnalyticsChartPoint>();

  for (const row of rows) {
    const current = byCurrency.get(row.currency) ?? { label: row.currency, value: 0, secondaryValue: 0 };
    current.value += row.netPay;
    current.secondaryValue = (current.secondaryValue ?? 0) + row.grossPay;
    byCurrency.set(row.currency, current);
  }

  return {
    code: 'PAYROLL',
    title: 'Payroll Net Pay',
    category: 'Reward',
    primary: { label: 'Net pay', value: netPay, unit: 'currency', currency },
    secondary: { label: 'Workers paid', value: workerCount },
    risk: { label: 'Runs needing attention', value: attentionRuns },
    chart: {
      type: 'bar',
      data: [...byCurrency.values()]
        .filter((point) => point.value > 0 || (point.secondaryValue ?? 0) > 0)
        .sort(sortChartPoints),
    },
    ...latestActivity(rows),
  };
}

function buildPerformanceModule(
  rows: PerformanceAnalyticsRow[],
  ratingRows: PerformanceRatingAnalyticsRow[],
): HrAnalyticsModule {
  const reviews = sum(rows, (row) => row.reviewCount);
  const ratingWeight = sum(rows.filter((row) => row.averageRating !== null && row.averageRating !== undefined), (row) => row.reviewCount);
  const averageRating = ratingWeight === 0
    ? 0
    : round(sum(rows, (row) => (row.averageRating ?? 0) * row.reviewCount) / ratingWeight);
  const openReviews = sum(rows.filter((row) => !isClosedPerformanceStatus(row.status)), (row) => row.reviewCount);
  const chartData = ratingRows.length > 0
    ? ratingRows.map((row) => ({ label: displayLabel(row.ratingBand), value: row.reviewCount }))
    : rows.map((row) => ({ label: displayLabel(row.status), value: row.reviewCount }));

  return {
    code: 'PERFORMANCE',
    title: 'Performance Rating',
    category: 'Talent',
    primary: { label: 'Reviews', value: reviews },
    secondary: { label: 'Average rating', value: averageRating, unit: 'rating' },
    risk: { label: 'Open reviews', value: openReviews },
    chart: {
      type: 'bar',
      data: chartData.filter((point) => point.value > 0).sort(sortChartPoints),
    },
    ...latestActivity(rows),
  };
}

function buildBenefitsModule(
  rows: BenefitsAnalyticsRow[],
  programRows: BenefitsProgramAnalyticsRow[],
): HrAnalyticsModule {
  const enrollments = sum(rows, (row) => row.enrollmentCount);
  const dependents = sum(rows, (row) => row.dependentCount);
  const pendingEnrollments = sum(rows.filter((row) => !isClosedBenefitsStatus(row.status)), (row) => row.enrollmentCount);
  const coverage = new Map<string, HrAnalyticsChartPoint>();

  for (const row of rows) {
    const current = coverage.get(row.coverageLevel) ?? { label: displayLabel(row.coverageLevel), value: 0, secondaryValue: 0 };
    current.value += row.enrollmentCount;
    current.secondaryValue = (current.secondaryValue ?? 0) + row.dependentCount;
    coverage.set(row.coverageLevel, current);
  }

  if (coverage.size === 0) {
    for (const row of programRows) {
      coverage.set(row.programType, {
        label: displayLabel(row.programType),
        value: row.activeCount,
        secondaryValue: row.programCount,
      });
    }
  }

  return {
    code: 'BENEFITS',
    title: 'Benefits Coverage',
    category: 'Reward',
    primary: { label: 'Enrollments', value: enrollments },
    secondary: { label: 'Dependents covered', value: dependents },
    risk: { label: 'Pending enrollments', value: pendingEnrollments },
    chart: {
      type: 'bar',
      data: [...coverage.values()].filter((point) => point.value > 0).sort(sortChartPoints),
    },
    ...latestActivity(rows),
  };
}

function buildHeadcountOrgModule(rows: HeadcountOrgAnalyticsRow[]): HrAnalyticsModule {
  const positions = sum(rows, (row) => row.positionCount);
  const filled = sum(rows, (row) => row.filledCount);
  const vacant = sum(rows, (row) => row.vacantCount);
  const openRequests = sum(rows.filter((row) => !isClosedHeadcountStatus(row.status)), (row) => row.headcountRequests);

  return {
    code: 'HEADCOUNT_ORG',
    title: 'Headcount and Org Coverage',
    category: 'Organization',
    primary: { label: 'Positions', value: positions },
    secondary: { label: 'Filled positions', value: filled },
    risk: { label: 'Vacancy and request signals', value: vacant + openRequests },
    chart: {
      type: 'bar',
      data: rows
        .map((row) => ({ label: displayLabel(row.status), value: row.positionCount, secondaryValue: row.headcountRequests }))
        .filter((point) => point.value > 0 || (point.secondaryValue ?? 0) > 0)
        .sort(sortChartPoints),
    },
    ...latestActivity(rows),
  };
}

function buildComplianceModule(
  acknowledgementRows: ComplianceAnalyticsRow[],
  statutoryReportRows: StatutoryReportAnalyticsRow[],
): HrAnalyticsModule {
  const acknowledgements = sum(acknowledgementRows, (row) => row.acknowledgementCount);
  const overdue = sum(acknowledgementRows, (row) => row.overdueCount);
  const statutoryReports = sum(statutoryReportRows, (row) => row.reportCount);
  const draftReports = sum(statutoryReportRows.filter((row) => !isClosedStatutoryReportStatus(row.status)), (row) => row.reportCount);
  const chartData = [
    ...acknowledgementRows.map((row) => ({ label: `Ack ${displayLabel(row.status)}`, value: row.acknowledgementCount })),
    ...statutoryReportRows.map((row) => ({ label: `Report ${displayLabel(row.status)}`, value: row.reportCount })),
  ];

  return {
    code: 'COMPLIANCE',
    title: 'Compliance Evidence',
    category: 'Governance',
    primary: { label: 'Acknowledgements', value: acknowledgements },
    secondary: { label: 'Statutory reports', value: statutoryReports },
    risk: { label: 'Overdue and draft signals', value: overdue + draftReports },
    chart: {
      type: 'bar',
      data: chartData.filter((point) => point.value > 0).sort(sortChartPoints),
    },
    ...latestActivity([...acknowledgementRows, ...statutoryReportRows]),
  };
}

function buildServicesModule(
  rows: ServiceDeliveryAnalyticsRow[],
  catalogRows: ServiceCatalogAnalyticsRow[],
): HrAnalyticsModule {
  const cases = sum(rows, (row) => row.caseCount);
  const activeCatalogItems = sum(catalogRows.filter((row) => row.status.toUpperCase() === 'ACTIVE'), (row) => row.itemCount);
  const slaAndTaskSignals = sum(rows, (row) => row.breachedSlaCount + row.openTaskCount);

  return {
    code: 'SERVICES',
    title: 'HR Services Demand',
    category: 'Service Delivery',
    primary: { label: 'Cases', value: cases },
    secondary: { label: 'Active catalog items', value: activeCatalogItems },
    risk: { label: 'SLA and task signals', value: slaAndTaskSignals },
    chart: {
      type: 'bar',
      data: rows
        .map((row) => ({ label: displayLabel(row.status), value: row.caseCount, secondaryValue: row.openTaskCount }))
        .filter((point) => point.value > 0 || (point.secondaryValue ?? 0) > 0)
        .sort(sortChartPoints),
    },
    ...latestActivity(rows),
  };
}

function sum<T>(rows: T[], selector: (row: T) => number): number {
  return rows.reduce((total, row) => total + selector(row), 0);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function numberValue(value: string | number | bigint | null | undefined): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

function sortChartPoints(left: HrAnalyticsChartPoint, right: HrAnalyticsChartPoint): number {
  return right.value - left.value || left.label.localeCompare(right.label);
}

function displayLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function latestActivity(rows: Array<{ lastActivityAt?: Date | string | null }>): { lastActivityAt?: string } {
  const latest = rows
    .map((row) => row.lastActivityAt)
    .filter((value): value is Date | string => Boolean(value))
    .map((value) => value instanceof Date ? value : new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())[0];

  return latest ? { lastActivityAt: latest.toISOString() } : {};
}

function isClosedLeaveStatus(status: string): boolean {
  return ['APPROVED', 'REJECTED', 'CANCELLED', 'WITHDRAWN'].includes(status.toUpperCase());
}

function isPayrollAttentionStatus(status: string): boolean {
  return ['FAILED', 'BLOCKED', 'REJECTED', 'CANCELLED', 'ERROR'].includes(status.toUpperCase());
}

function isClosedPerformanceStatus(status: string): boolean {
  return ['FINALIZED', 'ACKNOWLEDGED', 'COMPLETED', 'CLOSED', 'CANCELLED'].includes(status.toUpperCase());
}

function isClosedBenefitsStatus(status: string): boolean {
  return ['ACTIVE', 'APPROVED', 'WAIVED', 'CANCELLED', 'ENDED'].includes(status.toUpperCase());
}

function isClosedHeadcountStatus(status: string): boolean {
  return ['APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED', 'FILLED'].includes(status.toUpperCase());
}

function isClosedStatutoryReportStatus(status: string): boolean {
  return ['FILED', 'SUBMITTED', 'ACCEPTED', 'CANCELLED'].includes(status.toUpperCase());
}

function primaryCurrency(rows: PayrollAnalyticsRow[]): string | undefined {
  const currencies = new Map<string, number>();
  for (const row of rows) {
    currencies.set(row.currency, (currencies.get(row.currency) ?? 0) + row.netPay);
  }
  return [...currencies.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
}
