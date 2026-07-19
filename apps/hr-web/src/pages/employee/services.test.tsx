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
      if (url === '/hr-service-delivery/knowledge-articles') {
        return apiResponse([
          {
            id: 'kb-1',
            title: 'How payroll deductions are calculated',
            content: 'Payroll deductions cover statutory tax, social insurance, and any voluntary benefit elections you have made.',
            category: 'Payroll & Reward',
            tags: ['payroll', 'deductions'],
            status: 'PUBLISHED',
            createdAt: '2026-06-01T08:00:00.000Z',
            updatedAt: '2026-06-01T08:00:00.000Z',
          },
          {
            id: 'kb-2',
            title: 'Requesting an employment verification letter',
            content: 'Submit a service request under Documents and HR will issue a signed letter within 24 hours.',
            category: 'Documents',
            tags: ['letters'],
            status: 'PUBLISHED',
            createdAt: '2026-06-02T08:00:00.000Z',
            updatedAt: '2026-06-02T08:00:00.000Z',
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

  it('surfaces published knowledge base articles for self-serve search before submitting a case', async () => {
    renderEmployeeServices();

    expect(await screen.findByRole('heading', { name: 'Find an answer before opening a case' })).toBeInTheDocument();
    expect(await screen.findByText('How payroll deductions are calculated')).toBeInTheDocument();
    expect(screen.getByText('Requesting an employment verification letter')).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/hr-service-delivery/knowledge-articles'));
  });

  it('filters knowledge base articles as the employee searches', async () => {
    renderEmployeeServices();

    expect(await screen.findByText('How payroll deductions are calculated')).toBeInTheDocument();
    expect(screen.getByText('Requesting an employment verification letter')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search knowledge base'), 'payroll');

    expect(screen.getByText('How payroll deductions are calculated')).toBeInTheDocument();
    expect(screen.queryByText('Requesting an employment verification letter')).not.toBeInTheDocument();
  });

  it('shows an empty state when no knowledge base articles match the search', async () => {
    renderEmployeeServices();

    expect(await screen.findByText('How payroll deductions are calculated')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search knowledge base'), 'nonexistent topic');

    expect(await screen.findByText('No articles match your search')).toBeInTheDocument();
  });
});
