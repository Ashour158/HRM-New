import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPerformance } from './performance';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

const tenantId = '00000000-0000-4000-8000-000000000001';
const workerId = '00000000-0000-4000-8000-000000000011';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
  },
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: '00000000-0000-4000-8000-000000000099',
      tenantId,
      roles: [{ id: 'role-1', name: 'PERFORMANCE_ADMIN' }],
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

const cycles = [
  { id: 'cycle-1', name: 'H1 2026 Review', cycleYear: 2026, startDate: '2026-01-01', endDate: '2026-06-30', reviewType: 'ANNUAL', status: 'ACTIVE' },
  { id: 'cycle-2', name: 'H2 2025 Review', cycleYear: 2025, startDate: '2025-07-01', endDate: '2025-12-31', reviewType: 'ANNUAL', status: 'CLOSED' },
];

const templates = [
  { id: 'template-1', name: 'Standard Template', status: 'ACTIVE' },
  { id: 'template-2', name: 'Draft Template', status: 'DRAFT' },
];

const competencies = [
  { id: 'competency-1', name: 'Communication', category: 'Core', status: 'ACTIVE' },
];

const workers = [{ id: workerId, firstName: 'Ada', lastName: 'Lovelace' }];

function renderAdminPerformance() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  apiClientGetMock.mockImplementation((url: string) => {
    if (url === `/performance/review-cycles/tenant/${tenantId}`) return apiResponse(cycles);
    if (url === `/performance/review-templates/tenant/${tenantId}`) return apiResponse(templates);
    if (url === `/performance/competencies/tenant/${tenantId}`) return apiResponse(competencies);
    if (url === '/hr/core/workers?page=1&pageSize=100') return apiResponse(workers);
    if (url.startsWith('/performance/goals/worker/')) return apiResponse([]);
    if (url.startsWith('/performance/analytics/manager/')) {
      return apiResponse({
        reportCount: 3,
        analytics: {
          goalMetrics: { averageProgress: 42, atRisk: 1 },
          recognitions: [],
        },
      });
    }
    return apiResponse([]);
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminPerformance />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminPerformance', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
  });

  it('renders the review-cycle summary stats through the shared StatTile component', async () => {
    renderAdminPerformance();

    expect(await screen.findByRole('heading', { name: 'Performance Management' })).toBeInTheDocument();

    // Two cycles total, only one ACTIVE; one of two templates ACTIVE; one ACTIVE competency.
    await waitFor(() => expect(screen.getByText('Review Cycles', { selector: 'p' }).closest('div')).toHaveTextContent('2'));
    expect(screen.getByText('Active Cycles').closest('div')).toHaveTextContent('1');
    expect(screen.getByText('Published Templates').closest('div')).toHaveTextContent('1');
    expect(screen.getByText('Active Competencies').closest('div')).toHaveTextContent('1');
  });
});
