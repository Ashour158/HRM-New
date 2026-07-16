import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdminSettings } from './settings';
import { DEFAULT_HCM_SETUP } from '@/lib/hcm-setup-defaults';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPatchMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    patch: apiClientPatchMock,
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

describe('AdminSettings accessibility', () => {
  it('renders without accessibility violations', async () => {
    apiClientGetMock.mockReset();
    apiClientPatchMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation(() => apiResponse(DEFAULT_HCM_SETUP));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminSettings />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Admin Settings' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/admin/hcm-setup'));
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
