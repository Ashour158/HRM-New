import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminSystemConsole } from './system-console';

const apiClientGetMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
  },
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: '00000000-0000-4000-8000-000000000099',
      firstName: 'Ada',
      lastName: 'Admin',
      email: 'ada.admin@acme.test',
      roles: [{ id: 'role-1', name: 'PLATFORM_ADMIN' }],
    },
  }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

const arrayEndpoints = new Set(['/notifications/hr-operations', '/audit']);

describe('AdminSystemConsole accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => apiResponse(arrayEndpoints.has(url) ? [] : {}));
  });

  it('renders without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminSystemConsole />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Admin Command Center' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/admin/dashboard'));
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
