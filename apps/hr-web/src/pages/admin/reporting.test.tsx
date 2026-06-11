import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminReporting } from './reporting';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: '00000000-0000-0000-0000-000000000777',
      email: 'hr.admin@example.com',
      firstName: 'HR',
      lastName: 'Admin',
      roles: [],
      permissions: [],
      tenantId: '00000000-0000-0000-0000-000000000001',
    },
  }),
}));

vi.mock('recharts', () => ({
  Bar: () => null,
  BarChart: ({ children }: { children?: ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  CartesianGrid: () => null,
  Cell: () => null,
  Pie: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children?: ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const dashboard = {
  generatedAt: '2026-06-10T09:00:00.000Z',
  totals: {
    reportGroups: 1,
    activeReportGroups: 1,
    totalActivity: 10,
    queueBacklog: 0,
    issues: 0,
  },
  reports: [
    {
      code: 'ATTENDANCE',
      title: 'Attendance Report',
      category: 'Workforce',
      services: ['TIME_ATTENDANCE'],
      analyticsOutputs: ['employeeDays', 'exceptionSignals'],
      serviceUsageLinks: ['TIME_ATTENDANCE'],
      template: {
        module: 'attendance',
        columns: ['externalReference', 'employeeNumber', 'attendanceDate', 'policyCode'],
        exportArtifact: 'attendance-ledger.csv',
      },
      brain: {
        engine: 'attendance-finalization',
        nervousSystem: 'Time events feed reporting.',
      },
      activity: 10,
      commands: 4,
      events: 4,
      notifications: 1,
      workflowTransitions: 1,
      queueBacklog: 0,
      issues: 0,
      readiness: 'Live',
      chartData: [{ label: 'Commands', value: 4 }],
    },
    {
      code: 'HEADCOUNT_ORG',
      title: 'Headcount and Org Report',
      category: 'Organization',
      services: ['ORGANIZATION', 'HR_CORE'],
      analyticsOutputs: ['positions', 'filledPositions', 'vacantPositions', 'headcountRequests'],
      serviceUsageLinks: ['ORGANIZATION', 'HR_CORE'],
      template: {
        module: 'headcount-org',
        columns: ['positionCode', 'title', 'departmentCode', 'legalEntityCode'],
        exportArtifact: 'headcount-org.csv',
      },
      brain: {
        engine: 'position-headcount',
        nervousSystem: 'Position and headcount events feed org reporting.',
      },
      activity: 0,
      commands: 0,
      events: 0,
      notifications: 0,
      workflowTransitions: 0,
      queueBacklog: 0,
      issues: 0,
      readiness: 'No Data',
      chartData: [],
    },
  ],
  activityByReport: [{ label: 'Attendance Report', activity: 10, issues: 0 }],
};

const analytics = {
  generatedAt: '2026-06-10T09:00:00.000Z',
  totals: {
    activeModules: 5,
    riskSignals: 11,
    attendanceEmployeeDays: 20,
    leaveRequests: 6,
    payrollNetPay: 210000,
    performanceReviews: 10,
    benefitsEnrollments: 15,
    headcountPositions: 10,
    complianceAcknowledgements: 16,
    serviceCases: 12,
  },
  headlineMetrics: [
    { label: 'Analytics Modules', value: 8 },
    { label: 'Risk Signals', value: 26 },
    { label: 'Payroll Net Pay', value: 210000, unit: 'currency', currency: 'EGP' },
    { label: 'Service Cases', value: 12 },
  ],
  modules: [
    {
      code: 'ATTENDANCE',
      title: 'Attendance Exceptions',
      category: 'Workforce',
      primary: { label: 'Employee days', value: 20, unit: 'days' },
      secondary: { label: 'Overtime hours', value: 2, unit: 'hours' },
      risk: { label: 'Exception signals', value: 3 },
      chart: { type: 'bar', data: [{ label: 'Late', value: 2 }, { label: 'Present', value: 18 }] },
    },
    {
      code: 'LEAVE',
      title: 'Leave Pipeline',
      category: 'Workforce',
      primary: { label: 'Requests', value: 6 },
      secondary: { label: 'Requested days', value: 12, unit: 'days' },
      risk: { label: 'Open requests', value: 2 },
      chart: { type: 'bar', data: [{ label: 'Approved', value: 4 }, { label: 'Submitted', value: 2 }] },
    },
    {
      code: 'PAYROLL',
      title: 'Payroll Net Pay',
      category: 'Reward',
      primary: { label: 'Net pay', value: 210000, unit: 'currency', currency: 'EGP' },
      secondary: { label: 'Workers paid', value: 25 },
      risk: { label: 'Runs needing attention', value: 1 },
      chart: { type: 'bar', data: [{ label: 'EGP', value: 210000, secondaryValue: 250000 }] },
    },
    {
      code: 'PERFORMANCE',
      title: 'Performance Rating',
      category: 'Talent',
      primary: { label: 'Reviews', value: 10 },
      secondary: { label: 'Average rating', value: 4.06, unit: 'rating' },
      risk: { label: 'Open reviews', value: 2 },
      chart: { type: 'bar', data: [{ label: '4-5', value: 7 }, { label: '3-4', value: 3 }] },
    },
    {
      code: 'BENEFITS',
      title: 'Benefits Coverage',
      category: 'Reward',
      primary: { label: 'Enrollments', value: 15 },
      secondary: { label: 'Dependents covered', value: 24 },
      risk: { label: 'Pending enrollments', value: 3 },
      chart: { type: 'bar', data: [{ label: 'Employee Family', value: 12 }, { label: 'Employee Only', value: 3 }] },
    },
    {
      code: 'HEADCOUNT_ORG',
      title: 'Headcount and Org Coverage',
      category: 'Organization',
      primary: { label: 'Positions', value: 10 },
      secondary: { label: 'Filled positions', value: 7 },
      risk: { label: 'Vacancy and request signals', value: 7 },
      chart: { type: 'bar', data: [{ label: 'Open', value: 10, secondaryValue: 4 }] },
    },
    {
      code: 'COMPLIANCE',
      title: 'Compliance Evidence',
      category: 'Governance',
      primary: { label: 'Acknowledgements', value: 16 },
      secondary: { label: 'Statutory reports', value: 4 },
      risk: { label: 'Overdue and draft signals', value: 3 },
      chart: { type: 'bar', data: [{ label: 'Ack Pending', value: 6 }, { label: 'Report Draft', value: 1 }] },
    },
    {
      code: 'SERVICES',
      title: 'HR Services Demand',
      category: 'Service Delivery',
      primary: { label: 'Cases', value: 12 },
      secondary: { label: 'Active catalog items', value: 6 },
      risk: { label: 'SLA and task signals', value: 5 },
      chart: { type: 'bar', data: [{ label: 'Open', value: 5, secondaryValue: 4 }, { label: 'Resolved', value: 7 }] },
    },
  ],
  riskSignals: [
    { label: 'Attendance Exceptions', value: 3 },
    { label: 'Leave Pipeline', value: 2 },
    { label: 'Headcount and Org Coverage', value: 7 },
    { label: 'Compliance Evidence', value: 3 },
    { label: 'HR Services Demand', value: 5 },
  ],
};

const builderCatalog = {
  scopeLevels: [
    { code: 'TENANT', label: 'Whole Company', description: 'All records' },
    { code: 'DEPARTMENT', label: 'Department', description: 'Department records' },
    { code: 'MANAGER', label: 'Manager Team', description: 'Manager records' },
  ],
  populationOptions: [
    { scopeLevel: 'TENANT', label: 'Whole company', values: [{ code: 'ALL', label: 'All workers', description: 'All accessible records.' }] },
    { scopeLevel: 'DEPARTMENT', label: 'Department', values: [{ code: 'ENGINEERING', label: 'Engineering', description: 'Engineering department records.' }, { code: 'SALES', label: 'Sales' }] },
    { scopeLevel: 'MANAGER', label: 'Manager Team', values: [{ code: 'MGR_JAMES_HARRINGTON', label: 'James Harrington Team' }] },
  ],
  visualizationTypes: [
    { code: 'table', label: 'Table' },
    { code: 'bar', label: 'Bar chart' },
    { code: 'kpi', label: 'KPI cards' },
  ],
  dataSources: [
    {
      code: 'HEADCOUNT',
      title: 'Employee Headcount',
      category: 'People & Organization',
      scopeLevels: ['TENANT', 'DEPARTMENT'],
      defaultVisualization: 'bar',
      fields: [
        { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
        { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
        { code: 'department', label: 'Department', type: 'text', defaultSelected: true },
      ],
      metrics: [
        { code: 'headcount', label: 'Headcount', type: 'number' },
        { code: 'activeWorkers', label: 'Active workers', type: 'number' },
      ],
      groupBy: [
        { code: 'department', label: 'Department', type: 'text' },
      ],
      filters: [
        { code: 'period', label: 'Period', type: 'status', options: [{ code: 'CURRENT_MONTH', label: 'Current month' }, { code: 'LAST_90_DAYS', label: 'Last 90 days' }] },
        { code: 'department', label: 'Department', type: 'status', options: [{ code: 'ENGINEERING', label: 'Engineering' }, { code: 'SALES', label: 'Sales' }] },
      ],
    },
    {
      code: 'ATTENDANCE',
      title: 'Attendance & Time Ledger',
      category: 'Workforce',
      scopeLevels: ['TENANT', 'DEPARTMENT'],
      defaultVisualization: 'bar',
      fields: [
        { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
        { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
        { code: 'workDate', label: 'Work date', type: 'date', defaultSelected: true },
        { code: 'attendanceStatus', label: 'Attendance status', type: 'status', defaultSelected: true },
      ],
      metrics: [
        { code: 'lateMinutes', label: 'Late minutes', type: 'number' },
        { code: 'exceptions', label: 'Exceptions', type: 'number' },
      ],
      groupBy: [
        { code: 'department', label: 'Department', type: 'text' },
      ],
      filters: [
        { code: 'period', label: 'Period', type: 'status', options: [{ code: 'CURRENT_MONTH', label: 'Current month' }, { code: 'LAST_90_DAYS', label: 'Last 90 days' }] },
        { code: 'attendanceStatus', label: 'Attendance status', type: 'status', options: [{ code: 'PRESENT', label: 'Present' }, { code: 'LATE', label: 'Late' }, { code: 'EXCEPTION', label: 'Exception' }] },
      ],
    },
    {
      code: 'PAYROLL',
      title: 'Payroll & Payslips',
      category: 'Reward',
      scopeLevels: ['TENANT', 'DEPARTMENT'],
      defaultVisualization: 'kpi',
      fields: [
        { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
        { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
        { code: 'payPeriod', label: 'Pay period', type: 'text', defaultSelected: true },
      ],
      metrics: [
        { code: 'grossPay', label: 'Gross pay', type: 'currency' },
        { code: 'netPay', label: 'Net pay', type: 'currency' },
      ],
      groupBy: [
        { code: 'department', label: 'Department', type: 'text' },
      ],
      filters: [
        { code: 'period', label: 'Period', type: 'status', options: [{ code: 'CURRENT_MONTH', label: 'Current month' }] },
      ],
    },
    {
      code: 'COMPLIANCE',
      title: 'Compliance & Acknowledgements',
      category: 'Governance',
      scopeLevels: ['TENANT', 'DEPARTMENT'],
      defaultVisualization: 'bar',
      fields: [
        { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
        { code: 'policyCode', label: 'Policy', type: 'text', defaultSelected: true },
        { code: 'acknowledgementStatus', label: 'Acknowledgement status', type: 'status', defaultSelected: true },
      ],
      metrics: [
        { code: 'acknowledgements', label: 'Acknowledgements', type: 'number' },
        { code: 'overdueAcknowledgements', label: 'Overdue acknowledgements', type: 'number' },
      ],
      groupBy: [
        { code: 'acknowledgementStatus', label: 'Acknowledgement status', type: 'status' },
      ],
      filters: [
        { code: 'period', label: 'Period', type: 'status', options: [{ code: 'CURRENT_MONTH', label: 'Current month' }] },
      ],
    },
  ],
  templates: [
    { code: 'attendance-exceptions-monthly', title: 'Monthly Attendance Exceptions', dataSource: 'ATTENDANCE', fields: ['employeeNumber', 'employeeName', 'workDate', 'attendanceStatus'], metrics: ['lateMinutes', 'exceptions'], groupBy: ['department'], scopeLevel: 'DEPARTMENT', visualization: 'bar', recommended: true, packCodes: ['FULL_HR_ANALYTICS', 'WORKFORCE_HEALTH'] },
    { code: 'payroll-cost-summary', title: 'Payroll Cost Summary', dataSource: 'PAYROLL', fields: ['employeeNumber', 'employeeName', 'payPeriod'], metrics: ['grossPay', 'netPay'], groupBy: ['department'], scopeLevel: 'DEPARTMENT', visualization: 'kpi', recommended: true, packCodes: ['FULL_HR_ANALYTICS', 'REWARD_CONTROL'] },
    { code: 'compliance-acknowledgement-risk', title: 'Compliance Acknowledgement Risk', dataSource: 'COMPLIANCE', fields: ['employeeNumber', 'policyCode', 'acknowledgementStatus'], metrics: ['acknowledgements', 'overdueAcknowledgements'], groupBy: ['acknowledgementStatus'], scopeLevel: 'TENANT', visualization: 'bar', recommended: true, packCodes: ['FULL_HR_ANALYTICS'] },
  ],
  analyticsPacks: [
    { code: 'FULL_HR_ANALYTICS', title: 'Full HR Analytics', category: 'Executive', description: 'Run the complete cross-module HR view.', reportCodes: ['attendance-exceptions-monthly', 'payroll-cost-summary', 'compliance-acknowledgement-risk'], dataSources: ['ATTENDANCE', 'PAYROLL', 'COMPLIANCE'], defaultScopeLevel: 'TENANT', defaultPeriod: 'CURRENT_MONTH', outputs: ['Executive scorecard', 'Risk signals'] },
    { code: 'WORKFORCE_HEALTH', title: 'Workforce Health', category: 'Workforce', description: 'Attendance and leave risk signals.', reportCodes: ['attendance-exceptions-monthly'], dataSources: ['HEADCOUNT', 'ATTENDANCE'], defaultScopeLevel: 'DEPARTMENT', defaultPeriod: 'LAST_90_DAYS', outputs: ['Attendance exceptions'] },
  ],
  smartCategories: [
    {
      code: 'WORKFORCE_COMPOSITION',
      title: 'Workforce Composition',
      group: 'People Intelligence',
      description: 'Understand active headcount, attendance pressure, and leave patterns.',
      businessQuestions: [
        'Where is workforce capacity under pressure?',
        'Which departments combine vacancy risk with attendance exceptions?',
        'What follow-up report should HR operations run next?',
      ],
      dataSources: ['HEADCOUNT', 'ATTENDANCE'],
      reportCodes: ['attendance-exceptions-monthly'],
      drilldowns: ['Department', 'Manager team', 'Employee'],
      insights: [
        {
          code: 'capacity-risk',
          title: 'Capacity Risk Hotspots',
          question: 'Which teams show capacity risk this month?',
          metricLabel: 'Risk signals',
          metricValue: 18,
          trend: '+4 vs prior period',
          tone: 'warning',
          explanation: 'Engineering has overlapping vacancy and attendance exception signals.',
          dataSources: ['HEADCOUNT', 'ATTENDANCE'],
          relatedReports: ['attendance-exceptions-monthly'],
          chart: [{ label: 'Engineering', value: 8 }, { label: 'Sales', value: 6 }],
          affectedRecords: [
            { label: 'Engineering', value: '7 vacancies with 18 attendance exceptions', severity: 'risk' },
            { label: 'Sales', value: '6 pending leave requests during coverage gap', severity: 'watch' },
          ],
          actions: ['Open workforce review', 'Notify HR operations'],
        },
      ],
    },
    {
      code: 'REWARD_ASSURANCE',
      title: 'Reward Assurance',
      group: 'Financial Control',
      description: 'Connect payroll cost and benefit contribution checks.',
      businessQuestions: ['Are payroll and benefit costs aligned to the current workforce?'],
      dataSources: ['PAYROLL'],
      reportCodes: ['payroll-cost-summary'],
      drilldowns: ['Legal entity', 'Department'],
      insights: [
        {
          code: 'payroll-close-control',
          title: 'Payroll Close Control',
          question: 'What needs attention before payroll closes?',
          metricLabel: 'Close blockers',
          metricValue: 3,
          trend: '-2 vs last run',
          tone: 'warning',
          explanation: 'Three records need deduction or attendance evidence review.',
          dataSources: ['PAYROLL', 'ATTENDANCE'],
          relatedReports: ['payroll-cost-summary'],
          chart: [{ label: 'Ready', value: 22 }, { label: 'Blocked', value: 3 }],
          affectedRecords: [{ label: 'Acme Corp USA', value: '2 deduction checks', severity: 'watch' }],
          actions: ['Review payroll blockers'],
        },
      ],
    },
  ],
  businessRelationships: [
    { code: 'headcount-attendance-capacity', title: 'Headcount to Attendance Capacity', from: 'HEADCOUNT', to: 'ATTENDANCE', relationship: 'Capacity and exception context', businessUse: 'Shows whether attendance exceptions are symptoms of vacancy and coverage pressure.', grain: 'Worker assignment to worker-day', joinKeys: ['workerId', 'departmentId'], privacyLevel: 'standard', lineage: ['Worker profile', 'Assignment', 'Attendance ledger'], recommendedDrilldowns: ['Department', 'Manager'] },
    { code: 'attendance-payroll-readiness', title: 'Attendance to Payroll Readiness', from: 'ATTENDANCE', to: 'PAYROLL', relationship: 'Time evidence for payroll close', businessUse: 'Ensures late minutes, overtime, and exceptions are reviewed before payroll is approved.', grain: 'Worker-day to payroll period', joinKeys: ['workerId', 'payPeriod'], privacyLevel: 'sensitive', lineage: ['Attendance event', 'Daily ledger', 'Payroll preview'], recommendedDrilldowns: ['Department', 'Employee'] },
  ],
};

const savedReports = [
  {
    reportDefinitionId: '00000000-0000-0000-0000-00000000a501',
    reportName: 'Monthly attendance exceptions',
    dataSource: 'ATTENDANCE',
    status: 'PUBLISHED',
    queryDefinition: {
      fields: ['employeeNumber', 'employeeName', 'workDate'],
      metrics: ['lateMinutes', 'exceptions'],
      groupBy: ['department'],
      scopeLevel: 'DEPARTMENT',
      populationValue: 'ENGINEERING',
      visualization: 'bar',
    },
  },
];

const previewResult = {
  valid: true,
  dataSource: 'ATTENDANCE',
  scopeLevel: 'TENANT',
  columns: ['employeeNumber', 'employeeName', 'workDate', 'attendanceStatus'],
  metrics: ['lateMinutes', 'exceptions'],
  groupBy: ['department'],
  rowCountEstimate: 144,
  chartData: [{ label: 'Engineering', value: 65 }, { label: 'Sales', value: 43 }],
  sampleRows: [
    { employeeNumber: 'EMP-0042', employeeName: 'Emily Chen', workDate: '2026-06-10', attendanceStatus: 'Late', lateMinutes: 12 },
    { employeeNumber: 'EMP-0044', employeeName: 'Marcus Johnson', workDate: '2026-06-10', attendanceStatus: 'Present', lateMinutes: 0 },
  ],
  warnings: [],
};

const analyticsPackResult = {
  packCode: 'FULL_HR_ANALYTICS',
  title: 'Full HR Analytics',
  generatedAt: '2026-06-11T08:00:00.000Z',
  scopeLevel: 'TENANT',
  period: 'CURRENT_MONTH',
  reportOptions: [
    { code: 'attendance-exceptions-monthly', title: 'Monthly Attendance Exceptions', dataSource: 'ATTENDANCE', recommended: true },
  ],
  highlights: [
    { label: 'Active workforce', value: 248, tone: 'success' },
    { label: 'Open risk signals', value: 26, tone: 'warning' },
  ],
  charts: [
    { title: 'Workforce risk', data: [{ label: 'Attendance', value: 18 }, { label: 'Payroll', value: 4 }] },
  ],
  suggestedNextActions: ['Run attendance exceptions by department.'],
};

const smartCategoryResult = {
  categoryCode: 'WORKFORCE_COMPOSITION',
  title: 'Workforce Composition',
  generatedAt: '2026-06-11T08:05:00.000Z',
  scopeLevel: 'TENANT',
  period: 'CURRENT_MONTH',
  summary: 'Workforce Composition analysis found 18 risk signals across headcount and attendance.',
  insights: builderCatalog.smartCategories[0].insights,
  drilldowns: builderCatalog.smartCategories[0].drilldowns,
  relatedReports: [
    { code: 'attendance-exceptions-monthly', title: 'Monthly Attendance Exceptions', dataSource: 'ATTENDANCE' },
  ],
  recommendedActions: ['Open the attendance exception report for Engineering.'],
  filterSummary: [{ label: 'Period', value: 'CURRENT_MONTH' }],
  relationships: builderCatalog.businessRelationships,
};

const semanticQueryResult = {
  dataSource: 'ATTENDANCE',
  sourceTitle: 'Attendance & Time Ledger',
  generatedAt: '2026-06-11T08:10:00.000Z',
  scopeLevel: 'TENANT',
  populationValue: 'ALL',
  columns: ['department', 'lateMinutes', 'exceptions'],
  metrics: ['lateMinutes', 'exceptions'],
  groupBy: ['department'],
  rowCount: 1,
  drillThroughCount: 2,
  rows: [
    { department: 'ENGINEERING', lateMinutes: 18, exceptions: 1 },
  ],
  drillThroughRows: [
    { employeeNumber: 'EMP-0042', employeeName: 'Emily Chen', workDate: '2026-06-10', attendanceStatus: 'LATE', department: 'ENGINEERING', lateMinutes: 18, exceptions: 1 },
    { employeeNumber: 'EMP-0044', employeeName: 'Marcus Johnson', workDate: '2026-06-10', attendanceStatus: 'PRESENT', department: 'ENGINEERING', lateMinutes: 0, exceptions: 0 },
  ],
  chartData: [{ label: 'ENGINEERING', value: 18, secondaryValue: 1 }],
  insightCards: [
    { label: 'Rows', value: 1, tone: 'success' },
    { label: 'Drill-through records', value: 2, tone: 'success' },
    { label: 'Late minutes', value: 18, tone: 'default' },
  ],
  executionPlan: {
    grain: 'Worker-day',
    privacyLevel: 'sensitive',
    appliedFilters: [{ code: 'period', value: 'CURRENT_MONTH' }],
    availableDrilldowns: ['Department', 'Manager', 'Employee'],
  },
  decisionSupport: {
    summary: 'ENGINEERING is the top segment for late minutes with 18 (100% of the result).',
    topSegments: [
      { label: 'ENGINEERING', metric: 'Late minutes', value: 18, shareOfTotal: 100, severity: 'watch' },
    ],
    recommendedDrilldowns: [
      { field: 'manager', label: 'Manager', reason: 'Break late minutes down by manager for the next layer of context.' },
      { field: 'employeeName', label: 'Employee', reason: 'Break late minutes down by employee for the next layer of context.' },
    ],
    nextActions: [
      { label: 'Open ENGINEERING drill-through', actionType: 'DRILLDOWN', reason: 'Review the 2 underlying records behind the top segment.' },
      { label: 'Export underlying records', actionType: 'EXPORT', reason: 'Share the drill-through data with HR operations or business owners.' },
    ],
  },
  warnings: [],
};

function renderReporting() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminReporting />
    </QueryClientProvider>,
  );
}

describe('AdminReporting analytics', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    apiClientGetMock.mockImplementation((path: string) => {
      if (path === '/reporting/hr-dashboard') {
        return Promise.resolve({ data: { success: true, data: dashboard } });
      }
      if (path === '/reporting/hr-analytics') {
        return Promise.resolve({ data: { success: true, data: analytics } });
      }
      if (path === '/reporting/builder/catalog') {
        return Promise.resolve({ data: { success: true, data: builderCatalog } });
      }
  if (path === '/reporting/report-definitions?status=ALL') {
    return Promise.resolve({ data: { success: true, data: savedReports } });
  }
      if (path === '/reporting/calculated-fields?status=ALL') {
        return Promise.resolve({ data: { success: true, data: [
          { calculatedFieldId: '00000000-0000-0000-0000-00000000c501', fieldName: 'Net payroll cost', expression: 'grossPay - deductionAmount', dataType: 'currency', status: 'ACTIVE' },
        ] } });
      }
      return Promise.resolve({ data: new Blob(['']) });
    });
    apiClientPostMock.mockImplementation((path: string) => {
      if (path === '/reporting/report-definitions/preview') {
        return Promise.resolve({ data: { success: true, data: previewResult } });
      }
      if (path === '/reporting/builder/analytics-packs/run') {
        return Promise.resolve({ data: { success: true, data: analyticsPackResult } });
      }
      if (path === '/reporting/builder/smart-categories/run') {
        return Promise.resolve({ data: { success: true, data: smartCategoryResult } });
      }
      if (path === '/reporting/builder/query/run') {
        return Promise.resolve({ data: { success: true, data: semanticQueryResult } });
      }
      if (path === '/reporting/report-definitions') {
        return Promise.resolve({ data: { success: true, data: { ...savedReports[0], status: 'DRAFT' } } });
      }
      if (path === '/reporting/calculated-fields') {
        return Promise.resolve({ data: { success: true, data: { calculatedFieldId: '00000000-0000-0000-0000-00000000c599', fieldName: 'Custom metric', status: 'DRAFT' } } });
      }
      if (path === '/reporting/report-executions') {
        return Promise.resolve({ data: { success: true, data: { reportExecutionId: '00000000-0000-0000-0000-00000000e501', status: 'QUEUED' } } });
      }
      if (path === '/reporting/report-schedules') {
        return Promise.resolve({ data: { success: true, data: { reportScheduleId: '00000000-0000-0000-0000-00000000f501', status: 'ACTIVE' } } });
      }
      if (path.includes('/commands/publish')) {
        return Promise.resolve({ data: { success: true, data: { status: 'PUBLISHED' } } });
      }
      return Promise.resolve({ data: { success: true, data: null } });
    });
  });

  it('renders business analytics charts from the reporting analytics endpoint', async () => {
    renderReporting();

    expect(await screen.findByText('Report Activity')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /command center/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /smart analytics/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /report builder/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /data relationships/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /library & delivery/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /activity/i })).toBeInTheDocument();
    expect(screen.queryByText('Smart HR Analytics Studio')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /smart analytics/i }));

    expect(await screen.findByText('Smart HR Analytics Studio')).toBeInTheDocument();
    expect(screen.getByText('Business Categories')).toBeInTheDocument();
    expect(screen.getAllByText('Workforce Composition').length).toBeGreaterThan(0);
    expect(screen.getByText('Capacity Risk Hotspots')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /run category analysis/i }));
    expect(await screen.findByText('Category Run Result')).toBeInTheDocument();
    expect(screen.getByText('Workforce Composition analysis found 18 risk signals across headcount and attendance.')).toBeInTheDocument();
    expect(apiClientPostMock).toHaveBeenCalledWith('/reporting/builder/smart-categories/run', expect.objectContaining({
      categoryCode: 'WORKFORCE_COMPOSITION',
      period: 'CURRENT_MONTH',
      selectedInsightCodes: ['capacity-risk'],
    }));
    expect(screen.getByText('Operational Analytics Coverage')).toBeInTheDocument();
    expect(screen.getAllByText('Attendance Exceptions').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Leave Pipeline').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Payroll Net Pay').length).toBeGreaterThan(0);
    expect(screen.getByText('Performance Rating')).toBeInTheDocument();
    expect(screen.getByText('Benefits Coverage')).toBeInTheDocument();
    expect(screen.getAllByText('Headcount and Org Coverage').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Compliance Evidence').length).toBeGreaterThan(0);
    expect(screen.getAllByText('HR Services Demand').length).toBeGreaterThan(0);
    expect(screen.getAllByText('EGP 210,000').length).toBeGreaterThan(0);
    expect(screen.getByText('26')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /data relationships/i }));

    expect(await screen.findByText('HR Data Relationship Map')).toBeInTheDocument();
    expect(screen.getByText('Business Data Domains')).toBeInTheDocument();
    expect(screen.getByText('How This Data Connects')).toBeInTheDocument();
    expect(screen.getByText('Headcount to Attendance Capacity')).toBeInTheDocument();
    expect(screen.getByText('Attendance to Payroll Readiness')).toBeInTheDocument();
    expect(screen.getAllByText('Data grain').length).toBeGreaterThan(0);
    expect(screen.getByText('Worker-day to payroll period')).toBeInTheDocument();
    expect(screen.getAllByText('workerId').length).toBeGreaterThan(0);
    expect(screen.getByText('Attendance event -> Daily ledger -> Payroll preview')).toBeInTheDocument();
    expect(screen.getByText('Smart categories using this data')).toBeInTheDocument();
    expect(screen.getAllByText('Workforce Composition').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('tab', { name: /library & delivery/i }));

    expect(await screen.findByText('Saved Reports')).toBeInTheDocument();
    expect(screen.getByText('Monthly attendance exceptions')).toBeInTheDocument();
    expect(screen.getByText('Population: ENGINEERING')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await userEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    expect(apiClientPostMock).toHaveBeenCalledWith('/reporting/report-definitions/00000000-0000-0000-0000-00000000a501/commands/publish', {});
    expect(apiClientPostMock).toHaveBeenCalledWith('/reporting/report-executions', expect.objectContaining({
      reportDefinitionId: '00000000-0000-0000-0000-00000000a501',
      executedBy: '00000000-0000-0000-0000-000000000777',
    }));
    expect(apiClientPostMock).toHaveBeenCalledWith('/reporting/report-schedules', expect.objectContaining({
      reportDefinitionId: '00000000-0000-0000-0000-00000000a501',
      frequency: 'MONTHLY',
      recipients: ['hr.operations@example.com'],
      nextRunAt: expect.any(String),
    }));
    expect(await screen.findByText('Migration Templates')).toBeInTheDocument();
    expect(screen.getByText('Headcount & Org')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /activity/i }));

    expect(await screen.findByText('Top Report Activity')).toBeInTheDocument();
    expect(screen.getByText('Connected services: ORGANIZATION, HR_CORE')).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/reporting/hr-analytics'));
  });

  it('builds, previews, and saves a custom report definition', async () => {
    const user = userEvent.setup();
    renderReporting();

    await user.click(await screen.findByRole('tab', { name: /builder/i }));

    expect(await screen.findByText('Choose What to Run')).toBeInTheDocument();
    expect(screen.getByText('Full HR Analytics')).toBeInTheDocument();
    expect(screen.getByText('Recommended reports')).toBeInTheDocument();
    expect(screen.getAllByText('Attendance & Time Ledger').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Report name')).toHaveValue('Monthly attendance exceptions');
    expect(screen.getByLabelText('Underlying data')).toBeInTheDocument();
    expect(screen.getByLabelText('Scope level')).toBeInTheDocument();
    expect(screen.getByLabelText('Report population')).toBeInTheDocument();
    expect(screen.getByLabelText('Display')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Attendance status').some((element) => element.getAttribute('role') === 'combobox')).toBe(true);
    expect(screen.getByText('Underlying data catalog')).toBeInTheDocument();
    expect(screen.getByText('Calculated Fields')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /run smart analytics/i }));
    expect(await screen.findByText('Analytics ready')).toBeInTheDocument();
    expect(screen.getByText('Open risk signals')).toBeInTheDocument();
    expect(apiClientPostMock).toHaveBeenCalledWith('/reporting/builder/analytics-packs/run', expect.objectContaining({
      packCode: 'FULL_HR_ANALYTICS',
      period: 'CURRENT_MONTH',
    }));

    await user.click(screen.getByRole('button', { name: /^preview$/i }));

    expect(await screen.findByText('Estimated rows')).toBeInTheDocument();
    expect(screen.getByText('144')).toBeInTheDocument();
    expect(apiClientPostMock).toHaveBeenCalledWith('/reporting/report-definitions/preview', expect.objectContaining({
      dataSource: 'ATTENDANCE',
      queryDefinition: expect.objectContaining({
        fields: ['employeeNumber', 'employeeName', 'workDate', 'attendanceStatus'],
        metrics: ['lateMinutes', 'exceptions'],
        groupBy: ['department'],
        scopeLevel: 'TENANT',
        populationValue: 'ALL',
        sourcePackCode: 'FULL_HR_ANALYTICS',
      }),
    }));

    await user.click(screen.getByRole('button', { name: /run report/i }));
    expect(await screen.findByText('Semantic Query Result')).toBeInTheDocument();
    expect(screen.getByText('Worker-day')).toBeInTheDocument();
    expect(screen.getByText('Drill-through records')).toBeInTheDocument();
    expect(screen.getByText('Decision Support')).toBeInTheDocument();
    expect(screen.getByText('ENGINEERING is the top segment for late minutes with 18 (100% of the result).')).toBeInTheDocument();
    expect(screen.getByText('Open ENGINEERING drill-through')).toBeInTheDocument();
    expect(screen.getByText('Export underlying records')).toBeInTheDocument();
    expect(screen.getAllByText('Emily Chen').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ENGINEERING').length).toBeGreaterThan(0);
    expect(apiClientPostMock).toHaveBeenCalledWith('/reporting/builder/query/run', expect.objectContaining({
      dataSource: 'ATTENDANCE',
      queryDefinition: expect.objectContaining({
        fields: ['employeeNumber', 'employeeName', 'workDate', 'attendanceStatus'],
        metrics: ['lateMinutes', 'exceptions'],
        groupBy: ['department'],
        scopeLevel: 'TENANT',
        populationValue: 'ALL',
      }),
      limit: 25,
    }));

    await user.click(screen.getByRole('button', { name: /save report/i }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith('/reporting/report-definitions', expect.objectContaining({
      reportName: 'Monthly attendance exceptions',
      reportType: 'CUSTOM',
      dataSource: 'ATTENDANCE',
      queryDefinition: expect.objectContaining({
        fields: ['employeeNumber', 'employeeName', 'workDate', 'attendanceStatus'],
        metrics: ['lateMinutes', 'exceptions'],
        groupBy: ['department'],
        scopeLevel: 'TENANT',
        populationValue: 'ALL',
        sourcePackCode: 'FULL_HR_ANALYTICS',
      }),
    })));

    await user.click(screen.getByRole('button', { name: /save metric/i }));
    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith('/reporting/calculated-fields', expect.objectContaining({
      fieldName: 'Custom metric',
      expression: 'grossPay - deductionAmount',
      dataType: 'currency',
    })));
  });
});
