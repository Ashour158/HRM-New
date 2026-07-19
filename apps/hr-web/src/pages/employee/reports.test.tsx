import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
    { key: 'team-attendance-summary', tier: 'TEAM', title: 'Team Attendance Summary', description: 'Team attendance.', dataDomains: ['ATTENDANCE'], kind: 'DATA' },
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

describe('EmployeeReports', () => {
  beforeEach(() => {
    useApiQueryMock.mockReset();
    mockUseApiQuery();
  });

  it('renders only the My Reports tier cards from the shared catalog', () => {
    render(
      <MemoryRouter>
        <EmployeeReports />
      </MemoryRouter>,
    );
    expect(screen.getByText('Time-Off Balance & History')).toBeInTheDocument();
    expect(screen.getByText('Attendance Summary')).toBeInTheDocument();
    expect(screen.getByText('Learning Progress')).toBeInTheDocument();
    expect(screen.getByText('Compensation & Payslip History')).toBeInTheDocument();
    expect(screen.queryByText('Team Attendance Summary')).not.toBeInTheDocument();
  });

  it('opens a report dialog with the fetched data when a DATA report card is run', async () => {
    render(
      <MemoryRouter>
        <EmployeeReports />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getAllByRole('button', { name: 'View report' })[0]);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('Annual Leave')).toBeInTheDocument();
  });

  it('navigates to the existing payslip page instead of opening a dialog for the LINK report', async () => {
    render(
      <MemoryRouter initialEntries={['/employee/reports']}>
        <Routes>
          <Route path="/employee/reports" element={<EmployeeReports />} />
          <Route path="/employee/payslip" element={<div>Payslip page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByText('Payslip page')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
