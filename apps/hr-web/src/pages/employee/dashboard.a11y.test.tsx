import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_HCM_SETUP } from '@/lib/hcm-setup-defaults';
import { EmployeeDashboard } from './dashboard';

const useApiQueryMock = vi.fn();
const useApiMutationMock = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
  useApiMutation: (...args: unknown[]) => useApiMutationMock(...args),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      email: 'amina@example.com',
      firstName: 'Amina',
      lastName: 'Nour',
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

vi.mock('recharts', () => ({
  Area: () => null,
  AreaChart: () => <div data-testid="area-chart" />,
  Bar: () => null,
  BarChart: () => <div data-testid="bar-chart" />,
  CartesianGrid: () => null,
  Cell: () => null,
  Legend: () => null,
  Line: () => null,
  LineChart: () => <div data-testid="line-chart" />,
  Pie: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const worker = {
  id: '00000000-0000-0000-0000-000000000020',
  employeeId: 'E-020',
  firstName: 'Amina',
  lastName: 'Nour',
  email: 'amina@example.com',
  hireDate: '2025-01-01',
  employmentType: 'FULL_TIME',
  status: 'ACTIVE',
  department: 'Design',
  jobTitle: 'Product Designer',
  manager: 'David Chen',
  legalEntity: 'Enterprise HR',
};

const periodView = {
  periodStart: '2026-06-03',
  periodEnd: '2026-06-09',
  range: 'WEEKLY',
  scope: 'SELF',
  totals: {
    employeeDays: 5,
    present: 4,
    absent: 0,
    onLeave: 1,
    exceptions: 1,
    payableHours: 38.5,
    deductionHours: 0.5,
    overtimeHours: 2,
    geofenceViolations: 0,
    lateMinutes: 15,
    missingCheckout: 0,
    payrollReady: 4,
    undertimeMinutes: 30,
  },
  series: [],
  workers: [],
  policyEvidence: {
    flexibleRuleCodes: [],
    leavePolicyTypes: [],
    scheduleSources: [],
  },
};

describe('EmployeeDashboard accessibility', () => {
  beforeEach(() => {
    useApiMutationMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'employee-attendance-setup') return { data: DEFAULT_HCM_SETUP, isLoading: false };
      if (key === 'employee-dashboard-profile') return { data: worker, isLoading: false };
      if (key === 'employee-attendance-state') return { data: undefined, isLoading: false };
      if (key === 'employee-attendance-period-view') return { data: periodView, isLoading: false };
      if (key === 'employee-attendance-corrections') return { data: [], isLoading: false };
      return { data: undefined, isLoading: false };
    });
  });

  it('renders without accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <EmployeeDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /Amina Nour/i })).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
