import { BadRequestException, Injectable } from '@nestjs/common';
import { ReportBuilderCatalogService, type ReportingDataSourceCatalogItem, type ReportingFieldCatalogItem } from './report-builder-catalog.service.js';

export interface SemanticReportQueryInput {
  dataSource: string;
  queryDefinition?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  limit?: number;
}

export interface SemanticReportQueryResult {
  dataSource: string;
  sourceTitle: string;
  generatedAt: string;
  scopeLevel: string;
  populationValue?: string;
  columns: string[];
  metrics: string[];
  groupBy: string[];
  rowCount: number;
  drillThroughCount: number;
  rows: Array<Record<string, string | number>>;
  drillThroughRows: Array<Record<string, string | number>>;
  chartData: Array<{ label: string; value: number; secondaryValue?: number }>;
  insightCards: Array<{ label: string; value: string | number; tone: 'success' | 'warning' | 'default' }>;
  executionPlan: {
    grain: string;
    privacyLevel: 'standard' | 'sensitive' | 'restricted';
    appliedFilters: Array<{ code: string; value: string }>;
    availableDrilldowns: string[];
  };
  decisionSupport: SemanticDecisionSupport;
  warnings: string[];
}

export interface SemanticDecisionSupport {
  summary: string;
  topSegments: Array<{
    label: string;
    metric: string;
    value: number;
    shareOfTotal: number;
    severity: 'safe' | 'watch' | 'risk';
  }>;
  recommendedDrilldowns: Array<{
    field: string;
    label: string;
    reason: string;
  }>;
  nextActions: Array<{
    label: string;
    actionType: 'DRILLDOWN' | 'EXPORT' | 'SAVE' | 'SCHEDULE';
    reason: string;
  }>;
}

type SemanticRow = Record<string, string | number>;

const SOURCE_GRAIN: Record<string, string> = {
  ATTENDANCE: 'Worker-day',
  LEAVE: 'Absence request',
  PAYROLL: 'Worker payroll period',
  BENEFITS: 'Worker benefit enrollment',
  PERFORMANCE: 'Worker review cycle',
  HEADCOUNT: 'Worker assignment',
  COMPLIANCE: 'Worker policy acknowledgement',
  SERVICES: 'HR service case',
  ENGAGEMENT: 'Survey response cohort',
  RECRUITMENT: 'Candidate pipeline stage',
  ONBOARDING: 'Onboarding plan',
  ACCESS: 'Worker access grant',
  RETENTION: 'Worker risk segment',
  LEARNING: 'Worker learning assignment',
};

const SOURCE_PRIVACY: Record<string, 'standard' | 'sensitive' | 'restricted'> = {
  ATTENDANCE: 'sensitive',
  LEAVE: 'sensitive',
  PAYROLL: 'restricted',
  BENEFITS: 'restricted',
  PERFORMANCE: 'sensitive',
  HEADCOUNT: 'standard',
  COMPLIANCE: 'restricted',
  SERVICES: 'sensitive',
  ENGAGEMENT: 'restricted',
  RECRUITMENT: 'standard',
  ONBOARDING: 'sensitive',
  ACCESS: 'restricted',
  RETENTION: 'restricted',
  LEARNING: 'sensitive',
};

const SEMANTIC_ROWS: Record<string, SemanticRow[]> = {
  ATTENDANCE: [
    { employeeNumber: 'EMP-0042', workerKey: 'EMP_0042', employeeName: 'Emily Chen', workDate: '2026-06-08', legalEntity: 'ACME_EG', orgUnit: 'TECHNOLOGY', department: 'ENGINEERING', manager: 'MGR_JAMES_HARRINGTON', group: 'REMOTE_WORKERS', attendanceStatus: 'LATE', policyCode: 'EG_STD_ATTENDANCE', employeeDays: 1, payableHours: 7.7, lateMinutes: 18, overtimeHours: 0, exceptions: 1 },
    { employeeNumber: 'EMP-0044', workerKey: 'EMP_0044', employeeName: 'Marcus Johnson', workDate: '2026-06-08', legalEntity: 'ACME_EG', orgUnit: 'TECHNOLOGY', department: 'ENGINEERING', manager: 'MGR_JAMES_HARRINGTON', group: 'CRITICAL_ROLES', attendanceStatus: 'PRESENT', policyCode: 'EG_STD_ATTENDANCE', employeeDays: 1, payableHours: 8, lateMinutes: 0, overtimeHours: 1.5, exceptions: 0 },
    { employeeNumber: 'EMP-0047', workerKey: 'EMP_0047', employeeName: 'Olivia Thompson', workDate: '2026-06-08', legalEntity: 'ACME_US', orgUnit: 'COMMERCIAL', department: 'SALES', manager: 'MGR_SARAH_MITCHELL', group: 'NEW_JOINERS_90', attendanceStatus: 'PRESENT', policyCode: 'US_REMOTE_ATTENDANCE', employeeDays: 1, payableHours: 8, lateMinutes: 0, overtimeHours: 0, exceptions: 0 },
  ],
  LEAVE: [
    { employeeNumber: 'EMP-0042', workerKey: 'EMP_0042', employeeName: 'Emily Chen', legalEntity: 'ACME_EG', orgUnit: 'TECHNOLOGY', department: 'ENGINEERING', manager: 'MGR_JAMES_HARRINGTON', leaveType: 'ANNUAL', requestStatus: 'APPROVED', startDate: '2026-06-12', endDate: '2026-06-13', requestCount: 1, requestedDays: 2, openRequests: 0 },
    { employeeNumber: 'EMP-0047', workerKey: 'EMP_0047', employeeName: 'Olivia Thompson', legalEntity: 'ACME_US', orgUnit: 'COMMERCIAL', department: 'SALES', manager: 'MGR_SARAH_MITCHELL', leaveType: 'SICK', requestStatus: 'PENDING', startDate: '2026-06-15', endDate: '2026-06-15', requestCount: 1, requestedDays: 1, openRequests: 1 },
  ],
  PAYROLL: [
    { employeeNumber: 'EMP-0042', workerKey: 'EMP_0042', employeeName: 'Emily Chen', payPeriod: '2026-06', legalEntity: 'ACME_EG', orgUnit: 'TECHNOLOGY', department: 'ENGINEERING', manager: 'MGR_JAMES_HARRINGTON', payrollStatus: 'PREVIEW', grossPay: 5200, taxAmount: 780, insuranceAmount: 260, netPay: 4160 },
    { employeeNumber: 'EMP-0044', workerKey: 'EMP_0044', employeeName: 'Marcus Johnson', payPeriod: '2026-06', legalEntity: 'ACME_EG', orgUnit: 'TECHNOLOGY', department: 'ENGINEERING', manager: 'MGR_JAMES_HARRINGTON', payrollStatus: 'PREVIEW', grossPay: 6100, taxAmount: 915, insuranceAmount: 305, netPay: 4880 },
    { employeeNumber: 'EMP-0047', workerKey: 'EMP_0047', employeeName: 'Olivia Thompson', payPeriod: '2026-06', legalEntity: 'ACME_US', orgUnit: 'COMMERCIAL', department: 'SALES', manager: 'MGR_SARAH_MITCHELL', payrollStatus: 'READY', grossPay: 4800, taxAmount: 720, insuranceAmount: 240, netPay: 3840 },
  ],
  BENEFITS: [
    { employeeNumber: 'EMP-0042', workerKey: 'EMP_0042', employeeName: 'Emily Chen', legalEntity: 'ACME_EG', orgUnit: 'TECHNOLOGY', department: 'ENGINEERING', manager: 'MGR_JAMES_HARRINGTON', programName: 'Medical Plus', coverageLevel: 'FAMILY', enrollmentStatus: 'ACTIVE', enrollments: 1, dependentsCovered: 2, employerContribution: 720 },
    { employeeNumber: 'EMP-0047', workerKey: 'EMP_0047', employeeName: 'Olivia Thompson', legalEntity: 'ACME_US', orgUnit: 'COMMERCIAL', department: 'SALES', manager: 'MGR_SARAH_MITCHELL', programName: 'Medical Core', coverageLevel: 'EMPLOYEE', enrollmentStatus: 'PENDING', enrollments: 1, dependentsCovered: 0, employerContribution: 340 },
  ],
  PERFORMANCE: [
    { employeeNumber: 'EMP-0042', workerKey: 'EMP_0042', employeeName: 'Emily Chen', legalEntity: 'ACME_EG', orgUnit: 'TECHNOLOGY', department: 'ENGINEERING', manager: 'MGR_JAMES_HARRINGTON', reviewCycle: '2026-H1', reviewStatus: 'IN_PROGRESS', ratingBand: 'EXCEEDS', reviewCount: 1, averageRating: 4.4, openReviews: 1 },
    { employeeNumber: 'EMP-0047', workerKey: 'EMP_0047', employeeName: 'Olivia Thompson', legalEntity: 'ACME_US', orgUnit: 'COMMERCIAL', department: 'SALES', manager: 'MGR_SARAH_MITCHELL', reviewCycle: '2026-H1', reviewStatus: 'COMPLETED', ratingBand: 'MEETS', reviewCount: 1, averageRating: 3.8, openReviews: 0 },
  ],
  HEADCOUNT: [
    { employeeNumber: 'EMP-0042', workerKey: 'EMP_0042', employeeName: 'Emily Chen', legalEntity: 'ACME_EG', orgUnit: 'TECHNOLOGY', department: 'ENGINEERING', manager: 'MGR_JAMES_HARRINGTON', employmentStatus: 'ACTIVE', hireDate: '2024-04-01', headcount: 1, activeWorkers: 1, newHires: 0, turnoverRate: 0 },
    { employeeNumber: 'EMP-0047', workerKey: 'EMP_0047', employeeName: 'Olivia Thompson', legalEntity: 'ACME_US', orgUnit: 'COMMERCIAL', department: 'SALES', manager: 'MGR_SARAH_MITCHELL', employmentStatus: 'ACTIVE', hireDate: '2026-04-12', headcount: 1, activeWorkers: 1, newHires: 1, turnoverRate: 0 },
  ],
  COMPLIANCE: [
    { employeeNumber: 'EMP-0042', workerKey: 'EMP_0042', employeeName: 'Emily Chen', legalEntity: 'ACME_EG', orgUnit: 'TECHNOLOGY', department: 'ENGINEERING', manager: 'MGR_JAMES_HARRINGTON', policyCode: 'DATA_PRIVACY_2026', documentType: 'POLICY', acknowledgementStatus: 'OVERDUE', dueDate: '2026-06-05', acknowledgements: 1, overdueAcknowledgements: 1, statutoryReports: 0, legalHolds: 0 },
    { employeeNumber: 'EMP-0047', workerKey: 'EMP_0047', employeeName: 'Olivia Thompson', legalEntity: 'ACME_US', orgUnit: 'COMMERCIAL', department: 'SALES', manager: 'MGR_SARAH_MITCHELL', policyCode: 'CODE_OF_CONDUCT_2026', documentType: 'POLICY', acknowledgementStatus: 'ACKNOWLEDGED', dueDate: '2026-06-20', acknowledgements: 1, overdueAcknowledgements: 0, statutoryReports: 0, legalHolds: 0 },
  ],
  SERVICES: [
    { caseNumber: 'CASE-1001', serviceName: 'Payroll question', employeeName: 'Emily Chen', employeeNumber: 'EMP-0042', workerKey: 'EMP_0042', legalEntity: 'ACME_EG', orgUnit: 'TECHNOLOGY', department: 'ENGINEERING', manager: 'MGR_JAMES_HARRINGTON', caseStatus: 'OPEN', ownerTeam: 'HR Operations', cases: 1, openTasks: 2, slaBreaches: 1, resolutionHours: 0 },
    { caseNumber: 'CASE-1002', serviceName: 'Benefits update', employeeName: 'Olivia Thompson', employeeNumber: 'EMP-0047', workerKey: 'EMP_0047', legalEntity: 'ACME_US', orgUnit: 'COMMERCIAL', department: 'SALES', manager: 'MGR_SARAH_MITCHELL', caseStatus: 'RESOLVED', ownerTeam: 'Benefits', cases: 1, openTasks: 0, slaBreaches: 0, resolutionHours: 12 },
  ],
  ENGAGEMENT: [
    { employeeNumber: 'EMP-0042', workerKey: 'EMP_0042', employeeName: 'Emily Chen', legalEntity: 'ACME_EG', orgUnit: 'TECHNOLOGY', department: 'ENGINEERING', manager: 'MGR_JAMES_HARRINGTON', surveyName: 'Pulse 2026', surveyDate: '2026-06-03', engagementBand: 'WATCH', participationRate: 100, engagementScore: 72, sentimentRisk: 2, recognitionCount: 1 },
    { employeeNumber: 'EMP-0044', workerKey: 'EMP_0044', employeeName: 'Marcus Johnson', legalEntity: 'ACME_EG', orgUnit: 'TECHNOLOGY', department: 'ENGINEERING', manager: 'MGR_JAMES_HARRINGTON', surveyName: 'Pulse 2026', surveyDate: '2026-06-03', engagementBand: 'WATCH', participationRate: 50, engagementScore: 68, sentimentRisk: 3, recognitionCount: 0 },
    { employeeNumber: 'EMP-0047', workerKey: 'EMP_0047', employeeName: 'Olivia Thompson', legalEntity: 'ACME_US', orgUnit: 'COMMERCIAL', department: 'SALES', manager: 'MGR_SARAH_MITCHELL', surveyName: 'Pulse 2026', surveyDate: '2026-06-03', engagementBand: 'SAFE', participationRate: 100, engagementScore: 84, sentimentRisk: 0, recognitionCount: 2 },
  ],
};

@Injectable()
export class ReportSemanticQueryService {
  constructor(private readonly catalogService: ReportBuilderCatalogService) {}

  async run(input: SemanticReportQueryInput): Promise<SemanticReportQueryResult> {
    const catalog = this.catalogService.getCatalog();
    const source = catalog.dataSources.find((item) => item.code === input.dataSource);
    if (!source) {
      throw new BadRequestException(`Unknown semantic reporting data source: ${input.dataSource}`);
    }

    const queryDefinition = input.queryDefinition ?? {};
    const fields = stringArray(queryDefinition.fields).filter((field) => source.fields.some((item) => item.code === field));
    const metrics = stringArray(queryDefinition.metrics).filter((field) => source.metrics.some((item) => item.code === field));
    const groupBy = stringArray(queryDefinition.groupBy).filter((field) => source.groupBy.some((item) => item.code === field));
    const scopeLevel = typeof queryDefinition.scopeLevel === 'string' && source.scopeLevels.includes(queryDefinition.scopeLevel)
      ? queryDefinition.scopeLevel
      : 'TENANT';
    const populationValue = typeof queryDefinition.populationValue === 'string' ? queryDefinition.populationValue : undefined;
    const filters = filtersArray(queryDefinition.filters);
    const limit = typeof input.limit === 'number' && Number.isFinite(input.limit)
      ? Math.max(1, Math.min(100, Math.trunc(input.limit)))
      : 25;
    const availableRows = SEMANTIC_ROWS[source.code] ?? [];
    const periodReferenceDate = latestRowDate(availableRows) ?? new Date();
    const filteredRows = availableRows
      .filter((row) => matchesPopulation(row, scopeLevel, populationValue))
      .filter((row) => matchesFilters(row, filters, periodReferenceDate));
    const resultRows = groupBy.length > 0
      ? aggregateRows(filteredRows, groupBy, metrics, source)
      : filteredRows.map((row) => projectRow(row, [...fields, ...metrics]));
    const drillThroughColumns = unique([...groupBy, ...fields, ...metrics]);
    const drillThroughRows = filteredRows.slice(0, limit).map((row) => projectRow(row, drillThroughColumns));
    const primaryMetric = metrics[0];
    const secondaryMetric = metrics[1];
    const primaryMetricMeta = source.metrics.find((item) => item.code === primaryMetric);
    const warnings = [
      ...filterWarnings(availableRows, filters),
      ...(filteredRows.length === 0 ? ['No records matched this semantic query. Adjust scope, population, or filters.'] : []),
    ];

    return {
      dataSource: source.code,
      sourceTitle: source.title,
      generatedAt: new Date().toISOString(),
      scopeLevel,
      ...(populationValue ? { populationValue } : {}),
      columns: groupBy.length > 0 ? [...groupBy, ...metrics] : unique([...fields, ...metrics]),
      metrics,
      groupBy,
      rowCount: resultRows.length,
      drillThroughCount: filteredRows.length,
      rows: resultRows,
      drillThroughRows,
      chartData: resultRows.map((row, index) => ({
        label: groupBy.length > 0 ? groupBy.map((field) => String(row[field] ?? '')).filter(Boolean).join(' / ') : `Row ${index + 1}`,
        value: primaryMetric ? numeric(row[primaryMetric]) : 0,
        ...(secondaryMetric ? { secondaryValue: numeric(row[secondaryMetric]) } : {}),
      })),
      insightCards: [
        { label: 'Rows', value: resultRows.length, tone: resultRows.length > 0 ? 'success' : 'warning' },
        { label: 'Drill-through records', value: filteredRows.length, tone: filteredRows.length > 0 ? 'success' : 'warning' },
        { label: primaryMetric ? labelFor(source.metrics, primaryMetric) : 'Primary metric', value: primaryMetric ? metricSummaryValue(filteredRows, primaryMetric, primaryMetricMeta?.type) : 0, tone: 'default' },
      ],
      executionPlan: {
        grain: SOURCE_GRAIN[source.code] ?? 'Business record',
        privacyLevel: SOURCE_PRIVACY[source.code] ?? 'standard',
        appliedFilters: filters,
        availableDrilldowns: source.groupBy.map((item) => item.label),
      },
      decisionSupport: buildDecisionSupport({
        source,
        resultRows,
        filteredRows,
        groupBy,
        primaryMetric,
      }),
      warnings,
    };
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function filtersArray(value: unknown): Array<{ code: string; value: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    return typeof record.code === 'string' && typeof record.value === 'string'
      ? [{ code: record.code, value: record.value }]
      : [];
  });
}

function matchesPopulation(row: SemanticRow, scopeLevel: string, populationValue?: string): boolean {
  if (scopeLevel === 'TENANT' || !populationValue || populationValue === 'ALL') return true;
  const populationField: Record<string, string> = {
    LEGAL_ENTITY: 'legalEntity',
    ORG_UNIT: 'orgUnit',
    DEPARTMENT: 'department',
    MANAGER: 'manager',
    EMPLOYEE: 'workerKey',
    GROUP: 'group',
  };
  const field = populationField[scopeLevel];
  return field ? String(row[field] ?? '') === populationValue : true;
}

function matchesFilters(row: SemanticRow, filters: Array<{ code: string; value: string }>, periodReferenceDate: Date): boolean {
  return filters.every((filter) => {
    if (filter.code === 'period') return matchesPeriodFilter(row, filter.value, periodReferenceDate);
    if (!filter.value) return true;
    return String(row[filter.code] ?? '') === filter.value;
  });
}

function aggregateRows(rows: SemanticRow[], groupBy: string[], metrics: string[], source: ReportingDataSourceCatalogItem): SemanticRow[] {
  const grouped = new Map<string, SemanticRow>();
  const groupCounts = new Map<string, number>();
  for (const row of rows) {
    const key = groupBy.map((field) => String(row[field] ?? '')).join('\u0001');
    const target = grouped.get(key) ?? Object.fromEntries(groupBy.map((field) => [field, row[field] ?? '']));
    const groupCount = (groupCounts.get(key) ?? 0) + 1;
    groupCounts.set(key, groupCount);
    for (const metric of metrics) {
      const metricMeta = source.metrics.find((item) => item.code === metric);
      const current = numeric(target[metric]);
      const next = numeric(row[metric]);
      target[metric] = metricMeta?.type === 'percentage'
        ? runningAverageMetric(current, next, groupCount)
        : current + next;
    }
    grouped.set(key, target);
  }
  return [...grouped.values()];
}

function projectRow(row: SemanticRow, columns: string[]): SemanticRow {
  return Object.fromEntries(unique(columns).map((column) => [column, row[column] ?? '']));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function numeric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value ?? 0) || 0;
}

function sum(rows: SemanticRow[], metric: string): number {
  return rows.reduce((total, row) => total + numeric(row[metric]), 0);
}

function metricSummaryValue(rows: SemanticRow[], metric: string, metricType?: string): number {
  if (metricType !== 'percentage') return sum(rows, metric);
  if (rows.length === 0) return 0;
  return roundMetric(sum(rows, metric) / rows.length);
}

function buildDecisionSupport(input: {
  source: ReportingDataSourceCatalogItem;
  resultRows: SemanticRow[];
  filteredRows: SemanticRow[];
  groupBy: string[];
  primaryMetric?: string;
}): SemanticDecisionSupport {
  const metric = input.primaryMetric ?? input.source.metrics[0]?.code;
  const metricLabel = metric ? labelFor(input.source.metrics, metric) : 'Records';
  const totalMetricValue = Math.max(0, metric ? sum(input.resultRows, metric) : input.filteredRows.length);
  const topSegments = metric
    ? input.resultRows
      .map((row, index) => {
        const label = segmentLabel(row, input.groupBy, index);
        const value = numeric(row[metric]);
        const shareOfTotal = totalMetricValue > 0 ? roundMetric((value / totalMetricValue) * 100) : 0;
        return {
          label,
          metric: metricLabel,
          value,
          shareOfTotal,
          severity: segmentSeverity(value, shareOfTotal),
        };
      })
      .sort((left, right) => right.value - left.value)
      .slice(0, 3)
    : [];
  const leadingSegment = topSegments[0];
  const recommendedDrilldowns = input.source.groupBy
    .filter((field) => !input.groupBy.includes(field.code))
    .slice(0, 3)
    .map((field) => ({
      field: field.code,
      label: field.label,
      reason: `Break ${metricLabel.toLowerCase()} down by ${field.label.toLowerCase()} for the next layer of context.`,
    }));

  return {
    summary: leadingSegment
      ? `${leadingSegment.label} is the top segment for ${metricLabel.toLowerCase()} with ${leadingSegment.value} (${leadingSegment.shareOfTotal}% of the result).`
      : `No segment stood out for ${input.source.title}.`,
    topSegments,
    recommendedDrilldowns,
    nextActions: [
      ...(leadingSegment ? [{
        label: `Open ${leadingSegment.label} drill-through`,
        actionType: 'DRILLDOWN' as const,
        reason: `Review the ${input.filteredRows.length} underlying record(s) behind the top segment.`,
      }] : []),
      {
        label: 'Export underlying records',
        actionType: 'EXPORT',
        reason: 'Share the drill-through data with HR operations or business owners.',
      },
      {
        label: 'Save as recurring report',
        actionType: 'SCHEDULE',
        reason: 'Monitor this question on a regular reporting cadence.',
      },
    ],
  };
}

function segmentLabel(row: SemanticRow, groupBy: string[], index: number): string {
  const label = groupBy.map((field) => String(row[field] ?? '')).filter(Boolean).join(' / ');
  return label || `Row ${index + 1}`;
}

function segmentSeverity(value: number, shareOfTotal: number): 'safe' | 'watch' | 'risk' {
  if (value <= 0) return 'safe';
  if (shareOfTotal >= 60) return 'watch';
  return 'safe';
}

function runningAverageMetric(currentAverage: number, next: number, count: number): number {
  const safeCount = Math.max(1, count);
  return roundMetric(((currentAverage * (safeCount - 1)) + next) / safeCount);
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

const DATE_FIELD_CANDIDATES = [
  'workDate',
  'startDate',
  'endDate',
  'payPeriod',
  'hireDate',
  'dueDate',
  'surveyDate',
  'createdAt',
  'effectiveDate',
];

function filterWarnings(rows: SemanticRow[], filters: Array<{ code: string; value: string }>): string[] {
  const periodFilter = filters.find((filter) => filter.code === 'period' && filter.value);
  if (!periodFilter) return [];
  if (!isSupportedPeriod(periodFilter.value)) {
    return [`Period filter "${periodFilter.value}" is not supported for semantic reporting.`];
  }
  return rows.some((row) => rowDate(row))
    ? []
    : ['Period filter could not be applied because the selected data source has no date field.'];
}

function matchesPeriodFilter(row: SemanticRow, period: string, referenceDate: Date): boolean {
  if (!period) return true;
  if (!isSupportedPeriod(period)) return true;
  const date = rowDate(row);
  if (!date) return true;
  const { from, to } = periodRange(period, referenceDate);
  return date >= from && date <= to;
}

function isSupportedPeriod(period: string): boolean {
  return ['CURRENT_MONTH', 'CURRENT_QUARTER', 'LAST_90_DAYS', 'YEAR_TO_DATE'].includes(period);
}

function periodRange(period: string, referenceDate: Date): { from: Date; to: Date } {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  if (period === 'CURRENT_MONTH') {
    return {
      from: new Date(Date.UTC(year, month, 1)),
      to: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
    };
  }
  if (period === 'CURRENT_QUARTER') {
    const quarterStartMonth = Math.floor(month / 3) * 3;
    return {
      from: new Date(Date.UTC(year, quarterStartMonth, 1)),
      to: new Date(Date.UTC(year, quarterStartMonth + 3, 0, 23, 59, 59, 999)),
    };
  }
  if (period === 'YEAR_TO_DATE') {
    return {
      from: new Date(Date.UTC(year, 0, 1)),
      to: new Date(Date.UTC(year, month, referenceDate.getUTCDate(), 23, 59, 59, 999)),
    };
  }
  return {
    from: new Date(referenceDate.getTime() - 90 * 24 * 60 * 60 * 1000),
    to: new Date(Date.UTC(year, month, referenceDate.getUTCDate(), 23, 59, 59, 999)),
  };
}

function latestRowDate(rows: SemanticRow[]): Date | undefined {
  return rows
    .map((row) => rowDate(row))
    .filter((date): date is Date => Boolean(date))
    .sort((left, right) => right.getTime() - left.getTime())[0];
}

function rowDate(row: SemanticRow): Date | undefined {
  for (const field of DATE_FIELD_CANDIDATES) {
    const date = parseRowDate(row[field]);
    if (date) return date;
  }
  return undefined;
}

function parseRowDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const trimmed = value.trim();
  const normalized = /^\d{4}-\d{2}$/.test(trimmed) ? `${trimmed}-01` : trimmed;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function labelFor(fields: ReportingFieldCatalogItem[], code: string): string {
  return fields.find((field) => field.code === code)?.label ?? code;
}
