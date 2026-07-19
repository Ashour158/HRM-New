import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/i18n-provider';
import { AdminPolicies } from './policies';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

const tenantId = '00000000-0000-4000-8000-000000000001';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
    patch: vi.fn(),
  },
}));

vi.mock('@/hooks/use-tenant', () => ({
  useTenant: () => ({
    tenantId,
    tenantName: 'Acme Health',
    tenantConfig: { currency: 'AED', dateFormat: 'DD/MM/YYYY', timezone: 'Asia/Dubai', features: [] },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

const payrollRevision = {
  id: '00000000-0000-4000-8000-000000000201',
  area: 'PAYROLL',
  title: 'Payroll tax update',
  status: 'DRAFT',
  scope: {},
  draftConfig: {},
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const leaveRevision = {
  id: '00000000-0000-4000-8000-000000000202',
  area: 'LEAVE',
  title: 'Leave accrual update',
  status: 'DRAFT',
  scope: {},
  draftConfig: {},
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function renderPolicies(initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <AdminPolicies />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('AdminPolicies area query-param filtering', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/admin/policies/summary') {
        return apiResponse({ totalRevisions: 2, byStatus: { DRAFT: 2 }, byArea: { PAYROLL: 1, LEAVE: 1 } });
      }
      if (url === '/admin/policies/revisions') return apiResponse([payrollRevision, leaveRevision]);
      if (url === '/admin/policies/templates') return apiResponse([]);
      return apiResponse({});
    });
  });

  it('shows every revision when no area query param is present', async () => {
    renderPolicies('/admin/system-console/policies');

    expect(await screen.findByText('Payroll tax update')).toBeInTheDocument();
    expect(await screen.findByText('Leave accrual update')).toBeInTheDocument();
    expect(screen.queryByText(/Filtered to/)).not.toBeInTheDocument();
  });

  it('pre-filters revisions to the requested policy area and can clear the filter', async () => {
    renderPolicies('/admin/system-console/policies?area=PAYROLL');

    expect(await screen.findByText('Payroll tax update')).toBeInTheDocument();
    expect(screen.queryByText('Leave accrual update')).not.toBeInTheDocument();
    expect(screen.getByText('Filtered to PAYROLL policies')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Clear filter/ }));

    await waitFor(() => expect(screen.getByText('Leave accrual update')).toBeInTheDocument());
    expect(screen.queryByText(/Filtered to/)).not.toBeInTheDocument();
  });

  it('pre-fills the new policy area from an unknown or invalid area param without crashing', async () => {
    renderPolicies('/admin/system-console/policies?area=not-a-real-area');

    expect(await screen.findByText('Payroll tax update')).toBeInTheDocument();
    expect(await screen.findByText('Leave accrual update')).toBeInTheDocument();
    expect(screen.queryByText(/Filtered to/)).not.toBeInTheDocument();
  });
});
