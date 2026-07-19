import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminEmployeeProfile } from './employee-profile';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

const workerId = '00000000-0000-4000-8000-000000000001';

const profileData = {
  worker: {
    id: workerId,
    employeeId: 'EMP-001',
    firstName: 'Amina',
    lastName: 'Nour',
    email: 'amina@example.com',
    hireDate: '2024-01-01T00:00:00.000Z',
    status: 'ACTIVE',
  },
  basic: {},
  contact: {},
  emergencyContact: {},
  background: {},
  compensation: {},
  documents: {},
  governance: { dataClassification: 'INTERNAL', personalDataRecords: [] },
};

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

function renderProfile() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/admin/employees/${workerId}`]}>
        <Routes>
          <Route path="/admin/employees/:id" element={<AdminEmployeeProfile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminEmployeeProfile lifecycle dialogs', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === `/hr/core/workers/${workerId}/profile`) return apiResponse(profileData);
      if (url === `/hr/core/workers/${workerId}/master-profile`) return apiResponse({});
      if (url === '/audit') return apiResponse([]);
      if (url === '/policy/allowed-actions') return apiResponse([]);
      return apiResponse({});
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: {} } });
  });

  it('opens the terminate dialog and blocks submit until a reason is entered', async () => {
    renderProfile();

    const terminateButton = await screen.findByRole('button', { name: /terminate/i }, { timeout: 5000 });
    await userEvent.click(terminateButton);

    const dialog = await screen.findByRole('dialog', { name: 'Terminate employee' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Terminate' }));
    expect(await within(dialog).findByText('This field is required.')).toBeInTheDocument();
    expect(apiClientPostMock).not.toHaveBeenCalled();
  });

  it('submits the termination reason to the terminate command with the expected payload', async () => {
    renderProfile();

    await userEvent.click(await screen.findByRole('button', { name: /terminate/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Terminate employee' });
    await userEvent.type(within(dialog).getByLabelText('Termination reason'), 'Role redundancy');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Terminate' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/hr/core/workers/${workerId}/commands/terminate`,
      expect.objectContaining({ employeeId: workerId, reason: 'Role redundancy' }),
    ));
    expect(addNotificationMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'success', title: 'Employee terminated' }));
  });

  it('submits the suspension reason to the suspend command with the expected payload', async () => {
    renderProfile();

    await userEvent.click(await screen.findByRole('button', { name: /suspend/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Suspend employee' });
    await userEvent.type(within(dialog).getByLabelText('Suspension reason'), 'Under investigation');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/hr/core/workers/${workerId}/commands/suspend`,
      expect.objectContaining({ employeeId: workerId, reason: 'Under investigation' }),
    ));
  });

  it('cancel closes the terminate dialog without calling the terminate command', async () => {
    renderProfile();

    await userEvent.click(await screen.findByRole('button', { name: /terminate/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Terminate employee' });
    await userEvent.type(within(dialog).getByLabelText('Termination reason'), 'Would have been valid');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Terminate employee' })).not.toBeInTheDocument());
    expect(apiClientPostMock).not.toHaveBeenCalled();
  });
});
