import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDashboard } from './dashboard';

const apiClientGetMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: vi.fn(),
  },
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: '00000000-0000-4000-8000-000000000099',
      firstName: 'Jordan',
      roles: [{ id: 'role-1', name: 'HR_ADMIN' }],
    },
  }),
}));

const dashboardData = {
  headcount: 128,
  turnover: 8,
  openPositions: 5,
  newHiresThisMonth: 3,
  terminationsThisMonth: 1,
  recentActivity: [
    { id: '00000000-0000-4000-8000-000000000301', description: 'New hire onboarded', timestamp: '2 hours ago', type: 'HIRE' },
  ],
  alerts: [
    { id: '00000000-0000-4000-8000-000000000401', severity: 'high', message: 'Missing I-9 documentation' },
  ],
};

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

describe('AdminDashboard accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation(() => apiResponse(dashboardData));
  });

  it('renders without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: /Good (morning|afternoon|evening), Jordan/ })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/admin/dashboard'));
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
