import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/i18n-provider';
import { AdminRecruiting } from './recruiting';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const requisitionId = '00000000-0000-4000-8000-000000000101';

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
    tenantConfig: {
      currency: 'AED',
      dateFormat: 'DD/MM/YYYY',
      timezone: 'Asia/Dubai',
      features: [],
    },
  }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: '00000000-0000-4000-8000-000000000099',
      roles: [{ id: 'role-1', name: 'HR_ADMIN' }],
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

describe('AdminRecruiting accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/hr/recruiting/requisitions/open') {
        return apiResponse([
          {
            id: requisitionId,
            requisitionNumber: 'REQ-001',
            positionId: '00000000-0000-4000-8000-000000000901',
            title: 'Senior Nurse',
            status: 'OPEN',
          },
        ]);
      }
      if (url === `/hr/recruiting/requisitions/${requisitionId}`) return apiResponse({ id: requisitionId, title: 'Senior Nurse', status: 'OPEN' });
      if (url === `/hr/recruiting/candidates?requisition=${requisitionId}`) return apiResponse([]);
      if (url === `/hr/recruiting/offers?requisition=${requisitionId}`) return apiResponse([]);
      return apiResponse([]);
    });
  });

  it('renders without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <MemoryRouter>
            <AdminRecruiting />
          </MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Recruiting' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith(`/hr/recruiting/offers?requisition=${requisitionId}`));
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
