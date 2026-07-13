import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminWorkers } from './workers';

const useApiQueryMock = vi.fn();
const useApiMutationMock = vi.fn();
const addNotificationMock = vi.fn();
const terminateMutateAsyncMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
  useApiMutation: (...args: unknown[]) => useApiMutationMock(...args),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

vi.mock('@/components/common/next-actions', () => ({
  NextActions: () => null,
}));

const workerId = '00000000-0000-4000-8000-000000000201';

function renderWorkers() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminWorkers />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminWorkers termination flow', () => {
  beforeEach(() => {
    useApiQueryMock.mockReset();
    useApiMutationMock.mockReset();
    addNotificationMock.mockReset();
    terminateMutateAsyncMock.mockClear();

    useApiQueryMock.mockReturnValue({
      data: [
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
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    useApiMutationMock.mockImplementation((url: unknown) => {
      const target = typeof url === 'function' ? url({ workerId }) : url;
      if (typeof target === 'string' && target.includes('/commands/terminate')) {
        return { mutateAsync: terminateMutateAsyncMock, isPending: false };
      }
      return { mutateAsync: vi.fn(), isPending: false };
    });
  });

  it('opens a real modal dialog instead of window.prompt when terminating an employee', async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, 'prompt');
    renderWorkers();

    await user.click(screen.getByRole('button', { name: 'Terminate employee' }));

    expect(promptSpy).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Terminate employee' })).toBeInTheDocument();
    promptSpy.mockRestore();
  });

  it('requires a non-empty reason before the terminate button is enabled', async () => {
    const user = userEvent.setup();
    renderWorkers();

    await user.click(screen.getByRole('button', { name: 'Terminate employee' }));
    await screen.findByRole('dialog');

    const dialogConfirmButton = screen.getByRole('button', { name: 'Confirm termination' });
    expect(dialogConfirmButton).toBeDisabled();

    await user.type(screen.getByLabelText('Termination reason'), 'Resignation - relocating');
    expect(dialogConfirmButton).not.toBeDisabled();
  });

  it('submits the typed reason through the terminate command instead of window.prompt', async () => {
    const user = userEvent.setup();
    renderWorkers();

    await user.click(screen.getByRole('button', { name: 'Terminate employee' }));
    await screen.findByRole('dialog');
    await user.type(screen.getByLabelText('Termination reason'), 'Resignation - relocating');
    await user.click(screen.getByRole('button', { name: 'Confirm termination' }));

    await waitFor(() => expect(terminateMutateAsyncMock).toHaveBeenCalledWith(expect.objectContaining({
      workerId,
      reason: 'Resignation - relocating',
    })));
  });
});
