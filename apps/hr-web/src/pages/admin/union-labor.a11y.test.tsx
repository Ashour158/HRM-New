import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminUnionLabor } from './union-labor';

const apiClientGetMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: vi.fn(),
  },
}));

vi.mock('@/hooks/use-tenant', () => ({
  useTenant: () => ({
    tenantId: '00000000-0000-4000-8000-000000000001',
    tenantName: 'Acme Health',
    tenantConfig: { currency: 'AED', dateFormat: 'DD/MM/YYYY', timezone: 'Asia/Dubai', features: [] },
  }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: '00000000-0000-4000-8000-000000000099', roles: [{ id: 'role-1', name: 'WORKFORCE_MANAGER' }] },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

describe('AdminUnionLabor accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation(() => apiResponse([]));
  });

  it('renders without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminUnionLabor />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Union & Labor' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalled());
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
