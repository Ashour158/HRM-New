import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdminModuleOperations } from './module-operations';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    patch: vi.fn(),
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

function workspace() {
  return {
    moduleId: 'benefits',
    records: [enrollmentRecord],
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

function renderOperations() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  apiClientGetMock.mockResolvedValue({ data: { success: true, data: workspace() } });

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

describe('AdminModuleOperations accessibility', () => {
  it('renders without accessibility violations', async () => {
    apiClientGetMock.mockReset();
    addNotificationMock.mockReset();
    const { container } = renderOperations();

    expect(await screen.findByRole('heading', { name: /Benefits Operations/i })).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
