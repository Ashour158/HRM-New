import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminCountryPolicy } from './country-policy';

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

describe('AdminCountryPolicy accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation(() => apiResponse([]));
  });

  it('renders without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminCountryPolicy />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Country Policy v1.4' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/country-policy/policy-packs'));
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
