import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ManagerReports } from './reports';

const useApiQueryMock = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
}));

const catalog = {
  reports: [
    { key: 'my-time-off-balance', tier: 'MY', title: 'Time-Off Balance & History', description: 'Your balances and history.', dataDomains: ['LEAVE'], kind: 'DATA' },
    { key: 'team-attendance-summary', tier: 'TEAM', title: 'Team Attendance Summary', description: 'Team attendance activity.', dataDomains: ['ATTENDANCE'], kind: 'DATA' },
    { key: 'team-leave-calendar', tier: 'TEAM', title: 'Team Leave Calendar', description: 'Upcoming absences.', dataDomains: ['LEAVE'], kind: 'DATA' },
    { key: 'team-performance-distribution', tier: 'TEAM', title: 'Team Performance Distribution', description: 'Rating distribution.', dataDomains: ['PERFORMANCE'], kind: 'DATA' },
  ],
};

const leaveCalendarReport = {
  definition: catalog.reports[2],
  generatedAt: '2026-07-01T00:00:00.000Z',
  upcoming: [{ id: 'req-1', workerId: 'w-1', workerName: 'Dana Doe', type: 'ANNUAL', startDate: '2026-07-10', endDate: '2026-07-12', status: 'APPROVED' }],
  summary: { teamSize: 4, totalUpcoming: 1, onLeaveToday: 0 },
};

function mockUseApiQuery() {
  useApiQueryMock.mockImplementation((_key: unknown, url: string) => {
    if (url === '/reports/library/catalog') {
      return { data: catalog, isLoading: false, isError: false, error: null, refetch: vi.fn() };
    }
    if (url === '/reports/library/team/team-leave-calendar/run') {
      return { data: leaveCalendarReport, isLoading: false, isError: false, error: null, refetch: vi.fn() };
    }
    return { data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() };
  });
}

describe('ManagerReports accessibility', () => {
  beforeEach(() => {
    useApiQueryMock.mockReset();
    mockUseApiQuery();
  });

  it('renders the Team Reports library without accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <ManagerReports />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Team Reports' })).toBeInTheDocument();
    expect(screen.getByText('Team Attendance Summary')).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });

  it('renders an opened report dialog without accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <ManagerReports />
      </MemoryRouter>,
    );

    // team-attendance-summary, team-leave-calendar, team-performance-distribution, in catalog order
    await userEvent.click(screen.getAllByRole('button', { name: 'View report' })[1]);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Dana Doe')).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
