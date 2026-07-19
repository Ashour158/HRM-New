import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAccessGovernance } from './access-governance';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

const compensationFieldPolicy = {
  id: '00000000-0000-4000-8000-000000000301',
  fieldPath: 'worker.compensation.salary',
  dataClassification: 'SPECIAL_CATEGORY',
  roleDecisions: { HR_ADMIN: 'VISIBLE' },
  selfServiceDecision: 'HIDDEN',
  managerDecision: 'MASKED',
  maskingRule: 'CURRENCY_RANGE',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const learningFieldPolicy = {
  id: '00000000-0000-4000-8000-000000000302',
  fieldPath: 'worker.learning.transcript',
  dataClassification: 'CONFIDENTIAL',
  roleDecisions: { HR_ADMIN: 'VISIBLE' },
  selfServiceDecision: 'VISIBLE',
  managerDecision: 'VISIBLE',
  maskingRule: null,
  createdAt: '2026-01-02T00:00:00.000Z',
};

const summaryFixture = {
  roles: [],
  permissions: [],
  rolePermissions: [],
  userRoles: [],
  serviceAccounts: [],
  serviceAccountCredentials: [],
  accessReviewCampaigns: [],
  accessReviewItems: [],
  accessReviewWorkflowEvents: [],
  abacPolicies: [],
  fieldAccessPolicies: [compensationFieldPolicy, learningFieldPolicy],
  sodRules: [],
};

function renderAccessGovernance(initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AdminAccessGovernance />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminAccessGovernance entity query-param filtering', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/admin/access-governance') return apiResponse(summaryFixture);
      return apiResponse({});
    });
  });

  it('defaults to the Roles tab when no entity query param is present', async () => {
    renderAccessGovernance('/admin/system-console/access-governance');

    expect(await screen.findByRole('heading', { name: 'Access Governance' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Roles', selected: true })).toBeInTheDocument();
  });

  it('jumps to the Fields tab and pre-filters field policies by entity', async () => {
    renderAccessGovernance('/admin/system-console/access-governance?entity=compensation');

    expect(await screen.findByRole('tab', { name: 'Fields', selected: true })).toBeInTheDocument();
    expect(await screen.findByText('worker.compensation.salary')).toBeInTheDocument();
    expect(screen.queryByText('worker.learning.transcript')).not.toBeInTheDocument();
    expect(screen.getByText('Filtered to fields matching "compensation"')).toBeInTheDocument();
    expect(screen.getByDisplayValue('compensation.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Clear filter/ }));

    await waitFor(() => expect(screen.getByText('worker.learning.transcript')).toBeInTheDocument());
  });
});
