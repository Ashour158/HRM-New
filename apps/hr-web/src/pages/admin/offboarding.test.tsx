import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminOffboarding } from './offboarding';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

// jsdom does not implement pointer capture / scrollIntoView, which the
// Radix Select used for "Departing worker" relies on when opening.
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

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

const workerId = '00000000-0000-4000-8000-000000000201';
const planId = '00000000-0000-4000-8000-000000000301';
const taskId = '00000000-0000-4000-8000-000000000401';

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

function renderOffboarding() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminOffboarding />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminOffboarding', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url.startsWith('/hr/core/workers')) {
        return apiResponse([
          {
            id: workerId,
            employeeId: 'EMP-201',
            firstName: 'Dana',
            lastName: 'Farouk',
            email: 'dana.farouk@example.com',
            hireDate: '2023-01-01',
            status: 'ACTIVE',
            jobTitle: 'Analyst',
            departmentName: 'Finance',
          },
        ]);
      }
      if (url === '/hr/offboarding/plans') {
        return apiResponse([
          {
            id: planId,
            workerId,
            lastWorkingDay: '2026-08-01T00:00:00.000Z',
            status: 'ACTIVE',
            reasonCategory: 'RESIGNATION',
            initiatedBy: workerId,
          },
        ]);
      }
      if (url === `/hr/offboarding/tasks/plan/${planId}`) {
        return apiResponse([
          {
            id: taskId,
            offboardingPlanId: planId,
            title: 'Confirm badge and laptop returned to facilities',
            ownerGroup: 'FACILITIES',
            category: 'ASSET_RETURN',
            status: 'PENDING',
            dueDate: '2026-08-01T00:00:00.000Z',
          },
        ]);
      }
      return apiResponse({});
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: { allowedNextActions: [] } } });
  });

  it('renders the exit queue, checklist tab, and owner-group breakdown', async () => {
    renderOffboarding();

    expect(await screen.findByRole('heading', { name: 'Offboarding Operations' })).toBeInTheDocument();
    expect((await screen.findAllByText('Dana Farouk')).length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Checklist' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Owner Groups' })).toBeInTheDocument();
    expect(await screen.findByText('Confirm badge and laptop returned to facilities')).toBeInTheDocument();
  });

  it('launches a new exit plan for a departing worker', async () => {
    // Radix Select's popper measurement can transiently leave a stale
    // pointer-events lock on the body in jsdom right after mount; disable
    // that check for this interaction, the click itself is still a real,
    // single user action.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderOffboarding();

    await screen.findAllByText('Dana Farouk');
    await user.click(screen.getByText('Select worker'));
    await user.click(await screen.findByRole('option', { name: /Dana Farouk - EMP-201/ }));
    await user.click(screen.getByRole('button', { name: 'Launch exit plan' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/hr/offboarding/plans',
      expect.objectContaining({
        workerId,
        reasonCategory: 'RESIGNATION',
      }),
    ));
  });

  it('completes a checklist task from the admin workbench', async () => {
    const user = userEvent.setup();
    renderOffboarding();

    await screen.findByText('Confirm badge and laptop returned to facilities');
    await user.click(screen.getByRole('button', { name: 'Mark complete' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/hr/offboarding/tasks/${taskId}/commands/complete`,
      expect.anything(),
    ));
  });
});
