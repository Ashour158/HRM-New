import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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
