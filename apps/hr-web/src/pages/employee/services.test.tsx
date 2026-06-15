import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeServices } from './services';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

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
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

function renderEmployeeServices() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EmployeeServices />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EmployeeServices', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
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
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: { hrServiceCaseId: 'case-2', caseNumber: 'HR-20260614-NEW12345', status: 'OPEN' } } });
  });

  it('tracks submitted tickets with SLA status and creates new cases', async () => {
    renderEmployeeServices();

    expect(await screen.findByRole('heading', { name: 'Ask HR, track requests, and get support' })).toBeInTheDocument();
    expect(await screen.findByText('HR-20260614-MINE1234')).toBeInTheDocument();
    expect(screen.getByText('SLA due soon')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Describe what you need, deadlines, documents, or evidence...'), 'Please prepare a signed employment letter.');
    await userEvent.click(screen.getByRole('button', { name: 'Submit Service Request' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/hr-service-delivery/cases',
      expect.objectContaining({ caseType: 'HR_LETTER', priority: 'MEDIUM', description: 'Please prepare a signed employment letter.' }),
    ));
    expect(addNotificationMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Service request submitted' }));
  });
});
