import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeOffboarding } from './offboarding';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const useApiQueryMock = vi.hoisted(() => vi.fn());
const useApiMutationMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());
const evidenceMutateMock = vi.hoisted(() => vi.fn());
const completeMutateMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
  },
}));

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
  useApiMutation: (...args: unknown[]) => useApiMutationMock(...args),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { firstName: 'Dana', lastName: 'Farouk' } }),
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
        <EmployeeOffboarding />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EmployeeOffboarding', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    useApiQueryMock.mockReset();
    useApiMutationMock.mockReset();
    addNotificationMock.mockReset();
    evidenceMutateMock.mockReset();
    completeMutateMock.mockReset();

    useApiQueryMock.mockReturnValue({
      data: {
        id: workerId,
        employeeId: 'EMP-201',
        firstName: 'Dana',
        lastName: 'Farouk',
        email: 'dana.farouk@example.com',
        hireDate: '2023-01-01',
        status: 'TERMINATED',
        jobTitle: 'Analyst',
        departmentName: 'Finance',
      },
    });
    useApiMutationMock.mockImplementation((url: unknown) => {
      const target = typeof url === 'function' ? url({ id: taskId }) : url;
      if (typeof target === 'string' && target.includes('/evidence')) {
        return { mutate: evidenceMutateMock, isPending: false };
      }
      return { mutate: completeMutateMock, isPending: false };
    });

    apiClientGetMock.mockImplementation((url: string) => {
      if (url === `/hr/offboarding/plans/worker/${workerId}`) {
        return apiResponse({
          id: planId,
          workerId,
          lastWorkingDay: '2026-08-01T00:00:00.000Z',
          status: 'ACTIVE',
          reasonCategory: 'RESIGNATION',
        });
      }
      if (url === `/hr/offboarding/tasks/plan/${planId}`) {
        return apiResponse([
          {
            id: taskId,
            offboardingPlanId: planId,
            title: 'Return company assets',
            ownerGroup: 'FACILITIES',
            category: 'ASSET_RETURN',
            status: 'PENDING',
            dueDate: '2026-08-01T00:00:00.000Z',
          },
        ]);
      }
      return apiResponse({});
    });
  });

  it('renders the exit checklist for the departing employee', async () => {
    renderOffboarding();

    expect(await screen.findByText(/Offboarding checklist for Dana/)).toBeInTheDocument();
    expect(await screen.findByText('Return company assets')).toBeInTheDocument();
    expect(screen.getAllByText(/RESIGNATION/i).length).toBeGreaterThan(0);
  });

  it('completes an exit task from the employee portal', async () => {
    const user = userEvent.setup();
    renderOffboarding();

    await screen.findByText('Return company assets');
    const completeButtons = screen.getAllByRole('button', { name: /complete/i });
    await user.click(completeButtons[0]);

    expect(completeMutateMock).toHaveBeenCalledWith({ id: taskId });
  });

  it('submits a knowledge-transfer handover note as evidence', async () => {
    const user = userEvent.setup();
    renderOffboarding();

    await screen.findByText('Return company assets');
    await user.click(screen.getByRole('tab', { name: 'Knowledge Transfer' }));
    await user.type(screen.getByPlaceholderText(/handover recipients/i), 'Handed active tickets to teammate');
    await user.click(screen.getByRole('button', { name: 'Submit note' }));

    await waitFor(() => expect(evidenceMutateMock).toHaveBeenCalledWith(expect.objectContaining({
      completionNotes: 'Handed active tickets to teammate',
      completeTask: true,
    })));
  });
});
