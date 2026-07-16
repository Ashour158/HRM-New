import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPayroll } from './payroll';

const apiClientGetMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: vi.fn(),
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

describe('AdminPayroll accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url.startsWith('/admin/hcm-setup')) return apiResponse(null);
      if (url.startsWith('/payroll/monthly-cycle-preview')) return apiResponse(null);
      if (url.startsWith('/payroll/payment-batch-preview')) return apiResponse(null);
      if (url.startsWith('/payroll/monthly-cycle-gl-preview')) return apiResponse(null);
      return apiResponse(null);
    });
  });

  it('renders without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminPayroll />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Payroll' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalled());
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
