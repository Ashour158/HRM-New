import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeLearning } from './learning';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

const workerId = '00000000-0000-4000-8000-000000000501';
const assignmentId = '00000000-0000-4000-8000-000000000601';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
  },
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: workerId,
      workerId,
      firstName: 'Maya',
      lastName: 'Hassan',
      roles: [{ id: 'role-1', name: 'EMPLOYEE' }],
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

function renderLearning() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EmployeeLearning />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EmployeeLearning', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === `/learning/assignments/worker/${workerId}`) {
        return apiResponse([
          {
            id: { value: assignmentId },
            courseTitle: 'Clinical onboarding essentials',
            courseId: '00000000-0000-4000-8000-000000000101',
            status: 'ASSIGNED',
            dueDate: '2026-07-01T00:00:00.000Z',
            score: null,
          },
        ]);
      }
      if (url === `/learning/certifications/worker/${workerId}`) {
        return apiResponse([
          {
            id: { value: '00000000-0000-4000-8000-000000000701' },
            certificationName: 'BLS Certification',
            issuingBody: 'Health Authority',
            status: 'ACTIVE',
            expiryDate: '2027-01-10T00:00:00.000Z',
          },
        ]);
      }
      return apiResponse({});
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: { allowedNextActions: [] } } });
  });

  it('renders employee assignments and certifications with learning actions', async () => {
    renderLearning();

    expect(await screen.findByRole('heading', { name: 'My Learning' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'My Assignments' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'My Certifications' })).toBeInTheDocument();
    expect(await screen.findByText('Clinical onboarding essentials')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Start Clinical onboarding essentials' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/learning/assignments/${assignmentId}/commands/start`,
      {},
    ));

    await userEvent.click(screen.getByRole('button', { name: 'Complete Clinical onboarding essentials' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/learning/assignments/${assignmentId}/commands/complete`,
      { score: 100 },
    ));

    await userEvent.click(screen.getByRole('tab', { name: 'My Certifications' }));
    expect(await screen.findByText('BLS Certification')).toBeInTheDocument();
  });
});
