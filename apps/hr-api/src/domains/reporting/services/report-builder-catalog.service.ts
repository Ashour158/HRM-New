import { BadRequestException, Injectable } from '@nestjs/common';

export type ReportingFieldType = 'text' | 'number' | 'date' | 'currency' | 'status' | 'percentage';
export type ReportingVisualizationType = 'table' | 'bar' | 'line' | 'pie' | 'kpi';

export interface ReportingFieldCatalogItem {
  code: string;
  label: string;
  type: ReportingFieldType;
  defaultSelected?: boolean;
  description?: string;
  options?: Array<{ code: string; label: string }>;
}

export interface ReportingDataSourceCatalogItem {
  code: string;
  title: string;
  category: string;
  description: string;
  scopeLevels: string[];
  fields: ReportingFieldCatalogItem[];
  metrics: ReportingFieldCatalogItem[];
  groupBy: ReportingFieldCatalogItem[];
  filters: ReportingFieldCatalogItem[];
  defaultVisualization: ReportingVisualizationType;
}

export interface ReportingTemplateCatalogItem {
  code: string;
  title: string;
  dataSource: string;
  description: string;
  fields: string[];
  metrics: string[];
  groupBy: string[];
  scopeLevel: string;
  visualization: ReportingVisualizationType;
  recommended?: boolean;
  recommendationReason?: string;
  packCodes?: string[];
  defaultFilters?: Array<{ code: string; value: string }>;
}

export interface ReportBuilderCatalog {
  scopeLevels: Array<{ code: string; label: string; description: string }>;
  populationOptions: ReportingPopulationOption[];
  visualizationTypes: Array<{ code: ReportingVisualizationType; label: string }>;
  dataSources: ReportingDataSourceCatalogItem[];
  templates: ReportingTemplateCatalogItem[];
  analyticsPacks: ReportingAnalyticsPack[];
  smartCategories: SmartAnalyticsCategory[];
  businessRelationships: ReportingBusinessRelationship[];
}

export interface ReportingPopulationOption {
  scopeLevel: string;
  label: string;
  values: Array<{ code: string; label: string; description?: string }>;
}

export interface ReportingAnalyticsPack {
  code: string;
  title: string;
  category: string;
  description: string;
  reportCodes: string[];
  dataSources: string[];
  defaultScopeLevel: string;
  defaultPeriod: string;
  outputs: string[];
}

export interface ReportAnalyticsRunResult {
  packCode: string;
  title: string;
  generatedAt: string;
  scopeLevel: string;
  period: string;
  reportOptions: Array<{ code: string; title: string; dataSource: string; recommended: boolean }>;
  highlights: Array<{ label: string; value: string | number; tone: 'success' | 'warning' | 'default' }>;
  charts: Array<{ title: string; data: Array<{ label: string; value: number; secondaryValue?: number }> }>;
  suggestedNextActions: string[];
}

export interface SmartAnalyticsInsight {
  code: string;
  title: string;
  question: string;
  metricLabel: string;
  metricValue: string | number;
  trend: string;
  tone: 'success' | 'warning' | 'default';
  explanation: string;
  dataSources: string[];
  relatedReports: string[];
  chart: Array<{ label: string; value: number; secondaryValue?: number }>;
  affectedRecords: Array<{ label: string; value: string; severity: 'safe' | 'watch' | 'risk' }>;
  actions: string[];
}

export interface SmartAnalyticsCategory {
  code: string;
  title: string;
  group: string;
  description: string;
  businessQuestions: string[];
  dataSources: string[];
  reportCodes: string[];
  drilldowns: string[];
  insights: SmartAnalyticsInsight[];
}

export interface ReportingBusinessRelationship {
  code: string;
  title: string;
  from: string;
  to: string;
  relationship: string;
  businessUse: string;
  grain: string;
  joinKeys: string[];
  privacyLevel: 'standard' | 'sensitive' | 'restricted';
  lineage: string[];
  recommendedDrilldowns: string[];
}

export interface SmartAnalyticsRunResult {
  categoryCode: string;
  title: string;
  generatedAt: string;
  scopeLevel: string;
  period: string;
  summary: string;
  insights: SmartAnalyticsInsight[];
  drilldowns: string[];
  relatedReports: Array<{ code: string; title: string; dataSource: string }>;
  relationships: ReportingBusinessRelationship[];
}

export interface ReportDefinitionPreview {
  valid: boolean;
  dataSource: string;
  scopeLevel: string;
  columns: string[];
  metrics: string[];
  groupBy: string[];
  rowCountEstimate: number;
  chartData: Array<{ label: string; value: number; secondaryValue?: number }>;
  sampleRows: Array<Record<string, string | number>>;
  warnings: string[];
}

@Injectable()
export class ReportBuilderCatalogService {
  getCatalog(): ReportBuilderCatalog {
    return {
      scopeLevels: [
        { code: 'TENANT', label: 'Whole Company', description: 'All records available to the tenant.' },
        { code: 'LEGAL_ENTITY', label: 'Legal Entity', description: 'Limit results by company/legal employer.' },
        { code: 'ORG_UNIT', label: 'Org Unit', description: 'Limit results by business unit or operating unit.' },
        { code: 'DEPARTMENT', label: 'Department', description: 'Limit results by department.' },
        { code: 'MANAGER', label: 'Manager Team', description: 'Limit results by reporting line.' },
        { code: 'EMPLOYEE', label: 'Employee', description: 'Limit results to selected employees.' },
        { code: 'GROUP', label: 'Custom Group', description: 'Limit results by a saved workforce group.' },
      ],
      populationOptions: REPORTING_POPULATION_OPTIONS,
      visualizationTypes: [
        { code: 'table', label: 'Table' },
        { code: 'bar', label: 'Bar chart' },
        { code: 'line', label: 'Trend line' },
        { code: 'pie', label: 'Breakdown' },
        { code: 'kpi', label: 'KPI cards' },
      ],
      dataSources: REPORTING_DATA_SOURCES,
      templates: REPORTING_TEMPLATES,
      analyticsPacks: REPORTING_ANALYTICS_PACKS,
      smartCategories: SMART_ANALYTICS_CATEGORIES,
      businessRelationships: REPORTING_BUSINESS_RELATIONSHIPS,
    };
  }

  runSmartCategory(input: {
    categoryCode: string;
    scopeLevel?: string;
    populationValue?: string;
    period?: string;
    selectedInsightCodes?: string[];
    filters?: Array<{ code: string; value: string }>;
  }): SmartAnalyticsRunResult {
    const category = SMART_ANALYTICS_CATEGORIES.find((item) => item.code === input.categoryCode);
    if (!category) {
      throw new BadRequestException(`Unknown smart analytics category: ${input.categoryCode}`);
    }
    const invalidInsightCodes = input.selectedInsightCodes?.filter((code) => !category.insights.some((insight) => insight.code === code)) ?? [];
    if (invalidInsightCodes.length > 0) {
      throw new BadRequestException(`Unknown smart analytics insight code(s): ${invalidInsightCodes.join(', ')}`);
    }
    const selectedInsights = input.selectedInsightCodes?.length
      ? category.insights.filter((insight) => input.selectedInsightCodes?.includes(insight.code))
      : category.insights;
    const relationships = REPORTING_BUSINESS_RELATIONSHIPS.filter((relationship) =>
      category.dataSources.includes(relationship.from) || category.dataSources.includes(relationship.to),
    );

    return {
      categoryCode: category.code,
      title: category.title,
      generatedAt: new Date().toISOString(),
      scopeLevel: input.scopeLevel ?? 'TENANT',
      period: input.period ?? 'CURRENT_MONTH',
      summary: `${category.title} analyzed across ${category.dataSources.length} connected HR data domains with ${selectedInsights.length} active insight(s).`,
      insights: selectedInsights,
      drilldowns: category.drilldowns,
      relatedReports: REPORTING_TEMPLATES
        .filter((template) => category.reportCodes.includes(template.code))
        .map((template) => ({ code: template.code, title: template.title, dataSource: template.dataSource })),
      relationships,
    };
  }

  runAnalyticsPack(input: {
    packCode: string;
    scopeLevel?: string;
    populationValue?: string;
    period?: string;
    selectedReportCodes?: string[];
    filters?: Array<{ code: string; value: string }>;
  }): ReportAnalyticsRunResult {
    const pack = REPORTING_ANALYTICS_PACKS.find((item) => item.code === input.packCode);
    if (!pack) {
      throw new BadRequestException(`Unknown analytics pack: ${input.packCode}`);
    }
    const invalidReportCodes = input.selectedReportCodes?.filter((code) => !pack.reportCodes.includes(code)) ?? [];
    if (invalidReportCodes.length > 0) {
      throw new BadRequestException(`Unknown analytics pack report code(s): ${invalidReportCodes.join(', ')}`);
    }
    const selectedCodes = input.selectedReportCodes?.length ? input.selectedReportCodes : pack.reportCodes;
    const reportOptions = REPORTING_TEMPLATES
      .filter((template) => pack.reportCodes.includes(template.code))
      .map((template) => ({
        code: template.code,
        title: template.title,
        dataSource: template.dataSource,
        recommended: selectedCodes.includes(template.code),
      }));

    return {
      packCode: pack.code,
      title: pack.title,
      generatedAt: new Date().toISOString(),
      scopeLevel: input.scopeLevel ?? pack.defaultScopeLevel,
      period: input.period ?? pack.defaultPeriod,
      reportOptions,
      highlights: this.packHighlights(pack.code),
      charts: pack.dataSources.map((sourceCode) => ({
        title: REPORTING_DATA_SOURCES.find((source) => source.code === sourceCode)?.title ?? sourceCode,
        data: this.previewChartData(sourceCode, 'department'),
      })),
      suggestedNextActions: this.packNextActions(pack.code),
    };
  }

  previewDefinition(input: {
    dataSource: string;
    queryDefinition?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
  }): ReportDefinitionPreview {
    const source = REPORTING_DATA_SOURCES.find((item) => item.code === input.dataSource);
    if (!source) {
      return {
        valid: false,
        dataSource: input.dataSource,
        scopeLevel: 'TENANT',
        columns: [],
        metrics: [],
        groupBy: [],
        rowCountEstimate: 0,
        chartData: [],
        sampleRows: [],
        warnings: [`Unknown reporting data source: ${input.dataSource}`],
      };
    }

    const queryDefinition = input.queryDefinition ?? {};
    const selectedFields = this.stringArray(queryDefinition.fields).filter((field) => source.fields.some((item) => item.code === field));
    const selectedMetrics = this.stringArray(queryDefinition.metrics).filter((field) => source.metrics.some((item) => item.code === field));
    const selectedGroupBy = this.stringArray(queryDefinition.groupBy).filter((field) => source.groupBy.some((item) => item.code === field));
    const scopeLevel = typeof queryDefinition.scopeLevel === 'string' && source.scopeLevels.includes(queryDefinition.scopeLevel)
      ? queryDefinition.scopeLevel
      : 'TENANT';
    const populationValue = typeof queryDefinition.populationValue === 'string' ? queryDefinition.populationValue : undefined;
    const populationOptions = REPORTING_POPULATION_OPTIONS.find((option) => option.scopeLevel === scopeLevel)?.values ?? [];
    const hasValidPopulation = scopeLevel === 'TENANT'
      || (populationValue !== undefined && populationOptions.some((option) => option.code === populationValue));

    const columns = selectedFields.length > 0
      ? selectedFields
      : source.fields.filter((field) => field.defaultSelected).map((field) => field.code);
    const metrics = selectedMetrics.length > 0
      ? selectedMetrics
      : source.metrics.slice(0, 2).map((field) => field.code);
    const groupBy = selectedGroupBy.length > 0
      ? selectedGroupBy
      : source.groupBy.slice(0, 1).map((field) => field.code);

    const warnings: string[] = [];
    if (columns.length === 0) warnings.push('Select at least one column before publishing this report.');
    if (metrics.length === 0) warnings.push('Select at least one metric to support charts and KPIs.');
    if (queryDefinition.visualization === 'pie' && groupBy.length === 0) warnings.push('Breakdown charts require a grouping field.');
    if (!hasValidPopulation) warnings.push(`Select a ${scopeLevel.toLowerCase().replace('_', ' ')} population before publishing this report.`);

    const base = REPORTING_SAMPLE_VOLUME[source.code] ?? 25;
    const scopeFactor = scopeLevel === 'TENANT' ? 1 : scopeLevel === 'EMPLOYEE' ? 0.08 : 0.35;
    const rowCountEstimate = Math.max(1, Math.round(base * scopeFactor));

    return {
      valid: warnings.length === 0,
      dataSource: source.code,
      scopeLevel,
      columns,
      metrics,
      groupBy,
      rowCountEstimate,
      chartData: this.previewChartData(source.code, groupBy[0]),
      sampleRows: this.sampleRows(source, columns, metrics),
      warnings,
    };
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private previewChartData(sourceCode: string, groupBy?: string): Array<{ label: string; value: number; secondaryValue?: number }> {
    const seed = REPORTING_PREVIEW_SERIES[sourceCode] ?? REPORTING_PREVIEW_SERIES.HEADCOUNT;
    if (!groupBy) return seed.slice(0, 3);
    return seed;
  }

  private sampleRows(source: ReportingDataSourceCatalogItem, columns: string[], metrics: string[]): Array<Record<string, string | number>> {
    const selected = [...columns, ...metrics].slice(0, 8);
    return [0, 1, 2].map((rowIndex) => Object.fromEntries(selected.map((code) => {
      const field = [...source.fields, ...source.metrics].find((item) => item.code === code);
      return [code, this.sampleValue(field?.type ?? 'text', rowIndex, field?.label ?? code)];
    })));
  }

  private sampleValue(type: ReportingFieldType, index: number, label: string): string | number {
    if (type === 'number') return [18, 42, 76][index] ?? 0;
    if (type === 'currency') return [42500, 61500, 83750][index] ?? 0;
    if (type === 'percentage') return [82, 91, 74][index] ?? 0;
    if (type === 'date') return ['2026-06-01', '2026-06-08', '2026-06-15'][index] ?? '2026-06-01';
    if (type === 'status') return ['Active', 'Pending', 'Approved'][index] ?? 'Active';
    return `${label} ${index + 1}`;
  }

  private packHighlights(packCode: string): ReportAnalyticsRunResult['highlights'] {
    if (packCode === 'FULL_HR_ANALYTICS') {
      return [
        { label: 'Active workforce', value: 248, tone: 'success' },
        { label: 'Open risk signals', value: 26, tone: 'warning' },
        { label: 'Payroll net pay', value: 'EGP 210,000', tone: 'default' },
        { label: 'Pending actions', value: 11, tone: 'warning' },
      ];
    }
    if (packCode === 'REWARD_CONTROL') {
      return [
        { label: 'Net pay', value: 'EGP 210,000', tone: 'default' },
        { label: 'Payroll blockers', value: 1, tone: 'warning' },
        { label: 'Benefits pending', value: 3, tone: 'warning' },
      ];
    }
    return [
      { label: 'Records analyzed', value: 248, tone: 'default' },
      { label: 'Exceptions', value: 7, tone: 'warning' },
      { label: 'Ready reports', value: 4, tone: 'success' },
    ];
  }

  private packNextActions(packCode: string): string[] {
    if (packCode === 'WORKFORCE_HEALTH') {
      return ['Review attendance exceptions by department.', 'Check leave liability for payroll-impacting absence.', 'Open manager-level drilldown for high-risk teams.'];
    }
    if (packCode === 'REWARD_CONTROL') {
      return ['Run payroll cost by entity.', 'Review deduction and tax components before payroll close.', 'Schedule benefits contribution reconciliation.'];
    }
    if (packCode === 'TALENT_360') {
      return ['Run 360 readiness by manager team.', 'Compare review completion with goal progress.', 'Flag teams below anonymity threshold.'];
    }
    return ['Run the recommended reports.', 'Save the pack as a scheduled dashboard.', 'Export exceptions for the responsible HR owner.'];
  }
}

const commonScopes = ['TENANT', 'LEGAL_ENTITY', 'ORG_UNIT', 'DEPARTMENT', 'MANAGER', 'EMPLOYEE', 'GROUP'];
const statusOptions = [
  { code: 'ACTIVE', label: 'Active' },
  { code: 'PENDING', label: 'Pending' },
  { code: 'APPROVED', label: 'Approved' },
  { code: 'REJECTED', label: 'Rejected' },
];
const periodOptions = [
  { code: 'CURRENT_MONTH', label: 'Current month' },
  { code: 'LAST_90_DAYS', label: 'Last 90 days' },
  { code: 'CURRENT_QUARTER', label: 'Current quarter' },
  { code: 'YEAR_TO_DATE', label: 'Year to date' },
];
const departmentOptions = [
  { code: 'ENGINEERING', label: 'Engineering' },
  { code: 'SALES', label: 'Sales' },
  { code: 'FINANCE', label: 'Finance' },
  { code: 'HR', label: 'Human Resources' },
];
const legalEntityOptions = [
  { code: 'ACME_US', label: 'Acme Corp USA' },
  { code: 'ACME_EG', label: 'Acme Egypt' },
  { code: 'ACME_UK', label: 'Acme Corp UK' },
];
const orgUnitOptions = [
  { code: 'TECHNOLOGY', label: 'Technology' },
  { code: 'COMMERCIAL', label: 'Commercial' },
  { code: 'CORPORATE', label: 'Corporate Services' },
];
const managerOptions = [
  { code: 'MGR_JAMES_HARRINGTON', label: 'James Harrington Team' },
  { code: 'MGR_SARAH_MITCHELL', label: 'Sarah Mitchell Team' },
  { code: 'MGR_DAVID_CHEN', label: 'David Chen Team' },
];
const employeeOptions = [
  { code: 'EMP_0042', label: 'Emily Chen' },
  { code: 'EMP_0044', label: 'Marcus Johnson' },
  { code: 'EMP_0047', label: 'Olivia Thompson' },
];
const savedGroupOptions = [
  { code: 'CRITICAL_ROLES', label: 'Critical roles' },
  { code: 'REMOTE_WORKERS', label: 'Remote workers' },
  { code: 'NEW_JOINERS_90', label: 'New joiners - 90 days' },
];

const REPORTING_POPULATION_OPTIONS: ReportingPopulationOption[] = [
  {
    scopeLevel: 'TENANT',
    label: 'Whole company',
    values: [{ code: 'ALL', label: 'All workers', description: 'All records the reporting admin can access.' }],
  },
  {
    scopeLevel: 'LEGAL_ENTITY',
    label: 'Legal entity',
    values: legalEntityOptions.map((option) => ({ ...option, description: 'Records assigned to this legal employer.' })),
  },
  {
    scopeLevel: 'ORG_UNIT',
    label: 'Org unit',
    values: orgUnitOptions.map((option) => ({ ...option, description: 'Records assigned to this operating unit.' })),
  },
  {
    scopeLevel: 'DEPARTMENT',
    label: 'Department',
    values: departmentOptions.map((option) => ({ ...option, description: 'Records assigned to this department.' })),
  },
  {
    scopeLevel: 'MANAGER',
    label: 'Manager team',
    values: managerOptions.map((option) => ({ ...option, description: 'Direct and indirect reports for this manager.' })),
  },
  {
    scopeLevel: 'EMPLOYEE',
    label: 'Employee',
    values: employeeOptions.map((option) => ({ ...option, description: 'Single worker reporting scope.' })),
  },
  {
    scopeLevel: 'GROUP',
    label: 'Saved workforce group',
    values: savedGroupOptions.map((option) => ({ ...option, description: 'A saved business audience managed by HR.' })),
  },
];

const REPORTING_DATA_SOURCES: ReportingDataSourceCatalogItem[] = [
  {
    code: 'HEADCOUNT',
    title: 'Employee Headcount',
    category: 'People & Organization',
    description: 'Worker, department, legal entity, manager, status, and demographic-safe headcount reporting.',
    scopeLevels: commonScopes,
    defaultVisualization: 'bar',
    fields: [
      { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
      { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
      { code: 'legalEntity', label: 'Legal entity', type: 'text', defaultSelected: true },
      { code: 'department', label: 'Department', type: 'text', defaultSelected: true },
      { code: 'manager', label: 'Manager', type: 'text' },
      { code: 'employmentStatus', label: 'Employment status', type: 'status', defaultSelected: true },
      { code: 'hireDate', label: 'Hire date', type: 'date' },
    ],
    metrics: [
      { code: 'headcount', label: 'Headcount', type: 'number' },
      { code: 'activeWorkers', label: 'Active workers', type: 'number' },
      { code: 'newHires', label: 'New hires', type: 'number' },
      { code: 'turnoverRate', label: 'Turnover rate', type: 'percentage' },
    ],
    groupBy: [
      { code: 'legalEntity', label: 'Legal entity', type: 'text' },
      { code: 'department', label: 'Department', type: 'text' },
      { code: 'manager', label: 'Manager', type: 'text' },
      { code: 'employmentStatus', label: 'Employment status', type: 'status' },
    ],
    filters: [
      { code: 'period', label: 'Period', type: 'status', options: periodOptions },
      { code: 'legalEntity', label: 'Legal entity', type: 'status', options: legalEntityOptions },
      { code: 'department', label: 'Department', type: 'status', options: departmentOptions },
      { code: 'employmentStatus', label: 'Employment status', type: 'status', options: statusOptions },
    ],
  },
  {
    code: 'ATTENDANCE',
    title: 'Attendance & Time Ledger',
    category: 'Workforce',
    description: 'Daily, weekly, monthly, and 90-day attendance ledger reporting with policy evidence.',
    scopeLevels: commonScopes,
    defaultVisualization: 'bar',
    fields: [
      { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
      { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
      { code: 'workDate', label: 'Work date', type: 'date', defaultSelected: true },
      { code: 'department', label: 'Department', type: 'text', defaultSelected: true },
      { code: 'attendanceStatus', label: 'Attendance status', type: 'status', defaultSelected: true },
      { code: 'policyCode', label: 'Policy code', type: 'text' },
    ],
    metrics: [
      { code: 'employeeDays', label: 'Employee days', type: 'number' },
      { code: 'payableHours', label: 'Payable hours', type: 'number' },
      { code: 'lateMinutes', label: 'Late minutes', type: 'number' },
      { code: 'overtimeHours', label: 'Overtime hours', type: 'number' },
      { code: 'exceptions', label: 'Exceptions', type: 'number' },
    ],
    groupBy: [
      { code: 'department', label: 'Department', type: 'text' },
      { code: 'manager', label: 'Manager', type: 'text' },
      { code: 'employeeName', label: 'Employee', type: 'text' },
      { code: 'attendanceStatus', label: 'Attendance status', type: 'status' },
      { code: 'workDate', label: 'Work date', type: 'date' },
      { code: 'policyCode', label: 'Policy code', type: 'text' },
    ],
    filters: [
      { code: 'period', label: 'Period', type: 'status', options: periodOptions },
      { code: 'department', label: 'Department', type: 'status', options: departmentOptions },
      { code: 'attendanceStatus', label: 'Attendance status', type: 'status', options: [
        { code: 'PRESENT', label: 'Present' },
        { code: 'LATE', label: 'Late' },
        { code: 'ABSENT', label: 'Absent' },
        { code: 'EXCEPTION', label: 'Exception' },
      ] },
      { code: 'policyCode', label: 'Policy code', type: 'status', options: [
        { code: 'STD_ATTENDANCE', label: 'Standard attendance' },
        { code: 'REMOTE_ATTENDANCE', label: 'Remote attendance' },
        { code: 'SHIFT_ATTENDANCE', label: 'Shift attendance' },
      ] },
    ],
  },
  {
    code: 'LEAVE',
    title: 'Leave Management',
    category: 'Workforce',
    description: 'Leave requests, balances, approvals, policy outcomes, and payroll impact.',
    scopeLevels: commonScopes,
    defaultVisualization: 'bar',
    fields: [
      { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
      { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
      { code: 'leaveType', label: 'Leave type', type: 'text', defaultSelected: true },
      { code: 'requestStatus', label: 'Request status', type: 'status', defaultSelected: true },
      { code: 'startDate', label: 'Start date', type: 'date' },
      { code: 'endDate', label: 'End date', type: 'date' },
      { code: 'approvalLevel', label: 'Approval level', type: 'text' },
    ],
    metrics: [
      { code: 'requestCount', label: 'Requests', type: 'number' },
      { code: 'requestedDays', label: 'Requested days', type: 'number' },
      { code: 'approvedDays', label: 'Approved days', type: 'number' },
      { code: 'balanceRemaining', label: 'Balance remaining', type: 'number' },
    ],
    groupBy: [
      { code: 'department', label: 'Department', type: 'text' },
      { code: 'leaveType', label: 'Leave type', type: 'text' },
      { code: 'requestStatus', label: 'Request status', type: 'status' },
      { code: 'approvalLevel', label: 'Approval level', type: 'text' },
    ],
    filters: [
      { code: 'period', label: 'Period', type: 'status', options: periodOptions },
      { code: 'department', label: 'Department', type: 'status', options: departmentOptions },
      { code: 'leaveType', label: 'Leave type', type: 'status', options: [
        { code: 'ANNUAL', label: 'Annual leave' },
        { code: 'SICK', label: 'Sick leave' },
        { code: 'PERSONAL', label: 'Personal leave' },
        { code: 'PERMISSION', label: 'Permission' },
      ] },
      { code: 'requestStatus', label: 'Request status', type: 'status', options: statusOptions },
    ],
  },
  {
    code: 'PAYROLL',
    title: 'Payroll & Payslips',
    category: 'Reward',
    description: 'Payroll cycles, salary composition, earnings, deductions, statutory amounts, and net pay.',
    scopeLevels: commonScopes,
    defaultVisualization: 'kpi',
    fields: [
      { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
      { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
      { code: 'payPeriod', label: 'Pay period', type: 'text', defaultSelected: true },
      { code: 'legalEntity', label: 'Legal entity', type: 'text', defaultSelected: true },
      { code: 'currency', label: 'Currency', type: 'text' },
      { code: 'payrollStatus', label: 'Payroll status', type: 'status', defaultSelected: true },
    ],
    metrics: [
      { code: 'grossPay', label: 'Gross pay', type: 'currency' },
      { code: 'netPay', label: 'Net pay', type: 'currency' },
      { code: 'taxAmount', label: 'Tax', type: 'currency' },
      { code: 'insuranceAmount', label: 'Insurance', type: 'currency' },
      { code: 'deductionAmount', label: 'Deductions', type: 'currency' },
    ],
    groupBy: [
      { code: 'legalEntity', label: 'Legal entity', type: 'text' },
      { code: 'department', label: 'Department', type: 'text' },
      { code: 'payPeriod', label: 'Pay period', type: 'text' },
      { code: 'payrollStatus', label: 'Payroll status', type: 'status' },
    ],
    filters: [
      { code: 'period', label: 'Period', type: 'status', options: periodOptions },
      { code: 'legalEntity', label: 'Legal entity', type: 'status', options: legalEntityOptions },
      { code: 'department', label: 'Department', type: 'status', options: departmentOptions },
      { code: 'payrollStatus', label: 'Payroll status', type: 'status', options: [
        { code: 'OPEN', label: 'Open' },
        { code: 'READY', label: 'Ready' },
        { code: 'BLOCKED', label: 'Blocked' },
        { code: 'CLOSED', label: 'Closed' },
      ] },
    ],
  },
  {
    code: 'PERFORMANCE',
    title: 'Performance & 360',
    category: 'Talent',
    description: 'Review cycles, goals, 360 feedback, ratings, calibration, and profile impact.',
    scopeLevels: commonScopes,
    defaultVisualization: 'bar',
    fields: [
      { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
      { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
      { code: 'cycleName', label: 'Cycle', type: 'text', defaultSelected: true },
      { code: 'reviewStatus', label: 'Review status', type: 'status', defaultSelected: true },
      { code: 'department', label: 'Department', type: 'text' },
    ],
    metrics: [
      { code: 'reviewCount', label: 'Reviews', type: 'number' },
      { code: 'averageRating', label: 'Average rating', type: 'number' },
      { code: 'goalProgress', label: 'Goal progress', type: 'percentage' },
      { code: 'feedbackResponses', label: '360 responses', type: 'number' },
    ],
    groupBy: [
      { code: 'department', label: 'Department', type: 'text' },
      { code: 'cycleName', label: 'Cycle', type: 'text' },
      { code: 'reviewStatus', label: 'Review status', type: 'status' },
    ],
    filters: [
      { code: 'period', label: 'Period', type: 'status', options: periodOptions },
      { code: 'department', label: 'Department', type: 'status', options: departmentOptions },
      { code: 'cycleName', label: 'Cycle', type: 'status', options: [
        { code: 'Q2_2026', label: 'Q2 2026' },
        { code: 'H1_2026', label: 'H1 2026' },
        { code: 'ANNUAL_2026', label: 'Annual 2026' },
      ] },
      { code: 'reviewStatus', label: 'Review status', type: 'status', options: [
        { code: 'NOT_STARTED', label: 'Not started' },
        { code: 'IN_PROGRESS', label: 'In progress' },
        { code: 'COMPLETED', label: 'Completed' },
        { code: 'OVERDUE', label: 'Overdue' },
      ] },
    ],
  },
  {
    code: 'BENEFITS',
    title: 'Benefits & Enrollment',
    category: 'Reward',
    description: 'Eligibility, enrollments, dependents, life events, carrier reconciliation, and payroll contribution sync.',
    scopeLevels: commonScopes,
    defaultVisualization: 'pie',
    fields: [
      { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
      { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
      { code: 'programName', label: 'Program', type: 'text', defaultSelected: true },
      { code: 'coverageLevel', label: 'Coverage level', type: 'text', defaultSelected: true },
      { code: 'enrollmentStatus', label: 'Enrollment status', type: 'status', defaultSelected: true },
    ],
    metrics: [
      { code: 'enrollments', label: 'Enrollments', type: 'number' },
      { code: 'dependentsCovered', label: 'Dependents covered', type: 'number' },
      { code: 'employeeContribution', label: 'Employee contribution', type: 'currency' },
      { code: 'employerContribution', label: 'Employer contribution', type: 'currency' },
    ],
    groupBy: [
      { code: 'programName', label: 'Program', type: 'text' },
      { code: 'coverageLevel', label: 'Coverage level', type: 'text' },
      { code: 'enrollmentStatus', label: 'Enrollment status', type: 'status' },
    ],
    filters: [
      { code: 'period', label: 'Period', type: 'status', options: periodOptions },
      { code: 'programName', label: 'Program', type: 'status', options: [
        { code: 'MEDICAL', label: 'Medical' },
        { code: 'DENTAL', label: 'Dental' },
        { code: 'LIFE', label: 'Life insurance' },
      ] },
      { code: 'enrollmentStatus', label: 'Enrollment status', type: 'status', options: [
        { code: 'ENROLLED', label: 'Enrolled' },
        { code: 'PENDING', label: 'Pending' },
        { code: 'WAIVED', label: 'Waived' },
      ] },
    ],
  },
  {
    code: 'COMPLIANCE',
    title: 'Compliance & Acknowledgements',
    category: 'Governance',
    description: 'Policy acknowledgements, statutory reports, legal holds, evidence exports, and overdue compliance actions.',
    scopeLevels: commonScopes,
    defaultVisualization: 'bar',
    fields: [
      { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
      { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
      { code: 'policyCode', label: 'Policy', type: 'text', defaultSelected: true },
      { code: 'documentType', label: 'Document type', type: 'text', defaultSelected: true },
      { code: 'acknowledgementStatus', label: 'Acknowledgement status', type: 'status', defaultSelected: true },
      { code: 'dueDate', label: 'Due date', type: 'date' },
    ],
    metrics: [
      { code: 'acknowledgements', label: 'Acknowledgements', type: 'number' },
      { code: 'overdueAcknowledgements', label: 'Overdue acknowledgements', type: 'number' },
      { code: 'statutoryReports', label: 'Statutory reports', type: 'number' },
      { code: 'legalHolds', label: 'Legal holds', type: 'number' },
    ],
    groupBy: [
      { code: 'policyCode', label: 'Policy', type: 'text' },
      { code: 'documentType', label: 'Document type', type: 'text' },
      { code: 'acknowledgementStatus', label: 'Acknowledgement status', type: 'status' },
      { code: 'department', label: 'Department', type: 'text' },
    ],
    filters: [
      { code: 'period', label: 'Period', type: 'status', options: periodOptions },
      { code: 'department', label: 'Department', type: 'status', options: departmentOptions },
      { code: 'acknowledgementStatus', label: 'Acknowledgement status', type: 'status', options: [
        { code: 'ACKNOWLEDGED', label: 'Acknowledged' },
        { code: 'PENDING', label: 'Pending' },
        { code: 'OVERDUE', label: 'Overdue' },
      ] },
      { code: 'documentType', label: 'Document type', type: 'status', options: [
        { code: 'POLICY', label: 'Policy' },
        { code: 'STATUTORY', label: 'Statutory' },
        { code: 'LEGAL_HOLD', label: 'Legal hold' },
      ] },
    ],
  },
  {
    code: 'SERVICES',
    title: 'HR Services & Cases',
    category: 'Service Delivery',
    description: 'Service requests, case volume, SLA risk, catalog demand, open tasks, and resolution performance.',
    scopeLevels: commonScopes,
    defaultVisualization: 'bar',
    fields: [
      { code: 'caseNumber', label: 'Case number', type: 'text', defaultSelected: true },
      { code: 'serviceName', label: 'Service', type: 'text', defaultSelected: true },
      { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
      { code: 'caseStatus', label: 'Case status', type: 'status', defaultSelected: true },
      { code: 'ownerTeam', label: 'Owner team', type: 'text' },
    ],
    metrics: [
      { code: 'cases', label: 'Cases', type: 'number' },
      { code: 'openTasks', label: 'Open tasks', type: 'number' },
      { code: 'slaBreaches', label: 'SLA breaches', type: 'number' },
      { code: 'resolutionHours', label: 'Resolution hours', type: 'number' },
    ],
    groupBy: [
      { code: 'serviceName', label: 'Service', type: 'text' },
      { code: 'caseStatus', label: 'Case status', type: 'status' },
      { code: 'ownerTeam', label: 'Owner team', type: 'text' },
      { code: 'department', label: 'Department', type: 'text' },
    ],
    filters: [
      { code: 'period', label: 'Period', type: 'status', options: periodOptions },
      { code: 'department', label: 'Department', type: 'status', options: departmentOptions },
      { code: 'caseStatus', label: 'Case status', type: 'status', options: [
        { code: 'OPEN', label: 'Open' },
        { code: 'IN_PROGRESS', label: 'In progress' },
        { code: 'RESOLVED', label: 'Resolved' },
        { code: 'SLA_RISK', label: 'SLA risk' },
      ] },
    ],
  },
  {
    code: 'ENGAGEMENT',
    title: 'Engagement & Sentiment',
    category: 'Employee Experience',
    description: 'Survey participation, engagement scores, sentiment, recognition, and employee voice themes.',
    scopeLevels: commonScopes,
    defaultVisualization: 'bar',
    fields: [
      { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
      { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
      { code: 'surveyName', label: 'Survey', type: 'text', defaultSelected: true },
      { code: 'engagementBand', label: 'Engagement band', type: 'status', defaultSelected: true },
      { code: 'department', label: 'Department', type: 'text' },
    ],
    metrics: [
      { code: 'participationRate', label: 'Participation rate', type: 'percentage' },
      { code: 'engagementScore', label: 'Engagement score', type: 'number' },
      { code: 'sentimentRisk', label: 'Sentiment risk', type: 'number' },
      { code: 'recognitionCount', label: 'Recognition count', type: 'number' },
    ],
    groupBy: [
      { code: 'department', label: 'Department', type: 'text' },
      { code: 'manager', label: 'Manager', type: 'text' },
      { code: 'engagementBand', label: 'Engagement band', type: 'status' },
    ],
    filters: [
      { code: 'period', label: 'Period', type: 'status', options: periodOptions },
      { code: 'department', label: 'Department', type: 'status', options: departmentOptions },
      { code: 'engagementBand', label: 'Engagement band', type: 'status', options: [
        { code: 'HIGH', label: 'High engagement' },
        { code: 'MEDIUM', label: 'Medium engagement' },
        { code: 'LOW', label: 'Low engagement' },
      ] },
    ],
  },
  {
    code: 'LEARNING',
    title: 'Learning & Skills',
    category: 'Talent',
    description: 'Training completion, certifications, license readiness, skills gaps, and learning compliance.',
    scopeLevels: commonScopes,
    defaultVisualization: 'bar',
    fields: [
      { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
      { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
      { code: 'courseName', label: 'Course', type: 'text', defaultSelected: true },
      { code: 'skillName', label: 'Skill', type: 'text', defaultSelected: true },
      { code: 'completionStatus', label: 'Completion status', type: 'status', defaultSelected: true },
    ],
    metrics: [
      { code: 'completionRate', label: 'Completion rate', type: 'percentage' },
      { code: 'overdueCourses', label: 'Overdue courses', type: 'number' },
      { code: 'certificationsExpiring', label: 'Certifications expiring', type: 'number' },
      { code: 'skillsGap', label: 'Skills gap', type: 'number' },
    ],
    groupBy: [
      { code: 'department', label: 'Department', type: 'text' },
      { code: 'skillName', label: 'Skill', type: 'text' },
      { code: 'completionStatus', label: 'Completion status', type: 'status' },
    ],
    filters: [
      { code: 'period', label: 'Period', type: 'status', options: periodOptions },
      { code: 'department', label: 'Department', type: 'status', options: departmentOptions },
      { code: 'completionStatus', label: 'Completion status', type: 'status', options: [
        { code: 'COMPLETED', label: 'Completed' },
        { code: 'IN_PROGRESS', label: 'In progress' },
        { code: 'OVERDUE', label: 'Overdue' },
      ] },
    ],
  },
  {
    code: 'RECRUITMENT',
    title: 'Recruitment Pipeline',
    category: 'Talent Acquisition',
    description: 'Open roles, candidate funnel, source effectiveness, offer acceptance, and time-to-fill.',
    scopeLevels: commonScopes,
    defaultVisualization: 'bar',
    fields: [
      { code: 'requisitionCode', label: 'Requisition', type: 'text', defaultSelected: true },
      { code: 'jobTitle', label: 'Job title', type: 'text', defaultSelected: true },
      { code: 'department', label: 'Department', type: 'text', defaultSelected: true },
      { code: 'candidateStage', label: 'Candidate stage', type: 'status', defaultSelected: true },
      { code: 'source', label: 'Source', type: 'text' },
    ],
    metrics: [
      { code: 'openRequisitions', label: 'Open requisitions', type: 'number' },
      { code: 'candidateCount', label: 'Candidates', type: 'number' },
      { code: 'timeToFillDays', label: 'Time to fill', type: 'number' },
      { code: 'offerAcceptanceRate', label: 'Offer acceptance rate', type: 'percentage' },
    ],
    groupBy: [
      { code: 'department', label: 'Department', type: 'text' },
      { code: 'candidateStage', label: 'Candidate stage', type: 'status' },
      { code: 'source', label: 'Source', type: 'text' },
    ],
    filters: [
      { code: 'period', label: 'Period', type: 'status', options: periodOptions },
      { code: 'department', label: 'Department', type: 'status', options: departmentOptions },
      { code: 'candidateStage', label: 'Candidate stage', type: 'status', options: [
        { code: 'SCREENING', label: 'Screening' },
        { code: 'INTERVIEW', label: 'Interview' },
        { code: 'OFFER', label: 'Offer' },
        { code: 'HIRED', label: 'Hired' },
      ] },
    ],
  },
  {
    code: 'ONBOARDING',
    title: 'Onboarding & Probation',
    category: 'Talent Acquisition',
    description: 'Joining readiness, onboarding tasks, IT provisioning, first 30/60/90 progress, and probation outcomes.',
    scopeLevels: commonScopes,
    defaultVisualization: 'bar',
    fields: [
      { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
      { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
      { code: 'joiningDate', label: 'Joining date', type: 'date', defaultSelected: true },
      { code: 'onboardingStatus', label: 'Onboarding status', type: 'status', defaultSelected: true },
      { code: 'probationStatus', label: 'Probation status', type: 'status' },
    ],
    metrics: [
      { code: 'taskCompletionRate', label: 'Task completion rate', type: 'percentage' },
      { code: 'pendingTasks', label: 'Pending tasks', type: 'number' },
      { code: 'probationReviewsDue', label: 'Probation reviews due', type: 'number' },
      { code: 'timeToProductivityDays', label: 'Time to productivity', type: 'number' },
    ],
    groupBy: [
      { code: 'department', label: 'Department', type: 'text' },
      { code: 'onboardingStatus', label: 'Onboarding status', type: 'status' },
      { code: 'probationStatus', label: 'Probation status', type: 'status' },
    ],
    filters: [
      { code: 'period', label: 'Period', type: 'status', options: periodOptions },
      { code: 'department', label: 'Department', type: 'status', options: departmentOptions },
      { code: 'onboardingStatus', label: 'Onboarding status', type: 'status', options: [
        { code: 'NOT_STARTED', label: 'Not started' },
        { code: 'IN_PROGRESS', label: 'In progress' },
        { code: 'AT_RISK', label: 'At risk' },
        { code: 'COMPLETED', label: 'Completed' },
      ] },
    ],
  },
  {
    code: 'ACCESS',
    title: 'Access Governance & Audit',
    category: 'Governance',
    description: 'Role grants, access reviews, SoD conflicts, service account credentials, and audit exceptions.',
    scopeLevels: commonScopes,
    defaultVisualization: 'bar',
    fields: [
      { code: 'principalName', label: 'User or service account', type: 'text', defaultSelected: true },
      { code: 'roleName', label: 'Role', type: 'text', defaultSelected: true },
      { code: 'accessStatus', label: 'Access status', type: 'status', defaultSelected: true },
      { code: 'reviewStatus', label: 'Review status', type: 'status', defaultSelected: true },
    ],
    metrics: [
      { code: 'activeGrants', label: 'Active grants', type: 'number' },
      { code: 'sodViolations', label: 'SoD violations', type: 'number' },
      { code: 'overdueReviews', label: 'Overdue reviews', type: 'number' },
      { code: 'expiringCredentials', label: 'Expiring credentials', type: 'number' },
    ],
    groupBy: [
      { code: 'roleName', label: 'Role', type: 'text' },
      { code: 'accessStatus', label: 'Access status', type: 'status' },
      { code: 'reviewStatus', label: 'Review status', type: 'status' },
    ],
    filters: [
      { code: 'period', label: 'Period', type: 'status', options: periodOptions },
      { code: 'reviewStatus', label: 'Review status', type: 'status', options: [
        { code: 'PENDING', label: 'Pending' },
        { code: 'CERTIFIED', label: 'Certified' },
        { code: 'REVOKE_REQUESTED', label: 'Revoke requested' },
        { code: 'OVERDUE', label: 'Overdue' },
      ] },
    ],
  },
  {
    code: 'RETENTION',
    title: 'Retention, Attrition & Risk',
    category: 'Workforce Strategy',
    description: 'Attrition trends, regrettable loss, retention risk, tenure hotspots, and manager-team risk signals.',
    scopeLevels: commonScopes,
    defaultVisualization: 'bar',
    fields: [
      { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
      { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
      { code: 'department', label: 'Department', type: 'text', defaultSelected: true },
      { code: 'riskBand', label: 'Risk band', type: 'status', defaultSelected: true },
      { code: 'tenureBand', label: 'Tenure band', type: 'status' },
    ],
    metrics: [
      { code: 'attritionRate', label: 'Attrition rate', type: 'percentage' },
      { code: 'retentionRiskCount', label: 'Retention risk count', type: 'number' },
      { code: 'regrettableLosses', label: 'Regrettable losses', type: 'number' },
      { code: 'criticalRoleRisk', label: 'Critical role risk', type: 'number' },
    ],
    groupBy: [
      { code: 'department', label: 'Department', type: 'text' },
      { code: 'manager', label: 'Manager', type: 'text' },
      { code: 'riskBand', label: 'Risk band', type: 'status' },
      { code: 'tenureBand', label: 'Tenure band', type: 'status' },
    ],
    filters: [
      { code: 'period', label: 'Period', type: 'status', options: periodOptions },
      { code: 'department', label: 'Department', type: 'status', options: departmentOptions },
      { code: 'riskBand', label: 'Risk band', type: 'status', options: [
        { code: 'HIGH', label: 'High risk' },
        { code: 'MEDIUM', label: 'Medium risk' },
        { code: 'LOW', label: 'Low risk' },
      ] },
    ],
  },
];

const REPORTING_TEMPLATES: ReportingTemplateCatalogItem[] = [
  {
    code: 'headcount-movement-summary',
    title: 'Headcount Movement Summary',
    dataSource: 'HEADCOUNT',
    description: 'Headcount, active workforce, new hires, exits, and turnover by organization level.',
    fields: ['employeeNumber', 'employeeName', 'legalEntity', 'department', 'employmentStatus'],
    metrics: ['headcount', 'activeWorkers', 'newHires', 'turnoverRate'],
    groupBy: ['legalEntity', 'department', 'employmentStatus'],
    scopeLevel: 'LEGAL_ENTITY',
    visualization: 'bar',
    recommended: true,
    recommendationReason: 'Makes employee master data useful for workforce composition and org movement analytics.',
    packCodes: ['FULL_HR_ANALYTICS', 'WORKFORCE_HEALTH'],
    defaultFilters: [{ code: 'period', value: 'CURRENT_MONTH' }],
  },
  {
    code: 'attendance-exceptions-monthly',
    title: 'Monthly Attendance Exceptions',
    dataSource: 'ATTENDANCE',
    description: 'Late arrivals, missing punches, geofence exceptions, and payroll readiness by department.',
    fields: ['employeeNumber', 'employeeName', 'workDate', 'attendanceStatus', 'policyCode'],
    metrics: ['lateMinutes', 'exceptions', 'payableHours'],
    groupBy: ['department', 'attendanceStatus'],
    scopeLevel: 'DEPARTMENT',
    visualization: 'bar',
    recommended: true,
    recommendationReason: 'Best first report for attendance policy, payroll readiness, and manager action.',
    packCodes: ['FULL_HR_ANALYTICS', 'WORKFORCE_HEALTH', 'GOVERNANCE_PACK'],
    defaultFilters: [{ code: 'period', value: 'CURRENT_MONTH' }],
  },
  {
    code: 'leave-liability',
    title: 'Leave Balance Liability',
    dataSource: 'LEAVE',
    description: 'Leave balance, pending requests, approved days, and payroll-impacting absence by entity.',
    fields: ['employeeNumber', 'employeeName', 'leaveType', 'requestStatus'],
    metrics: ['requestedDays', 'approvedDays', 'balanceRemaining'],
    groupBy: ['leaveType', 'department'],
    scopeLevel: 'LEGAL_ENTITY',
    visualization: 'bar',
    recommended: true,
    recommendationReason: 'Shows absence liability and payroll-impacting leave exposure.',
    packCodes: ['FULL_HR_ANALYTICS', 'WORKFORCE_HEALTH'],
    defaultFilters: [{ code: 'period', value: 'LAST_90_DAYS' }],
  },
  {
    code: 'payroll-cost-summary',
    title: 'Payroll Cost Summary',
    dataSource: 'PAYROLL',
    description: 'Gross-to-net, statutory amounts, deductions, and net pay by entity or department.',
    fields: ['employeeNumber', 'employeeName', 'payPeriod', 'legalEntity', 'payrollStatus'],
    metrics: ['grossPay', 'taxAmount', 'insuranceAmount', 'deductionAmount', 'netPay'],
    groupBy: ['legalEntity', 'department'],
    scopeLevel: 'LEGAL_ENTITY',
    visualization: 'kpi',
    recommended: true,
    recommendationReason: 'Connects salary composition, deductions, statutory amounts, and net pay.',
    packCodes: ['FULL_HR_ANALYTICS', 'REWARD_CONTROL'],
    defaultFilters: [{ code: 'period', value: 'CURRENT_MONTH' }],
  },
  {
    code: 'performance-360-readiness',
    title: 'Performance 360 Readiness',
    dataSource: 'PERFORMANCE',
    description: 'Review completion, peer feedback response depth, average rating, and goal progress by manager team.',
    fields: ['employeeNumber', 'employeeName', 'cycleName', 'reviewStatus'],
    metrics: ['reviewCount', 'feedbackResponses', 'averageRating', 'goalProgress'],
    groupBy: ['cycleName', 'department'],
    scopeLevel: 'MANAGER',
    visualization: 'bar',
    recommended: true,
    recommendationReason: 'Highlights review completion, feedback depth, and manager-team readiness.',
    packCodes: ['FULL_HR_ANALYTICS', 'TALENT_360'],
    defaultFilters: [{ code: 'period', value: 'CURRENT_QUARTER' }],
  },
  {
    code: 'benefits-open-enrollment',
    title: 'Benefits Open Enrollment',
    dataSource: 'BENEFITS',
    description: 'Enrollment status, coverage level, dependents, and contribution impact by program.',
    fields: ['employeeNumber', 'employeeName', 'programName', 'coverageLevel', 'enrollmentStatus'],
    metrics: ['enrollments', 'dependentsCovered', 'employeeContribution', 'employerContribution'],
    groupBy: ['programName', 'coverageLevel'],
    scopeLevel: 'TENANT',
    visualization: 'pie',
    recommended: true,
    recommendationReason: 'Tracks enrollment outcomes, coverage levels, and contribution impact.',
    packCodes: ['FULL_HR_ANALYTICS', 'REWARD_CONTROL'],
    defaultFilters: [{ code: 'period', value: 'CURRENT_MONTH' }],
  },
  {
    code: 'compliance-acknowledgement-risk',
    title: 'Compliance Acknowledgement Risk',
    dataSource: 'COMPLIANCE',
    description: 'Overdue acknowledgements, policy documents, statutory reports, and evidence gaps by owner.',
    fields: ['employeeNumber', 'employeeName', 'policyCode', 'documentType', 'acknowledgementStatus'],
    metrics: ['acknowledgements', 'overdueAcknowledgements', 'statutoryReports'],
    groupBy: ['acknowledgementStatus', 'documentType'],
    scopeLevel: 'TENANT',
    visualization: 'bar',
    recommended: true,
    recommendationReason: 'Surfaces overdue acknowledgements and statutory evidence gaps.',
    packCodes: ['FULL_HR_ANALYTICS', 'GOVERNANCE_PACK'],
    defaultFilters: [{ code: 'period', value: 'YEAR_TO_DATE' }],
  },
  {
    code: 'hr-services-sla-demand',
    title: 'HR Services SLA Demand',
    dataSource: 'SERVICES',
    description: 'Case demand, SLA breaches, open tasks, and resolution hours by service and owner team.',
    fields: ['caseNumber', 'serviceName', 'employeeName', 'caseStatus'],
    metrics: ['cases', 'openTasks', 'slaBreaches', 'resolutionHours'],
    groupBy: ['serviceName', 'caseStatus'],
    scopeLevel: 'DEPARTMENT',
    visualization: 'bar',
    recommended: true,
    recommendationReason: 'Shows HR service demand, open tasks, and SLA pressure by service owner.',
    packCodes: ['FULL_HR_ANALYTICS', 'GOVERNANCE_PACK'],
    defaultFilters: [{ code: 'period', value: 'CURRENT_MONTH' }],
  },
  {
    code: 'engagement-sentiment-risk',
    title: 'Engagement Sentiment Risk',
    dataSource: 'ENGAGEMENT',
    description: 'Engagement score, survey participation, sentiment risk, and recognition by team.',
    fields: ['employeeNumber', 'employeeName', 'surveyName', 'engagementBand'],
    metrics: ['participationRate', 'engagementScore', 'sentimentRisk', 'recognitionCount'],
    groupBy: ['department', 'manager', 'engagementBand'],
    scopeLevel: 'DEPARTMENT',
    visualization: 'bar',
    recommended: true,
    recommendationReason: 'Connects employee voice with team-level retention and service pressure.',
    packCodes: ['FULL_HR_ANALYTICS', 'ENGAGEMENT_RISK'],
    defaultFilters: [{ code: 'period', value: 'CURRENT_QUARTER' }],
  },
  {
    code: 'learning-skills-gap',
    title: 'Learning Skills Gap',
    dataSource: 'LEARNING',
    description: 'Training completion, expiring certifications, and skills gaps by department and skill.',
    fields: ['employeeNumber', 'employeeName', 'courseName', 'skillName', 'completionStatus'],
    metrics: ['completionRate', 'overdueCourses', 'certificationsExpiring', 'skillsGap'],
    groupBy: ['department', 'skillName', 'completionStatus'],
    scopeLevel: 'DEPARTMENT',
    visualization: 'bar',
    recommended: true,
    recommendationReason: 'Shows capability gaps that affect performance, compliance, and workforce planning.',
    packCodes: ['FULL_HR_ANALYTICS', 'TALENT_360'],
    defaultFilters: [{ code: 'period', value: 'CURRENT_QUARTER' }],
  },
  {
    code: 'recruitment-funnel-health',
    title: 'Recruitment Funnel Health',
    dataSource: 'RECRUITMENT',
    description: 'Open roles, candidate stages, source effectiveness, time-to-fill, and offer acceptance.',
    fields: ['requisitionCode', 'jobTitle', 'department', 'candidateStage', 'source'],
    metrics: ['openRequisitions', 'candidateCount', 'timeToFillDays', 'offerAcceptanceRate'],
    groupBy: ['department', 'candidateStage', 'source'],
    scopeLevel: 'DEPARTMENT',
    visualization: 'bar',
    recommended: true,
    recommendationReason: 'Connects hiring demand with vacancies, headcount planning, and onboarding load.',
    packCodes: ['FULL_HR_ANALYTICS', 'WORKFORCE_HEALTH'],
    defaultFilters: [{ code: 'period', value: 'CURRENT_MONTH' }],
  },
  {
    code: 'onboarding-probation-readiness',
    title: 'Onboarding Probation Readiness',
    dataSource: 'ONBOARDING',
    description: 'Joining task completion, provisioning readiness, probation reviews, and time-to-productivity.',
    fields: ['employeeNumber', 'employeeName', 'joiningDate', 'onboardingStatus', 'probationStatus'],
    metrics: ['taskCompletionRate', 'pendingTasks', 'probationReviewsDue', 'timeToProductivityDays'],
    groupBy: ['department', 'onboardingStatus', 'probationStatus'],
    scopeLevel: 'DEPARTMENT',
    visualization: 'bar',
    recommended: true,
    recommendationReason: 'Shows where new hires may be delayed before they become productive.',
    packCodes: ['FULL_HR_ANALYTICS', 'WORKFORCE_HEALTH'],
    defaultFilters: [{ code: 'period', value: 'LAST_90_DAYS' }],
  },
  {
    code: 'access-certification-risk',
    title: 'Access Certification Risk',
    dataSource: 'ACCESS',
    description: 'Role grants, SoD conflicts, overdue reviews, and expiring service credentials.',
    fields: ['principalName', 'roleName', 'accessStatus', 'reviewStatus'],
    metrics: ['activeGrants', 'sodViolations', 'overdueReviews', 'expiringCredentials'],
    groupBy: ['roleName', 'accessStatus', 'reviewStatus'],
    scopeLevel: 'TENANT',
    visualization: 'bar',
    recommended: true,
    recommendationReason: 'Brings access governance into HR reporting and audit readiness.',
    packCodes: ['FULL_HR_ANALYTICS', 'GOVERNANCE_PACK'],
    defaultFilters: [{ code: 'period', value: 'YEAR_TO_DATE' }],
  },
  {
    code: 'retention-risk-hotspots',
    title: 'Retention Risk Hotspots',
    dataSource: 'RETENTION',
    description: 'Attrition rate, regrettable losses, critical role risk, tenure bands, and manager-team risk.',
    fields: ['employeeNumber', 'employeeName', 'department', 'riskBand', 'tenureBand'],
    metrics: ['attritionRate', 'retentionRiskCount', 'regrettableLosses', 'criticalRoleRisk'],
    groupBy: ['department', 'manager', 'riskBand', 'tenureBand'],
    scopeLevel: 'MANAGER',
    visualization: 'bar',
    recommended: true,
    recommendationReason: 'Combines workforce, engagement, performance, and service signals into retention risk.',
    packCodes: ['FULL_HR_ANALYTICS', 'ENGAGEMENT_RISK'],
    defaultFilters: [{ code: 'period', value: 'LAST_90_DAYS' }],
  },
];

const REPORTING_ANALYTICS_PACKS: ReportingAnalyticsPack[] = [
  {
    code: 'FULL_HR_ANALYTICS',
    title: 'Full HR Analytics',
    category: 'Executive',
    description: 'Run the complete cross-module HR view across workforce, leave, payroll, performance, benefits, engagement, compliance, services, and risk.',
    reportCodes: ['headcount-movement-summary', 'attendance-exceptions-monthly', 'leave-liability', 'payroll-cost-summary', 'performance-360-readiness', 'benefits-open-enrollment', 'compliance-acknowledgement-risk', 'hr-services-sla-demand', 'engagement-sentiment-risk', 'learning-skills-gap', 'recruitment-funnel-health', 'onboarding-probation-readiness', 'access-certification-risk', 'retention-risk-hotspots'],
    dataSources: ['HEADCOUNT', 'ATTENDANCE', 'LEAVE', 'PAYROLL', 'PERFORMANCE', 'BENEFITS', 'COMPLIANCE', 'SERVICES', 'ENGAGEMENT', 'LEARNING', 'RECRUITMENT', 'ONBOARDING', 'ACCESS', 'RETENTION'],
    defaultScopeLevel: 'TENANT',
    defaultPeriod: 'CURRENT_MONTH',
    outputs: ['Executive scorecard', 'Risk signals', 'Recommended drilldowns', 'Export-ready report list'],
  },
  {
    code: 'WORKFORCE_HEALTH',
    title: 'Workforce Health',
    category: 'Workforce',
    description: 'Attendance, leave, absence liability, overtime, and manager-team risk signals.',
    reportCodes: ['headcount-movement-summary', 'attendance-exceptions-monthly', 'leave-liability', 'recruitment-funnel-health', 'onboarding-probation-readiness'],
    dataSources: ['HEADCOUNT', 'ATTENDANCE', 'LEAVE', 'RECRUITMENT', 'ONBOARDING'],
    defaultScopeLevel: 'DEPARTMENT',
    defaultPeriod: 'LAST_90_DAYS',
    outputs: ['Attendance exceptions', 'Leave pressure', 'Coverage gaps'],
  },
  {
    code: 'REWARD_CONTROL',
    title: 'Reward Control',
    category: 'Reward',
    description: 'Payroll cost, salary components, deductions, benefits contribution, and payment readiness.',
    reportCodes: ['payroll-cost-summary', 'benefits-open-enrollment'],
    dataSources: ['PAYROLL', 'BENEFITS'],
    defaultScopeLevel: 'LEGAL_ENTITY',
    defaultPeriod: 'CURRENT_MONTH',
    outputs: ['Payroll cost summary', 'Close blockers', 'Benefits contribution checks'],
  },
  {
    code: 'TALENT_360',
    title: 'Talent & 360',
    category: 'Talent',
    description: 'Review readiness, feedback completion, goal progress, rating distribution, and team impact.',
    reportCodes: ['performance-360-readiness', 'learning-skills-gap'],
    dataSources: ['PERFORMANCE', 'LEARNING', 'HEADCOUNT'],
    defaultScopeLevel: 'MANAGER',
    defaultPeriod: 'CURRENT_QUARTER',
    outputs: ['360 readiness', 'Review completion', 'Goal progress'],
  },
  {
    code: 'GOVERNANCE_PACK',
    title: 'Governance & Compliance',
    category: 'Governance',
    description: 'Policy, compliance, reporting usage, queue health, and audit-oriented exception reporting.',
    reportCodes: ['compliance-acknowledgement-risk', 'access-certification-risk', 'hr-services-sla-demand', 'attendance-exceptions-monthly'],
    dataSources: ['COMPLIANCE', 'ACCESS', 'SERVICES', 'ATTENDANCE'],
    defaultScopeLevel: 'TENANT',
    defaultPeriod: 'YEAR_TO_DATE',
    outputs: ['Exception evidence', 'Control readiness', 'Audit export list'],
  },
  {
    code: 'ENGAGEMENT_RISK',
    title: 'Engagement & Retention',
    category: 'Employee Experience',
    description: 'Engagement, sentiment, service pressure, attrition risk, tenure hotspots, and manager-team retention signals.',
    reportCodes: ['engagement-sentiment-risk', 'retention-risk-hotspots', 'performance-360-readiness', 'hr-services-sla-demand'],
    dataSources: ['ENGAGEMENT', 'RETENTION', 'PERFORMANCE', 'SERVICES', 'HEADCOUNT'],
    defaultScopeLevel: 'MANAGER',
    defaultPeriod: 'LAST_90_DAYS',
    outputs: ['Engagement risk', 'Retention hotspots', 'Manager action list'],
  },
];

const REPORTING_BUSINESS_RELATIONSHIPS: ReportingBusinessRelationship[] = [
  { code: 'employee-org', title: 'Employee to Organization', from: 'HEADCOUNT', to: 'HEADCOUNT', relationship: 'Employee belongs to legal entity, location, department, position, and manager.', businessUse: 'Scopes every report by entity, department, manager, group, or employee.', grain: 'One row per worker assignment', joinKeys: ['workerId', 'departmentId', 'managerWorkerId'], privacyLevel: 'standard', lineage: ['Worker profile', 'Assignment', 'Organization structure'], recommendedDrilldowns: ['Legal entity', 'Department', 'Manager', 'Employee'] },
  { code: 'attendance-payroll', title: 'Attendance to Payroll', from: 'ATTENDANCE', to: 'PAYROLL', relationship: 'Attendance ledger feeds payable hours, overtime, lateness, and deductions.', businessUse: 'Explains payroll movement and close blockers from time data.', grain: 'Worker-day to payroll period', joinKeys: ['workerId', 'workDate', 'payPeriod'], privacyLevel: 'sensitive', lineage: ['Attendance event', 'Daily ledger', 'Payroll preview'], recommendedDrilldowns: ['Department', 'Employee', 'Pay period', 'Attendance status'] },
  { code: 'leave-attendance-payroll', title: 'Leave to Attendance and Payroll', from: 'LEAVE', to: 'PAYROLL', relationship: 'Approved leave creates absence days, balance movement, and payroll impact.', businessUse: 'Connects leave behavior to payroll cost and staffing risk.', grain: 'Absence request to worker-day and payroll period', joinKeys: ['workerId', 'absenceRequestId', 'payPeriod'], privacyLevel: 'sensitive', lineage: ['Leave request', 'Approval workflow', 'Attendance absence', 'Payroll input'], recommendedDrilldowns: ['Leave type', 'Request status', 'Department', 'Employee'] },
  { code: 'benefits-payroll', title: 'Benefits to Payroll', from: 'BENEFITS', to: 'PAYROLL', relationship: 'Benefits enrollment and dependents feed employee and employer contribution components.', businessUse: 'Validates payslip benefit deductions and carrier reconciliation.', grain: 'Enrollment coverage to payroll component', joinKeys: ['workerId', 'benefitsEnrollmentId', 'payPeriod'], privacyLevel: 'restricted', lineage: ['Benefits enrollment', 'Contribution policy', 'Payroll deduction'], recommendedDrilldowns: ['Program', 'Coverage level', 'Legal entity', 'Employee'] },
  { code: 'performance-learning', title: 'Performance to Skills', from: 'PERFORMANCE', to: 'LEARNING', relationship: 'Review outcomes and goals identify training, certification, and skill gaps.', businessUse: 'Links 360 performance findings to learning actions.', grain: 'Worker-cycle to learning plan', joinKeys: ['workerId', 'reviewCycleId', 'skillCode'], privacyLevel: 'sensitive', lineage: ['Performance cycle', 'Goal result', 'Skill gap', 'Learning assignment'], recommendedDrilldowns: ['Manager', 'Cycle', 'Skill', 'Employee'] },
  { code: 'engagement-retention', title: 'Engagement to Retention Risk', from: 'ENGAGEMENT', to: 'RETENTION', relationship: 'Engagement participation and sentiment influence retention risk hotspots.', businessUse: 'Prioritizes manager action for teams with morale and attrition risk.', grain: 'Survey cohort to retention segment', joinKeys: ['departmentId', 'managerWorkerId', 'period'], privacyLevel: 'restricted', lineage: ['Engagement survey', 'Sentiment result', 'Retention risk model'], recommendedDrilldowns: ['Department', 'Manager', 'Tenure band', 'Risk band'] },
  { code: 'recruitment-onboarding-headcount', title: 'Recruitment to Headcount', from: 'RECRUITMENT', to: 'ONBOARDING', relationship: 'Hiring pipeline creates onboarding workload and future headcount movement.', businessUse: 'Shows whether hiring plans translate into productive employees.', grain: 'Candidate to onboarding plan and position', joinKeys: ['candidateId', 'positionId', 'workerId'], privacyLevel: 'standard', lineage: ['Requisition', 'Offer', 'Onboarding plan', 'Worker assignment'], recommendedDrilldowns: ['Position', 'Department', 'Hiring stage', 'Start date'] },
  { code: 'compliance-access-audit', title: 'Compliance and Access Governance', from: 'COMPLIANCE', to: 'ACCESS', relationship: 'Policy acknowledgements, access reviews, and audit evidence share governance controls.', businessUse: 'Builds audit-ready reports across HR compliance and security governance.', grain: 'Worker-policy to access grant/review', joinKeys: ['workerId', 'policyDocumentId', 'accessGrantId'], privacyLevel: 'restricted', lineage: ['Policy document', 'Acknowledgement', 'Access review', 'Audit evidence'], recommendedDrilldowns: ['Policy', 'Role', 'Reviewer', 'Employee'] },
  { code: 'services-engagement', title: 'HR Services to Engagement', from: 'SERVICES', to: 'ENGAGEMENT', relationship: 'HR case volume, SLA risk, and service demand can explain employee sentiment pressure.', businessUse: 'Identifies operational friction affecting employee experience.', grain: 'Case demand to survey cohort', joinKeys: ['workerId', 'departmentId', 'period'], privacyLevel: 'sensitive', lineage: ['HR case', 'SLA state', 'Engagement survey'], recommendedDrilldowns: ['Service', 'Department', 'Case status', 'Manager'] },
];

const SMART_ANALYTICS_CATEGORIES: SmartAnalyticsCategory[] = [
  {
    code: 'WORKFORCE_COMPOSITION',
    title: 'Workforce Composition',
    group: 'People',
    description: 'Understand workforce mix by gender, age, nationality, employee type, tenure, grade, job family, and status.',
    businessQuestions: ['How is our workforce distributed?', 'Where are new hires and exits changing the shape of the company?', 'Which employee groups need closer governance?'],
    dataSources: ['HEADCOUNT', 'RETENTION'],
    reportCodes: ['headcount-movement-summary', 'retention-risk-hotspots'],
    drilldowns: ['Legal entity', 'Country', 'Location', 'Department', 'Manager', 'Employee type', 'Tenure band', 'Gender'],
    insights: [
      {
        code: 'gender-distribution',
        title: 'Gender Distribution',
        question: 'Is workforce representation balanced across entities and departments?',
        metricLabel: 'Female representation',
        metricValue: '45%',
        trend: '+2 pts vs last quarter',
        tone: 'success',
        explanation: 'Representation improved in Product and Finance, while Engineering remains below the company target.',
        dataSources: ['HEADCOUNT'],
        relatedReports: ['headcount-movement-summary'],
        chart: [{ label: 'Female', value: 112 }, { label: 'Male', value: 128 }, { label: 'Undisclosed', value: 8 }],
        affectedRecords: [{ label: 'Engineering', value: '34% female representation', severity: 'watch' }, { label: 'Finance', value: '52% female representation', severity: 'safe' }],
        actions: ['Open department drilldown', 'Schedule diversity dashboard', 'Export workforce composition evidence'],
      },
      {
        code: 'tenure-risk',
        title: 'Tenure and Status Mix',
        question: 'Which groups show movement or retention pressure?',
        metricLabel: 'High-risk employees',
        metricValue: 18,
        trend: '+4 in 90 days',
        tone: 'warning',
        explanation: 'Medium-tenure employees in Sales and Engineering show elevated risk signals when combined with service cases and performance delays.',
        dataSources: ['HEADCOUNT', 'RETENTION', 'SERVICES'],
        relatedReports: ['headcount-movement-summary', 'retention-risk-hotspots'],
        chart: [{ label: '0-1 years', value: 48 }, { label: '1-3 years', value: 96 }, { label: '3-5 years', value: 64 }, { label: '5+ years', value: 40 }],
        affectedRecords: [{ label: 'Sales', value: '7 high-risk employees', severity: 'risk' }, { label: 'Engineering', value: '6 high-risk employees', severity: 'watch' }],
        actions: ['Notify HRBP owner', 'Open retention risk report', 'Create manager follow-up task'],
      },
    ],
  },
  {
    code: 'ORG_LOCATION',
    title: 'Organization & Location',
    group: 'People',
    description: 'Analyze location distribution, legal entity, branch, department, manager span, and remote/hybrid/on-site work.',
    businessQuestions: ['Where do people work?', 'Which managers have span risk?', 'Which locations carry attendance or payroll pressure?'],
    dataSources: ['HEADCOUNT', 'ATTENDANCE', 'PAYROLL'],
    reportCodes: ['headcount-movement-summary', 'attendance-exceptions-monthly', 'payroll-cost-summary'],
    drilldowns: ['Legal entity', 'Country', 'Branch', 'Location', 'Department', 'Manager', 'Work type'],
    insights: [
      {
        code: 'location-distribution',
        title: 'Location Distribution',
        question: 'Which branches and work types carry the largest workforce concentration?',
        metricLabel: 'Largest location',
        metricValue: 'Cairo HQ',
        trend: '42% of workforce',
        tone: 'default',
        explanation: 'Cairo HQ has the largest concentration and also carries the highest attendance exception volume.',
        dataSources: ['HEADCOUNT', 'ATTENDANCE'],
        relatedReports: ['headcount-movement-summary', 'attendance-exceptions-monthly'],
        chart: [{ label: 'Cairo HQ', value: 104 }, { label: 'Dubai', value: 54 }, { label: 'Remote', value: 42 }, { label: 'Alexandria', value: 28 }],
        affectedRecords: [{ label: 'Cairo HQ', value: '104 employees, 18 attendance exceptions', severity: 'watch' }],
        actions: ['Open location drilldown', 'Run attendance risk by location', 'Review geofence policy'],
      },
      {
        code: 'manager-span',
        title: 'Manager Span',
        question: 'Which reporting lines are overloaded or under-supported?',
        metricLabel: 'Span alerts',
        metricValue: 5,
        trend: '+1 this month',
        tone: 'warning',
        explanation: 'Five managers exceed recommended span, which correlates with delayed approvals and service requests.',
        dataSources: ['HEADCOUNT', 'SERVICES', 'LEAVE'],
        relatedReports: ['headcount-movement-summary', 'hr-services-sla-demand', 'leave-liability'],
        chart: [{ label: '0-5', value: 18 }, { label: '6-10', value: 12 }, { label: '11-15', value: 5 }, { label: '15+', value: 2 }],
        affectedRecords: [{ label: 'Sales Manager Team', value: '17 direct reports', severity: 'risk' }],
        actions: ['Open manager drilldown', 'Create org review task', 'Export span-of-control report'],
      },
    ],
  },
  {
    code: 'ATTENDANCE_BEHAVIOR',
    title: 'Attendance Behavior',
    group: 'Workforce',
    description: 'Track lateness, absence frequency, missed punches, overtime, geofence exceptions, and payroll impact.',
    businessQuestions: ['Which teams have punctuality risk?', 'Are overtime and fatigue increasing?', 'Which attendance exceptions affect payroll?'],
    dataSources: ['ATTENDANCE', 'PAYROLL', 'HEADCOUNT'],
    reportCodes: ['attendance-exceptions-monthly', 'payroll-cost-summary', 'headcount-movement-summary'],
    drilldowns: ['Period', 'Department', 'Manager', 'Employee', 'Attendance status', 'Policy code', 'Location'],
    insights: [
      {
        code: 'late-arrival-pattern',
        title: 'Late Arrival Pattern',
        question: 'Where is lateness concentrated and recurring?',
        metricLabel: 'Late minutes',
        metricValue: 420,
        trend: '+11% vs previous month',
        tone: 'warning',
        explanation: 'Lateness is concentrated in two departments and is now affecting payroll deduction previews.',
        dataSources: ['ATTENDANCE', 'PAYROLL'],
        relatedReports: ['attendance-exceptions-monthly', 'payroll-cost-summary'],
        chart: [{ label: 'Engineering', value: 180 }, { label: 'Sales', value: 132 }, { label: 'Finance', value: 58 }, { label: 'HR', value: 50 }],
        affectedRecords: [{ label: 'Engineering', value: '180 late minutes', severity: 'risk' }, { label: 'Sales', value: '132 late minutes', severity: 'watch' }],
        actions: ['Notify managers', 'Open payroll deduction impact', 'Review attendance grace-period policy'],
      },
      {
        code: 'overtime-fatigue',
        title: 'Overtime and Fatigue',
        question: 'Which teams are approaching unsafe or costly work patterns?',
        metricLabel: 'Overtime hours',
        metricValue: 196,
        trend: '+24h in 30 days',
        tone: 'warning',
        explanation: 'Overtime is rising in teams with open vacancies and active service cases.',
        dataSources: ['ATTENDANCE', 'HEADCOUNT', 'SERVICES'],
        relatedReports: ['attendance-exceptions-monthly', 'headcount-movement-summary', 'hr-services-sla-demand'],
        chart: [{ label: 'Week 1', value: 42 }, { label: 'Week 2', value: 49 }, { label: 'Week 3', value: 51 }, { label: 'Week 4', value: 54 }],
        affectedRecords: [{ label: 'Support Operations', value: '54 hours last week', severity: 'risk' }],
        actions: ['Open coverage planning', 'Review overtime policy', 'Create hiring demand report'],
      },
    ],
  },
  {
    code: 'LEAVE_BEHAVIOR',
    title: 'Leave Behavior',
    group: 'Workforce',
    description: 'Analyze leave usage, sick leave patterns, permissions, balance liability, blackout pressure, and policy exceptions.',
    businessQuestions: ['Which teams have abnormal leave behavior?', 'What leave liability should payroll and finance know?', 'Are permission limits being exceeded?'],
    dataSources: ['LEAVE', 'ATTENDANCE', 'PAYROLL'],
    reportCodes: ['leave-liability', 'attendance-exceptions-monthly', 'payroll-cost-summary'],
    drilldowns: ['Leave type', 'Department', 'Manager', 'Employee', 'Approval status', 'Payroll impact'],
    insights: [
      {
        code: 'leave-liability-pressure',
        title: 'Leave Liability Pressure',
        question: 'Where is unused leave building financial exposure?',
        metricLabel: 'Balance liability',
        metricValue: 'EGP 138,000',
        trend: '+7% vs last month',
        tone: 'warning',
        explanation: 'Annual leave balances are accumulating in departments with high project load.',
        dataSources: ['LEAVE', 'PAYROLL'],
        relatedReports: ['leave-liability', 'payroll-cost-summary'],
        chart: [{ label: 'Engineering', value: 42000 }, { label: 'Sales', value: 31000 }, { label: 'Finance', value: 22000 }, { label: 'HR', value: 12000 }],
        affectedRecords: [{ label: 'Engineering', value: 'EGP 42,000 liability', severity: 'risk' }],
        actions: ['Notify department heads', 'Schedule leave planning report', 'Open encashment policy'],
      },
      {
        code: 'permission-frequency',
        title: 'Permission Frequency',
        question: 'Are short permissions exceeding weekly or monthly policy limits?',
        metricLabel: 'Policy exceptions',
        metricValue: 9,
        trend: '+3 this month',
        tone: 'warning',
        explanation: 'Permission use is clustered around two teams and should be checked against monthly limits.',
        dataSources: ['LEAVE', 'ATTENDANCE'],
        relatedReports: ['leave-liability', 'attendance-exceptions-monthly'],
        chart: [{ label: 'Week 1', value: 6 }, { label: 'Week 2', value: 8 }, { label: 'Week 3', value: 11 }, { label: 'Week 4', value: 9 }],
        affectedRecords: [{ label: 'Sales Team A', value: '4 employees above monthly threshold', severity: 'risk' }],
        actions: ['Open affected employees', 'Review permission policy', 'Send manager notification'],
      },
    ],
  },
  {
    code: 'PAYROLL_COST',
    title: 'Payroll, Cost & Deductions',
    group: 'Reward',
    description: 'Explain payroll movement, salary composition, tax, insurance, deductions, GL preview, and close blockers.',
    businessQuestions: ['Why did payroll cost change?', 'Which deductions and taxes moved net pay?', 'What blocks payroll close?'],
    dataSources: ['PAYROLL', 'ATTENDANCE', 'LEAVE', 'BENEFITS'],
    reportCodes: ['payroll-cost-summary', 'attendance-exceptions-monthly', 'leave-liability', 'benefits-open-enrollment'],
    drilldowns: ['Legal entity', 'Department', 'Pay period', 'Payroll status', 'Component', 'Employee'],
    insights: [
      {
        code: 'gross-to-net-bridge',
        title: 'Gross-to-Net Bridge',
        question: 'Which payroll components explain net pay movement?',
        metricLabel: 'Net pay',
        metricValue: 'EGP 210,000',
        trend: '+4.6% vs previous period',
        tone: 'default',
        explanation: 'Net pay increased due to headcount movement and allowance changes; deductions partially offset the movement.',
        dataSources: ['PAYROLL', 'HEADCOUNT'],
        relatedReports: ['payroll-cost-summary', 'headcount-movement-summary'],
        chart: [{ label: 'Gross', value: 250000 }, { label: 'Tax', value: 38000 }, { label: 'Insurance', value: 12000 }, { label: 'Net', value: 210000 }],
        affectedRecords: [{ label: 'June cycle', value: '1 close blocker', severity: 'watch' }],
        actions: ['Open payroll preview', 'Export GL preview', 'Review close blockers'],
      },
      {
        code: 'deduction-impact',
        title: 'Deduction Impact',
        question: 'Which attendance, benefit, or statutory deductions affect payslips?',
        metricLabel: 'Deduction total',
        metricValue: 'EGP 32,000',
        trend: '+9% vs previous month',
        tone: 'warning',
        explanation: 'Attendance deductions increased with late arrivals, while benefit contributions stayed stable.',
        dataSources: ['PAYROLL', 'ATTENDANCE', 'BENEFITS'],
        relatedReports: ['payroll-cost-summary', 'attendance-exceptions-monthly', 'benefits-open-enrollment'],
        chart: [{ label: 'Attendance', value: 9000 }, { label: 'Benefits', value: 12000 }, { label: 'Tax', value: 11000 }],
        affectedRecords: [{ label: 'Engineering', value: 'EGP 4,200 attendance deductions', severity: 'watch' }],
        actions: ['Open payslip components', 'Review deduction policy', 'Notify payroll owner'],
      },
    ],
  },
  {
    code: 'BENEFITS_ANALYTICS',
    title: 'Benefits',
    group: 'Reward',
    description: 'Analyze eligibility, enrollment windows, life events, dependents, contributions, carrier reconciliation, and payroll bridge.',
    businessQuestions: ['Who is eligible but not enrolled?', 'How do benefit choices affect payroll?', 'Are carrier files reconciled?'],
    dataSources: ['BENEFITS', 'PAYROLL', 'HEADCOUNT'],
    reportCodes: ['benefits-open-enrollment', 'payroll-cost-summary', 'headcount-movement-summary'],
    drilldowns: ['Program', 'Coverage level', 'Enrollment status', 'Department', 'Employee type'],
    insights: [
      {
        code: 'open-enrollment-risk',
        title: 'Open Enrollment Risk',
        question: 'Which employees have not completed enrollment?',
        metricLabel: 'Pending enrollments',
        metricValue: 23,
        trend: '-8 since reminder',
        tone: 'warning',
        explanation: 'Pending enrollments are concentrated among new hires and remote employees.',
        dataSources: ['BENEFITS', 'ONBOARDING'],
        relatedReports: ['benefits-open-enrollment', 'onboarding-probation-readiness'],
        chart: [{ label: 'Enrolled', value: 186 }, { label: 'Pending', value: 23 }, { label: 'Waived', value: 14 }],
        affectedRecords: [{ label: 'Remote employees', value: '9 pending enrollments', severity: 'watch' }],
        actions: ['Send enrollment reminder', 'Open carrier reconciliation', 'Schedule benefits report'],
      },
      {
        code: 'benefit-contribution-bridge',
        title: 'Contribution Bridge',
        question: 'Are employee and employer benefit costs aligned with payroll?',
        metricLabel: 'Employee contribution',
        metricValue: 'EGP 18,400',
        trend: '+3.2% vs last period',
        tone: 'default',
        explanation: 'Contribution movement follows family coverage changes and life events.',
        dataSources: ['BENEFITS', 'PAYROLL'],
        relatedReports: ['benefits-open-enrollment', 'payroll-cost-summary'],
        chart: [{ label: 'Medical', value: 12600 }, { label: 'Dental', value: 3200 }, { label: 'Life', value: 2600 }],
        affectedRecords: [{ label: 'Life events', value: '4 approved changes', severity: 'safe' }],
        actions: ['Open payroll bridge', 'Export carrier file status', 'Review contribution policy'],
      },
    ],
  },
  {
    code: 'TALENT_PERFORMANCE',
    title: 'Performance & 360',
    group: 'Talent',
    description: 'Review readiness, feedback completion, rating distribution, goals, skills, and employee profile impact.',
    businessQuestions: ['Which teams are behind in reviews?', 'Where is 360 feedback below anonymity threshold?', 'Which skills need action?'],
    dataSources: ['PERFORMANCE', 'LEARNING', 'HEADCOUNT'],
    reportCodes: ['performance-360-readiness', 'learning-skills-gap', 'headcount-movement-summary'],
    drilldowns: ['Cycle', 'Manager', 'Department', 'Review status', 'Skill', 'Employee'],
    insights: [
      {
        code: 'review-readiness',
        title: 'Review Readiness',
        question: 'Which review cycles need manager action?',
        metricLabel: 'Overdue reviews',
        metricValue: 8,
        trend: '-3 after reminders',
        tone: 'warning',
        explanation: 'Overdue reviews are concentrated in manager teams with high service demand.',
        dataSources: ['PERFORMANCE', 'SERVICES'],
        relatedReports: ['performance-360-readiness', 'hr-services-sla-demand'],
        chart: [{ label: 'Completed', value: 140 }, { label: 'In progress', value: 42 }, { label: 'Overdue', value: 8 }],
        affectedRecords: [{ label: 'Sales manager team', value: '4 overdue reviews', severity: 'risk' }],
        actions: ['Notify managers', 'Open 360 readiness', 'Create calibration task'],
      },
      {
        code: 'skills-profile-impact',
        title: 'Skills and Profile Impact',
        question: 'Which performance findings should update development plans?',
        metricLabel: 'Skills gaps',
        metricValue: 14,
        trend: '+2 critical skills',
        tone: 'warning',
        explanation: 'Cloud and data skills gaps align with lower goal progress in two departments.',
        dataSources: ['PERFORMANCE', 'LEARNING'],
        relatedReports: ['learning-skills-gap', 'performance-360-readiness'],
        chart: [{ label: 'Cloud', value: 6 }, { label: 'Data', value: 4 }, { label: 'Leadership', value: 3 }, { label: 'Compliance', value: 1 }],
        affectedRecords: [{ label: 'Engineering', value: '6 cloud skill gaps', severity: 'watch' }],
        actions: ['Create learning campaign', 'Open employee profile impact', 'Export skills gap report'],
      },
    ],
  },
  {
    code: 'EMPLOYEE_EXPERIENCE',
    title: 'Engagement & Sentiment',
    group: 'Employee Experience',
    description: 'Connect survey sentiment, recognition, HR service demand, and attrition risk signals.',
    businessQuestions: ['Which teams show engagement risk?', 'Are service issues affecting employee sentiment?', 'Where should HR intervene first?'],
    dataSources: ['ENGAGEMENT', 'SERVICES', 'RETENTION'],
    reportCodes: ['engagement-sentiment-risk', 'hr-services-sla-demand', 'retention-risk-hotspots'],
    drilldowns: ['Department', 'Manager', 'Engagement band', 'Case status', 'Risk band'],
    insights: [
      {
        code: 'engagement-band-risk',
        title: 'Engagement Band Risk',
        question: 'Which teams have low engagement and rising risk?',
        metricLabel: 'Low engagement teams',
        metricValue: 3,
        trend: '+1 this quarter',
        tone: 'warning',
        explanation: 'Low engagement aligns with higher HR service case demand and retention risk.',
        dataSources: ['ENGAGEMENT', 'SERVICES', 'RETENTION'],
        relatedReports: ['engagement-sentiment-risk', 'hr-services-sla-demand', 'retention-risk-hotspots'],
        chart: [{ label: 'High', value: 9 }, { label: 'Medium', value: 12 }, { label: 'Low', value: 3 }],
        affectedRecords: [{ label: 'Customer Support', value: 'Low engagement, 8 SLA-risk cases', severity: 'risk' }],
        actions: ['Create HRBP action plan', 'Notify manager', 'Schedule engagement dashboard'],
      },
      {
        code: 'service-friction',
        title: 'Service Friction',
        question: 'Which service issues are creating employee friction?',
        metricLabel: 'SLA-risk cases',
        metricValue: 8,
        trend: '+2 this week',
        tone: 'warning',
        explanation: 'Benefits and payroll service cases are the strongest contributors to employee sentiment pressure.',
        dataSources: ['SERVICES', 'ENGAGEMENT', 'PAYROLL', 'BENEFITS'],
        relatedReports: ['hr-services-sla-demand', 'engagement-sentiment-risk', 'payroll-cost-summary', 'benefits-open-enrollment'],
        chart: [{ label: 'Payroll', value: 4 }, { label: 'Benefits', value: 3 }, { label: 'Leave', value: 1 }],
        affectedRecords: [{ label: 'Benefits cases', value: '3 at SLA risk', severity: 'watch' }],
        actions: ['Reassign SLA-risk cases', 'Notify service owner', 'Open sentiment drilldown'],
      },
    ],
  },
  {
    code: 'TALENT_ACQUISITION',
    title: 'Recruitment & Onboarding',
    group: 'Talent Acquisition',
    description: 'Analyze hiring funnel, headcount demand, joining readiness, onboarding tasks, and probation progress.',
    businessQuestions: ['Are open roles moving fast enough?', 'Are new hires productive on time?', 'Where are onboarding blockers?'],
    dataSources: ['RECRUITMENT', 'ONBOARDING', 'HEADCOUNT'],
    reportCodes: ['recruitment-funnel-health', 'onboarding-probation-readiness', 'headcount-movement-summary'],
    drilldowns: ['Requisition', 'Department', 'Candidate stage', 'Joining date', 'Onboarding status', 'Probation status'],
    insights: [
      {
        code: 'funnel-health',
        title: 'Recruitment Funnel Health',
        question: 'Which roles and stages slow hiring demand?',
        metricLabel: 'Open requisitions',
        metricValue: 14,
        trend: '+3 this month',
        tone: 'warning',
        explanation: 'Interview stage delays are extending time-to-fill for critical roles.',
        dataSources: ['RECRUITMENT', 'HEADCOUNT'],
        relatedReports: ['recruitment-funnel-health', 'headcount-movement-summary'],
        chart: [{ label: 'Screening', value: 28 }, { label: 'Interview', value: 18 }, { label: 'Offer', value: 6 }, { label: 'Hired', value: 4 }],
        affectedRecords: [{ label: 'Engineering roles', value: '6 open requisitions', severity: 'watch' }],
        actions: ['Open hiring funnel', 'Notify recruiter owner', 'Create headcount risk report'],
      },
      {
        code: 'onboarding-blockers',
        title: 'Onboarding Blockers',
        question: 'Which new hires are blocked before productivity?',
        metricLabel: 'Pending tasks',
        metricValue: 21,
        trend: '-5 since last week',
        tone: 'warning',
        explanation: 'IT provisioning and manager check-ins are the most common onboarding blockers.',
        dataSources: ['ONBOARDING', 'SERVICES'],
        relatedReports: ['onboarding-probation-readiness', 'hr-services-sla-demand'],
        chart: [{ label: 'HR', value: 5 }, { label: 'IT', value: 9 }, { label: 'Manager', value: 7 }],
        affectedRecords: [{ label: 'New hire cohort', value: '6 at-risk onboarding plans', severity: 'risk' }],
        actions: ['Open task checklist', 'Notify task owners', 'Schedule onboarding report'],
      },
    ],
  },
  {
    code: 'GOVERNANCE_COMPLIANCE',
    title: 'Compliance, Access & Audit',
    group: 'Governance',
    description: 'Track policy acknowledgements, statutory evidence, document expiry, access reviews, SoD, and audit exceptions.',
    businessQuestions: ['Which compliance actions are overdue?', 'Which access grants need certification?', 'Can we export audit evidence?'],
    dataSources: ['COMPLIANCE', 'ACCESS', 'SERVICES'],
    reportCodes: ['compliance-acknowledgement-risk', 'access-certification-risk', 'hr-services-sla-demand'],
    drilldowns: ['Policy', 'Document type', 'Acknowledgement status', 'Role', 'Review status', 'Owner team'],
    insights: [
      {
        code: 'acknowledgement-risk',
        title: 'Acknowledgement Risk',
        question: 'Which policies or documents are overdue?',
        metricLabel: 'Overdue acknowledgements',
        metricValue: 14,
        trend: '+4 this week',
        tone: 'warning',
        explanation: 'Overdue acknowledgements are concentrated in two departments after policy publish.',
        dataSources: ['COMPLIANCE', 'HEADCOUNT'],
        relatedReports: ['compliance-acknowledgement-risk', 'headcount-movement-summary'],
        chart: [{ label: 'Acknowledged', value: 312 }, { label: 'Pending', value: 52 }, { label: 'Overdue', value: 14 }],
        affectedRecords: [{ label: 'Sales', value: '8 overdue acknowledgements', severity: 'risk' }],
        actions: ['Send reminders', 'Open evidence export', 'Escalate overdue owners'],
      },
      {
        code: 'access-review-risk',
        title: 'Access Review Risk',
        question: 'Which access items need certification or revocation?',
        metricLabel: 'Overdue reviews',
        metricValue: 6,
        trend: '+2 in 30 days',
        tone: 'warning',
        explanation: 'Privileged access and service account reviews need reviewer follow-up.',
        dataSources: ['ACCESS', 'COMPLIANCE'],
        relatedReports: ['access-certification-risk', 'compliance-acknowledgement-risk'],
        chart: [{ label: 'Certified', value: 84 }, { label: 'Pending', value: 18 }, { label: 'Overdue', value: 6 }],
        affectedRecords: [{ label: 'Service accounts', value: '2 expiring credentials', severity: 'watch' }],
        actions: ['Open access review', 'Notify reviewers', 'Export audit packet'],
      },
    ],
  },
];

const REPORTING_SAMPLE_VOLUME: Record<string, number> = {
  HEADCOUNT: 248,
  ATTENDANCE: 7420,
  LEAVE: 312,
  PAYROLL: 248,
  PERFORMANCE: 510,
  BENEFITS: 232,
  COMPLIANCE: 420,
  SERVICES: 180,
  ENGAGEMENT: 248,
  LEARNING: 530,
  RECRUITMENT: 96,
  ONBOARDING: 64,
  ACCESS: 320,
  RETENTION: 248,
};

const REPORTING_PREVIEW_SERIES: Record<string, Array<{ label: string; value: number; secondaryValue?: number }>> = {
  HEADCOUNT: [
    { label: 'Engineering', value: 65 },
    { label: 'Sales', value: 43 },
    { label: 'Finance', value: 25 },
    { label: 'Product', value: 20 },
  ],
  ATTENDANCE: [
    { label: 'Present', value: 1840 },
    { label: 'Late', value: 72 },
    { label: 'On leave', value: 116 },
    { label: 'Exception', value: 28 },
  ],
  LEAVE: [
    { label: 'Approved', value: 124 },
    { label: 'Pending', value: 18 },
    { label: 'Rejected', value: 6 },
  ],
  PAYROLL: [
    { label: 'Gross', value: 250000, secondaryValue: 248 },
    { label: 'Tax', value: 38000, secondaryValue: 248 },
    { label: 'Insurance', value: 12000, secondaryValue: 248 },
    { label: 'Net', value: 198000, secondaryValue: 248 },
  ],
  PERFORMANCE: [
    { label: 'Completed', value: 140 },
    { label: 'In progress', value: 42 },
    { label: 'Overdue', value: 8 },
  ],
  BENEFITS: [
    { label: 'Employee only', value: 85 },
    { label: 'Family', value: 98 },
    { label: 'Waived', value: 14 },
  ],
  COMPLIANCE: [
    { label: 'Acknowledged', value: 312 },
    { label: 'Pending', value: 52 },
    { label: 'Overdue', value: 14 },
  ],
  SERVICES: [
    { label: 'Open', value: 34 },
    { label: 'In progress', value: 21 },
    { label: 'Resolved', value: 125 },
    { label: 'SLA risk', value: 8 },
  ],
  ENGAGEMENT: [
    { label: 'High', value: 96 },
    { label: 'Medium', value: 118 },
    { label: 'Low', value: 34 },
  ],
  LEARNING: [
    { label: 'Completed', value: 410 },
    { label: 'In progress', value: 82 },
    { label: 'Overdue', value: 38 },
  ],
  RECRUITMENT: [
    { label: 'Screening', value: 28 },
    { label: 'Interview', value: 18 },
    { label: 'Offer', value: 6 },
    { label: 'Hired', value: 4 },
  ],
  ONBOARDING: [
    { label: 'Completed', value: 38 },
    { label: 'In progress', value: 18 },
    { label: 'At risk', value: 8 },
  ],
  ACCESS: [
    { label: 'Certified', value: 84 },
    { label: 'Pending', value: 18 },
    { label: 'Overdue', value: 6 },
    { label: 'Revoke', value: 3 },
  ],
  RETENTION: [
    { label: 'Low risk', value: 196 },
    { label: 'Medium risk', value: 34 },
    { label: 'High risk', value: 18 },
  ],
};
