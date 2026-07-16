import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminEventContracts } from './event-contracts';

const apiClientGetMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
  },
}));

const registry = {
  topics: ['hcm.core.v1'],
  topicMappings: {
    Employee: 'hcm.core.v1',
    LeaveRequest: 'hcm.leave.v1',
  },
  eventPrefixMappings: [['employee.', 'hcm.core.v1']],
  defaults: {
    topic: 'hcm.core.v1',
    eventSchemaVersion: 1,
    envelopeVersion: 1,
  },
  consumerGroupNaming: {
    convention: '{domain}-{purpose}-v{version}',
    domainExample: 'payroll',
    purposeExample: 'ledger-sync',
    versionExample: 1,
    example: 'payroll-ledger-sync-v1',
  },
};

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

describe('AdminEventContracts accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation(() => apiResponse(registry));
  });

  it('renders without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminEventContracts />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Event Contracts' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/admin/event-contracts/registry'));
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
