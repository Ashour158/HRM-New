import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminWorkers } from './workers';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
    patch: vi.fn(),
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

const activeWorker = {
  id: '00000000-0000-4000-8000-000000000010',
  employeeId: 'EMP-010',
  firstName: 'Sara',
  lastName: 'Khalil',
  email: 'sara@example.com',
  hireDate: '2024-03-01T00:00:00.000Z',
  status: 'ACTIVE',
};

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

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

describe('AdminWorkers terminate dialog', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url.startsWith('/hr/core/workers?')) return apiResponse([activeWorker]);
      return apiResponse({});
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: {} } });
  });

  it('opens a scoped terminate dialog for the row and blocks submit until a reason is entered', async () => {
    renderWorkers();

    const terminateButton = await screen.findByRole('button', { name: 'Terminate employee' }, { timeout: 5000 });
    await userEvent.click(terminateButton);

    const dialog = await screen.findByRole('dialog', { name: 'Terminate Sara Khalil' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Terminate' }));
    expect(await within(dialog).findByText('This field is required.')).toBeInTheDocument();
    expect(apiClientPostMock).not.toHaveBeenCalled();
  });

  it('submits the termination reason with the correct worker id payload', async () => {
    renderWorkers();

    await userEvent.click(await screen.findByRole('button', { name: 'Terminate employee' }));
    const dialog = await screen.findByRole('dialog', { name: 'Terminate Sara Khalil' });
    await userEvent.type(within(dialog).getByLabelText('Termination reason'), 'Performance issues');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Terminate' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/hr/core/workers/${activeWorker.id}/commands/terminate`,
      expect.objectContaining({ workerId: activeWorker.id, reason: 'Performance issues' }),
    ));
    expect(addNotificationMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'success', title: 'Employee terminated' }));
  });

  it('cancel closes the dialog without calling the terminate command', async () => {
    renderWorkers();

    await userEvent.click(await screen.findByRole('button', { name: 'Terminate employee' }));
    const dialog = await screen.findByRole('dialog', { name: 'Terminate Sara Khalil' });
    await userEvent.type(within(dialog).getByLabelText('Termination reason'), 'Would have been valid');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(apiClientPostMock).not.toHaveBeenCalled();
  });
});
