import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminModuleOperations } from './module-operations';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPatchMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    patch: apiClientPatchMock,
    post: vi.fn(),
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

const enrollmentRecord = {
  id: '00000000-0000-0000-0000-000000000201',
  objectType: 'Enrollment',
  ownerRole: 'Benefits Admin',
  workflowName: 'Enroll in benefits',
  status: 'In Review',
  risk: 'Medium',
  lastEvent: 'Enrollment submitted',
  source: 'native',
  nativeSource: 'benefits_enrollments',
  nativeId: '00000000-0000-0000-0000-000000000901',
  nativeRoute: '/admin/modules/benefits/operations',
  payload: {},
  aggregateVersion: 1,
  createdAt: '2026-06-10T09:00:00.000Z',
  updatedAt: '2026-06-10T09:00:00.000Z',
};

const lifeEventRecord = {
  ...enrollmentRecord,
  id: '00000000-0000-0000-0000-000000000202',
  objectType: 'Life event',
  workflowName: 'Process life event',
  lastEvent: 'Life event submitted',
  nativeSource: 'benefits_life_events',
  nativeId: '00000000-0000-0000-0000-000000000902',
};

function workspace(records = [enrollmentRecord, lifeEventRecord]) {
  return {
    moduleId: 'benefits',
    records,
    workflows: [],
    controls: [],
    moduleDepth: {
      score: 80,
      status: 'Ready',
      capabilities: [],
      blockers: [],
      nextActions: [],
    },
  };
}

function renderOperations(records = [enrollmentRecord, lifeEventRecord]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  apiClientGetMock.mockResolvedValue({ data: { success: true, data: workspace(records) } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/modules/benefits/operations']}>
        <Routes>
          <Route path="/admin/modules/:moduleId/operations" element={<AdminModuleOperations />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openRecordsTab() {
  await userEvent.click(await screen.findByRole('tab', { name: /records/i }));
}

describe('AdminModuleOperations benefits actions', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPatchMock.mockReset();
    addNotificationMock.mockReset();
  });

  it('shows explicit benefits lifecycle action labels instead of a single advance button', async () => {
    renderOperations([
      enrollmentRecord,
      lifeEventRecord,
      { ...enrollmentRecord, id: '00000000-0000-0000-0000-000000000203', status: 'Active', lastEvent: 'Enrollment approved' },
    ]);
    await openRecordsTab();

    expect(await screen.findByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /process/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /terminate/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /reject/i })).toHaveLength(2);
  });

  it('sends an explicit reject action for benefits enrollment native records', async () => {
    apiClientPatchMock.mockResolvedValue({
      data: {
        success: true,
        data: { ...enrollmentRecord, status: 'Blocked', lastEvent: 'Enrollment rejected' },
      },
    });
    renderOperations([enrollmentRecord]);
    await openRecordsTab();

    await userEvent.click(await screen.findByRole('button', { name: /reject/i }));

    await waitFor(() => expect(apiClientPatchMock).toHaveBeenCalledWith(
      '/admin/module-operations/benefits/records/00000000-0000-0000-0000-000000000201',
      expect.objectContaining({
        status: 'Blocked',
        operationAction: 'reject',
        lastEvent: 'Enrollment rejected',
      }),
    ));
  });
});
