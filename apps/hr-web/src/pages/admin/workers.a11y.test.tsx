import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminWorkers } from './workers';

const apiClientGetMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

const worker = {
  id: '00000000-0000-4000-8000-000000000901',
  employeeId: 'EMP-001',
  firstName: 'Amina',
  lastName: 'Khalil',
  email: 'amina.khalil@example.com',
  hireDate: '2025-01-15',
  status: 'ACTIVE',
  jobTitle: 'HR Business Partner',
  departmentName: 'People Operations',
};

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

describe('AdminWorkers accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url.startsWith('/hr/core/workers')) return apiResponse([worker]);
      if (url === '/me/inbox') return apiResponse({ sections: [] });
      return apiResponse([]);
    });
  });

  it('renders without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminWorkers />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Employees' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Amina Khalil')).toBeInTheDocument());
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
