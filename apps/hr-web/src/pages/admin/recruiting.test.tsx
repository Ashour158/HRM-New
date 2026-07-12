import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/i18n-provider';
import { AdminRecruiting } from './recruiting';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

const requisitionId = '00000000-0000-4000-8000-000000000101';
const candidateId = '00000000-0000-4000-8000-000000000201';
const screeningCandidateId = '00000000-0000-4000-8000-000000000202';
const offerId = '00000000-0000-4000-8000-000000000301';
const actorId = '00000000-0000-4000-8000-000000000099';
const interviewerWorkerId = '00000000-0000-4000-8000-000000000901';

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

beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = vi.fn();
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

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
          {
            id: screeningCandidateId,
            requisitionId,
            firstName: 'Yusuf',
            lastName: 'Nader',
            email: 'yusuf@example.com',
            status: 'SCREENING',
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
      if (url.startsWith('/hr/core/workers?search=')) {
        return apiResponse([
          {
            id: interviewerWorkerId,
            employeeId: 'EMP-901',
            firstName: 'Dana',
            lastName: 'Iqbal',
            email: 'dana.iqbal@example.com',
            hireDate: '2020-01-01',
            status: 'ACTIVE',
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

  it('requires a searched interviewer before scheduling and sends the selected interviewer and chosen time (not the actor\'s own id)', async () => {
    renderRecruiting();

    await screen.findByText('Yusuf Nader');
    await userEvent.click(screen.getByRole('button', { name: 'Schedule Interview' }));

    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Confirm Schedule' });

    // Cannot be submitted until a real interviewer has been searched and selected.
    expect(confirmButton).toBeDisabled();

    await userEvent.type(within(dialog).getByLabelText('Interviewers'), 'Dana');
    await userEvent.click(await within(dialog).findByText('Dana Iqbal'));

    expect(confirmButton).toBeEnabled();

    fireEvent.change(within(dialog).getByLabelText('Date & time'), { target: { value: '2026-08-01T10:30' } });

    await userEvent.click(confirmButton);

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/hr/recruiting/candidates/${screeningCandidateId}/commands/schedule-interview`,
      expect.objectContaining({
        command: 'schedule-interview',
        candidateId: screeningCandidateId,
        interviewerWorkerIds: [interviewerWorkerId],
        scheduledAt: new Date('2026-08-01T10:30').toISOString(),
        format: 'VIDEO',
      }),
    ));
    expect(apiClientPostMock).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ interviewerWorkerIds: [actorId] }),
    );
  });

  it('sends user-edited start date and benefits when creating an offer (not the previous hardcoded literals)', async () => {
    renderRecruiting();

    await screen.findByText('Mona Hassan');
    await userEvent.click(screen.getAllByRole('button', { name: 'Create Offer' })[0]);
    const dialog = await screen.findByRole('dialog');

    await userEvent.clear(within(dialog).getByLabelText('Proposed salary'));
    await userEvent.type(within(dialog).getByLabelText('Proposed salary'), '150000');

    fireEvent.change(within(dialog).getByLabelText('Start date'), { target: { value: '2026-09-15' } });
    await userEvent.type(within(dialog).getByLabelText('Benefits summary'), 'Health, dental, 25 PTO days');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Create Offer' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/hr/recruiting/offers',
      expect.objectContaining({
        applicationId: candidateId,
        proposedSalary: 150000,
        startDate: '2026-09-15',
        benefitsPackage: { summary: 'Health, dental, 25 PTO days' },
      }),
    ));
    expect(apiClientPostMock).not.toHaveBeenCalledWith(
      '/hr/recruiting/offers',
      expect.objectContaining({ benefitsPackage: { packageName: 'Standard employment benefits' } }),
    );
  });
});
