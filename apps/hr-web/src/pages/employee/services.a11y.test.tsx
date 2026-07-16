import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeServices } from './services';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
  },
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    roles: [{ id: 'role-employee', name: 'EMPLOYEE' }],
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

describe('EmployeeServices accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/hr-service-delivery/catalog-items') {
        return apiResponse([
          {
            id: 'catalog-1',
            serviceCode: 'HR_LETTER',
            serviceName: 'Employment letter request',
            description: 'Request salary, employment, embassy, bank, or visa letters.',
            category: 'Documents',
            slaHours: 24,
            fulfillmentProcess: 'HR prepares the letter.',
            status: 'ACTIVE',
          },
        ]);
      }
      if (url === '/hr-service-delivery/cases/my') {
        return apiResponse([
          {
            id: 'case-1',
            caseNumber: 'HR-20260614-MINE1234',
            requesterWorkerId: 'worker-1',
            caseType: 'HR_LETTER',
            priority: 'MEDIUM',
            description: 'Need a bank letter.',
            slaDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            status: 'IN_PROGRESS',
            createdAt: '2026-06-14T08:00:00.000Z',
            updatedAt: '2026-06-14T09:00:00.000Z',
          },
        ]);
      }
      return apiResponse([]);
    });
  });

  it('renders without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EmployeeServices />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Ask HR, track requests, and get support' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalled());
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
