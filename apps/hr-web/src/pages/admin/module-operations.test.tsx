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
      {
        ...enrollmentRecord,
        id: '00000000-0000-0000-0000-000000000203',
        status: 'Active',
        lastEvent: 'Enrollment approved',
        payload: { nativeStatus: 'APPROVED' },
      },
      {
        ...enrollmentRecord,
        id: '00000000-0000-0000-0000-000000000204',
        status: 'Active',
        lastEvent: 'Enrollment effective',
        payload: { nativeStatus: 'EFFECTIVE' },
      },
    ]);
    await openRecordsTab();

    expect(await screen.findByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /process/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /make effective/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /terminate/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /reject/i })).toHaveLength(2);
  });

  it('sends an explicit make-effective action for approved benefits enrollment native records', async () => {
    const approvedEnrollment = {
      ...enrollmentRecord,
      status: 'Active',
      lastEvent: 'Enrollment approved',
      payload: { nativeStatus: 'APPROVED' },
    };
    apiClientPatchMock.mockResolvedValue({
      data: {
        success: true,
        data: { ...approvedEnrollment, lastEvent: 'Enrollment made effective' },
      },
    });
    renderOperations([approvedEnrollment]);
    await openRecordsTab();

    await userEvent.click(await screen.findByRole('button', { name: /make effective/i }));

    await waitFor(() => expect(apiClientPatchMock).toHaveBeenCalledWith(
      '/admin/module-operations/benefits/records/00000000-0000-0000-0000-000000000201',
      expect.objectContaining({
        status: 'Active',
        operationAction: 'make-effective',
        lastEvent: 'Enrollment made effective',
      }),
    ));
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

  it('renders the workspace summary stats through the shared StatTile component', async () => {
    renderOperations([enrollmentRecord]);

    await waitFor(() => expect(screen.getByText('Live Records').closest('div')).toHaveTextContent('1'));
    expect(screen.getByText('Live Workflows').closest('div')).toHaveTextContent('0');
    expect(screen.getByText('Blocked Items').closest('div')).toHaveTextContent('0');
    expect(screen.getByText('Event Hooks').closest('div')).toHaveTextContent('4');
    expect(screen.getByText('Persisted operational records in this workspace')).toBeInTheDocument();
  });

  it('keeps raw record and native identifiers in advanced diagnostics instead of the default records view', async () => {
    renderOperations([enrollmentRecord]);
    await openRecordsTab();

    expect(await screen.findByText('Enrollment')).toBeInTheDocument();
    expect(screen.queryByText('00000000-0000-0000-0000-000000000201')).not.toBeInTheDocument();
    expect(screen.queryByText(/Native:/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /native only/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^native$/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Advanced Diagnostics'));

    expect(screen.getByText(/Record ID:/i)).toBeInTheDocument();
    expect(screen.getByText(/Native ID:/i)).toBeInTheDocument();
    expect(screen.getByText('00000000-0000-0000-0000-000000000201')).toBeInTheDocument();
    expect(screen.getByText('00000000-0000-0000-0000-000000000901')).toBeInTheDocument();
  });
});
