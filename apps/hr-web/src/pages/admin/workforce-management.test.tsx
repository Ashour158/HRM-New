import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminWorkforceManagement } from './workforce-management';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

const tenantId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000099';
const workerId = '00000000-0000-4000-8000-000000000501';
const departmentId = '00000000-0000-4000-8000-000000000601';
const scheduleId = '00000000-0000-4000-8000-000000000701';
const openShiftId = '00000000-0000-4000-8000-000000000702';
const coverageGapId = '00000000-0000-4000-8000-000000000703';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
  },
}));

vi.mock('@/hooks/use-tenant', () => ({
  useTenant: () => ({
    tenantId,
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
      roles: [{ id: 'role-1', name: 'WORKFORCE_MANAGER' }],
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

function renderWorkforceManagement() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminWorkforceManagement />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminWorkforceManagement', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string, options?: { params?: { aggregateType?: string } }) => {
      if (url === '/policy/allowed-actions') {
        const aggregateType = options?.params?.aggregateType;
        if (aggregateType === 'ShiftSchedule') return apiResponse([{ id: 'publish', label: 'Publish schedule', action: 'publish' }]);
        if (aggregateType === 'CoverageGap') return apiResponse([{ id: 'notify', label: 'Notify coverage gap', action: 'notify' }]);
        return apiResponse([]);
      }
      if (url === `/workforce-management/shift-schedules/tenant/${tenantId}`) {
        return apiResponse([{ id: { value: scheduleId }, workerId, departmentId, workplaceCode: 'CAIRO_HQ', shiftDate: '2026-06-15', startTime: '2026-06-15T09:00:00.000Z', endTime: '2026-06-15T17:00:00.000Z', breakDuration: 60, status: 'DRAFT' }]);
      }
      if (url === `/workforce-management/open-shifts/tenant/${tenantId}`) {
        return apiResponse([{ id: { value: openShiftId }, departmentId, workplaceCode: 'CAIRO_HQ', shiftDate: '2026-06-15', startTime: '2026-06-15T18:00:00.000Z', endTime: '2026-06-15T23:00:00.000Z', requiredSkills: ['nurse'], status: 'OPEN' }]);
      }
      if (url === `/workforce-management/coverage-gaps/tenant/${tenantId}`) {
        return apiResponse([{ id: { value: coverageGapId }, departmentId, workplaceCode: 'CAIRO_HQ', shiftDate: '2026-06-15', startTime: '2026-06-15T18:00:00.000Z', endTime: '2026-06-15T23:00:00.000Z', requiredSkills: ['icu'], status: 'DETECTED' }]);
      }
      if (url.includes('/tenant/')) return apiResponse([]);
      if (url === `/workforce-management/shift-schedules/${scheduleId}`) {
        return apiResponse({ id: { value: scheduleId }, workerId, departmentId, workplaceCode: 'CAIRO_HQ', shiftDate: '2026-06-15', startTime: '2026-06-15T09:00:00.000Z', endTime: '2026-06-15T17:00:00.000Z', breakDuration: 60, status: 'DRAFT' });
      }
      return apiResponse({});
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: { id: 'created' } } });
  });

  it('loads shift operations through tenant-scoped queues', async () => {
    renderWorkforceManagement();

    expect(await screen.findByRole('heading', { name: 'Workforce Management' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Schedules' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Open Shifts' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Coverage' })).toBeInTheDocument();

    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith(`/workforce-management/shift-schedules/tenant/${tenantId}`));
    expect(apiClientGetMock).toHaveBeenCalledWith(`/workforce-management/open-shifts/tenant/${tenantId}`);
    expect(apiClientGetMock).toHaveBeenCalledWith(`/workforce-management/coverage-gaps/tenant/${tenantId}`);
    expect(apiClientGetMock).not.toHaveBeenCalledWith(expect.stringContaining('00000000-0000-0000-0000-000000000001'));
  });

  it('creates a shift schedule and runs allowed lifecycle commands', async () => {
    renderWorkforceManagement();

    expect(await screen.findByRole('button', { name: '2026-06-15 · CAIRO_HQ' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create Schedule' }));
    await userEvent.clear(screen.getByLabelText('Worker ID'));
    await userEvent.type(screen.getByLabelText('Worker ID'), workerId);
    await userEvent.clear(screen.getByLabelText('Department ID'));
    await userEvent.type(screen.getByLabelText('Department ID'), departmentId);
    await userEvent.click(screen.getByRole('button', { name: 'Save Schedule' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/workforce-management/shift-schedules',
      expect.objectContaining({ workerId, departmentId, workplaceCode: 'CAIRO_HQ', breakDuration: 60 }),
    ));

    await userEvent.click(screen.getByRole('button', { name: '2026-06-15 · CAIRO_HQ' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Publish schedule' }));
    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/workforce-management/shift-schedules/${scheduleId}/commands/publish`,
      {},
    ));
  });
});
