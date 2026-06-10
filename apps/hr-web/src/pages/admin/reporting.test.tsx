import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminReporting } from './reporting';

const apiClientGetMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
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
    apiClientGetMock.mockImplementation((path: string) => {
      if (path === '/reporting/hr-dashboard') {
        return Promise.resolve({ data: { success: true, data: dashboard } });
      }
      if (path === '/reporting/hr-analytics') {
        return Promise.resolve({ data: { success: true, data: analytics } });
      }
      return Promise.resolve({ data: new Blob(['']) });
    });
  });

  it('renders business analytics charts from the reporting analytics endpoint', async () => {
    renderReporting();

    expect(await screen.findByText('Cross-Module Analytics')).toBeInTheDocument();
    expect(screen.getAllByText('Attendance Exceptions').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Leave Pipeline').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Payroll Net Pay').length).toBeGreaterThan(0);
    expect(screen.getByText('Performance Rating')).toBeInTheDocument();
    expect(screen.getByText('Benefits Coverage')).toBeInTheDocument();
    expect(screen.getAllByText('Headcount and Org Coverage').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Compliance Evidence').length).toBeGreaterThan(0);
    expect(screen.getAllByText('HR Services Demand').length).toBeGreaterThan(0);
    expect(screen.getByText('Template: headcount-org')).toBeInTheDocument();
    expect(screen.getByText('Engine: position-headcount')).toBeInTheDocument();
    expect(screen.getAllByText('EGP 210,000').length).toBeGreaterThan(0);
    expect(screen.getByText('26')).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/reporting/hr-analytics'));
  });
});
