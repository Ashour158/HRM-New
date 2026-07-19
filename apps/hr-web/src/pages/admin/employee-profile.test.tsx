import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminEmployeeProfile } from './employee-profile';
import { DEFAULT_HCM_SETUP } from '@/lib/hcm-setup-defaults';
import type { EmployeeProfileData } from '@/types';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPatchMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    patch: apiClientPatchMock,
    post: apiClientPostMock,
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) =>
    selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

function renderProfileFor(workerId: string) {
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

describe('AdminEmployeeProfile custom fields', () => {
  const workerId = '550e8400-e29b-41d4-a716-446655440001';

  const profile: EmployeeProfileData = {
    worker: {
      id: workerId,
      employeeId: 'EMP-001',
      firstName: 'Amina',
      lastName: 'Hassan',
      email: 'amina@example.com',
      hireDate: '2026-01-01',
      status: 'ACTIVE',
    },
    basic: {},
    contact: {},
    emergencyContact: {},
    background: {},
    compensation: {},
    documents: {},
    governance: { dataClassification: 'CONFIDENTIAL', personalDataRecords: [] },
  };

  const setupWithCustomField = {
    ...DEFAULT_HCM_SETUP,
    fieldRules: [
      ...DEFAULT_HCM_SETUP.fieldRules,
      { fieldKey: 'badgeColor', label: 'Badge Color', section: 'Custom', required: false, active: true, fieldType: 'TEXT' as const },
    ],
  };

  function renderPage(masterProfile: Record<string, unknown>) {
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === `/hr/core/workers/${workerId}/profile`) return apiResponse(profile);
      if (url === `/hr/core/workers/${workerId}/master-profile`) return apiResponse(masterProfile);
      if (url === '/admin/hcm-setup') return apiResponse(setupWithCustomField);
      return apiResponse([]);
    });

    return renderProfileFor(workerId);
  }

  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPatchMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientPatchMock.mockResolvedValue({ data: { success: true, data: { workerId, dataCategory: 'CUSTOM' } } });
  });

  it('displays a previously saved custom field value from the master profile', async () => {
    renderPage({
      worker: profile.worker,
      profileSections: { CUSTOM: { badgeColor: 'Blue' } },
      governance: { dataClassification: 'CONFIDENTIAL', personalDataRecords: [] },
    });

    expect(await screen.findByText('Blue')).toBeInTheDocument();
  });

  it('lets an admin fill and save a genuinely new custom field, persisting it via the profile-sections API', async () => {
    const user = userEvent.setup();
    renderPage({
      worker: profile.worker,
      profileSections: {},
      governance: { dataClassification: 'CONFIDENTIAL', personalDataRecords: [] },
    });

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Badge Color'), 'Green');
    await user.click(screen.getByRole('button', { name: 'Save Custom Fields' }));

    await waitFor(() => expect(apiClientPatchMock).toHaveBeenCalledWith(
      `/hr/core/workers/${workerId}/profile-sections/custom`,
      { badgeColor: 'Green' },
    ));
  });
});

describe('AdminEmployeeProfile lifecycle dialogs', () => {
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

  function renderProfile() {
    return renderProfileFor(workerId);
  }

  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPatchMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === `/hr/core/workers/${workerId}/profile`) return apiResponse(profileData);
      if (url === `/hr/core/workers/${workerId}/master-profile`) return apiResponse({});
      if (url === '/admin/hcm-setup') return apiResponse(DEFAULT_HCM_SETUP);
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
