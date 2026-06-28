import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/i18n-provider';
import { AdminRecruiting } from './recruiting';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

const requisitionId = '00000000-0000-4000-8000-000000000101';
const candidateId = '00000000-0000-4000-8000-000000000201';
const offerId = '00000000-0000-4000-8000-000000000301';
const actorId = '00000000-0000-4000-8000-000000000099';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
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
      id: actorId,
      roles: [{ id: 'role-1', name: 'HR_ADMIN' }],
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

function renderRecruiting() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter>
          <AdminRecruiting />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('AdminRecruiting', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
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
      if (url === `/hr/recruiting/requisitions/${requisitionId}`) {
        return apiResponse({
          id: requisitionId,
          requisitionNumber: 'REQ-001',
          positionId: '00000000-0000-4000-8000-000000000901',
          title: 'Senior Nurse',
          status: 'OPEN',
        });
      }
      if (url === `/hr/recruiting/candidates?requisition=${requisitionId}`) {
        return apiResponse([
          {
            id: candidateId,
            requisitionId,
            firstName: 'Mona',
            lastName: 'Hassan',
            email: 'mona@example.com',
            status: 'INTERVIEWING',
          },
        ]);
      }
      if (url === `/hr/recruiting/offers?requisition=${requisitionId}`) {
        return apiResponse([
          {
            id: offerId,
            candidateId,
            requisitionId,
            proposedSalary: 120000,
            currency: 'AED',
            startDate: '2026-08-01T00:00:00.000Z',
            status: 'PENDING_APPROVAL',
          },
        ]);
      }
      return apiResponse([]);
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: { newState: 'APPROVED', allowedNextActions: ['send'] } } });
  });

  it('renders requisitions, pipeline, offers, and creates an offer through the real recruiting API path', async () => {
    renderRecruiting();

    expect(await screen.findByRole('heading', { level: 1, name: 'Recruiting' })).toBeInTheDocument();
    expect((await screen.findAllByText('Senior Nurse')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Mona Hassan')).toBeInTheDocument();
    expect((await screen.findAllByText(/120,000/)).length).toBeGreaterThan(0);

    await userEvent.click(screen.getAllByRole('button', { name: 'Create Offer' })[0]);
    await userEvent.clear(screen.getByLabelText('Proposed salary'));
    await userEvent.type(screen.getByLabelText('Proposed salary'), '145000');
    const createOfferButtons = screen.getAllByRole('button', { name: 'Create Offer' });
    await userEvent.click(createOfferButtons[createOfferButtons.length - 1]);

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/hr/recruiting/offers',
      expect.objectContaining({
        applicationId: candidateId,
        proposedSalary: 145000,
        currency: 'AED',
      }),
    ));
  });

  it('runs offer approval through the offer command endpoint', async () => {
    renderRecruiting();

    expect((await screen.findAllByText('Senior Nurse')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Approve Offer' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/hr/recruiting/offers/${offerId}/commands/approve`,
      expect.objectContaining({
        command: 'approve',
        offerId,
      }),
    ));
  });
});
