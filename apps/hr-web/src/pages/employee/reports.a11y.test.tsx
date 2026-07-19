import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { EmployeeReports } from './reports';

const useApiQueryMock = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
}));

const catalog = {
  reports: [
    { key: 'my-time-off-balance', tier: 'MY', title: 'Time-Off Balance & History', description: 'Your balances and history.', dataDomains: ['LEAVE'], kind: 'DATA' },
    { key: 'my-attendance-summary', tier: 'MY', title: 'Attendance Summary', description: 'Your attendance.', dataDomains: ['ATTENDANCE'], kind: 'DATA' },
    { key: 'my-learning-progress', tier: 'MY', title: 'Learning Progress', description: 'Your learning.', dataDomains: ['LEARNING'], kind: 'DATA' },
    { key: 'my-compensation-payslip', tier: 'MY', title: 'Compensation & Payslip History', description: 'View your payslip history.', dataDomains: ['PAYROLL'], kind: 'LINK', linkTo: '/employee/payslip' },
  ],
};

const timeOffReport = {
  definition: catalog.reports[0],
  generatedAt: '2026-07-01T00:00:00.000Z',
  balances: [{ type: 'ANNUAL', label: 'Annual Leave', total: 20, used: 5, remaining: 15, unit: 'days' }],
  history: [{ id: 'req-1', type: 'ANNUAL', startDate: '2026-06-01', endDate: '2026-06-02', status: 'APPROVED', workingDays: 2 }],
  entitlementCalculations: [],
  summary: { pendingRequests: 0, approvedRequests: 1, totalRemaining: 15 },
};

function mockUseApiQuery() {
  useApiQueryMock.mockImplementation((_key: unknown, url: string) => {
    if (url === '/reports/library/catalog') {
      return { data: catalog, isLoading: false, isError: false, error: null, refetch: vi.fn() };
    }
    if (url === '/reports/library/my/my-time-off-balance/run') {
      return { data: timeOffReport, isLoading: false, isError: false, error: null, refetch: vi.fn() };
    }
    return { data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() };
  });
}

describe('EmployeeReports accessibility', () => {
  beforeEach(() => {
    useApiQueryMock.mockReset();
    mockUseApiQuery();
  });

  it('renders the My Reports library without accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <EmployeeReports />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'My Reports' })).toBeInTheDocument();
    expect(screen.getByText('Time-Off Balance & History')).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });

  it('renders an opened report dialog without accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <EmployeeReports />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getAllByRole('button', { name: 'View report' })[0]);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Annual Leave')).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
