import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_HCM_SETUP } from '@/lib/hcm-setup-defaults';
import { AdminEmployeeCreate } from './employee-create';

const apiClientGetMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: vi.fn(),
  },
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    roles: [{ id: 'role-1', name: 'HR_ADMIN' }],
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

describe('AdminEmployeeCreate accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/admin/hcm-setup') return apiResponse(DEFAULT_HCM_SETUP);
      if (url === '/hr/organization/org-units/tree') return apiResponse([]);
      if (url === '/hr/core/workers?pageSize=100') return apiResponse([]);
      return apiResponse([]);
    });
  });

  it('renders the identity step without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminEmployeeCreate />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { level: 2, name: 'New Employee' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Identity' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/admin/hcm-setup'));
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
