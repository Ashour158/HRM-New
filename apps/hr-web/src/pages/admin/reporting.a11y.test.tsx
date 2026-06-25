import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
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
  ],
  activityByReport: [{ label: 'Attendance Report', activity: 10, issues: 0 }],
};

const analytics = {
  generatedAt: '2026-06-10T09:00:00.000Z',
  totals: {
    activeModules: 1,
    riskSignals: 0,
    attendanceEmployeeDays: 0,
    leaveRequests: 0,
    payrollNetPay: 0,
    performanceReviews: 0,
    benefitsEnrollments: 0,
  },
  headlineMetrics: [],
  modules: [],
  riskSignals: [],
};

const builderCatalog = {
  scopeLevels: [],
  populationOptions: [],
  visualizationTypes: [],
  dataSources: [],
  templates: [],
  analyticsPacks: [],
  smartCategories: [],
  businessRelationships: [],
};

describe('AdminReporting accessibility', () => {
  it('renders the reporting command center without accessibility violations', async () => {
    apiClientGetMock.mockImplementation((path: string) => {
      if (path === '/reporting/hr-dashboard') return Promise.resolve({ data: { success: true, data: dashboard } });
      if (path === '/reporting/hr-analytics') return Promise.resolve({ data: { success: true, data: analytics } });
      if (path === '/reporting/builder/catalog') return Promise.resolve({ data: { success: true, data: builderCatalog } });
      if (path === '/reporting/report-definitions?status=ALL') return Promise.resolve({ data: { success: true, data: [] } });
      if (path === '/reporting/report-executions') return Promise.resolve({ data: { success: true, data: [] } });
      if (path === '/reporting/calculated-fields?status=ALL') return Promise.resolve({ data: { success: true, data: [] } });
      return Promise.resolve({ data: { success: true, data: [] } });
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: { optionsByFilter: [] } } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <AdminReporting />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Report Activity')).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
