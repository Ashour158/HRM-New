import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAccessGovernance } from './access-governance';

const apiClientGetMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

const emptyAccessGovernanceSummary = {
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
  fieldAccessPolicies: [],
  sodRules: [],
};

describe('AdminAccessGovernance accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/admin/access-governance') return apiResponse(emptyAccessGovernanceSummary);
      return apiResponse([]);
    });
  });

  it('renders the roles tab without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminAccessGovernance />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Access Governance' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Roles' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/admin/access-governance'));
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
