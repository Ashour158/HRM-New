import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/i18n-provider';
import { EmployeePulse } from './pulse';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());

const tenantId = '00000000-0000-0000-0000-000000000001';
const workerId = '00000000-0000-4000-8000-000000000501';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
  },
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: workerId,
      workerId,
      firstName: 'Maya',
      lastName: 'Hassan',
      roles: [{ id: 'role-1', name: 'EMPLOYEE' }],
    },
  }),
}));

vi.mock('@/hooks/use-tenant', () => ({
  useTenant: () => ({
    tenantId,
    tenantConfig: { currency: 'USD', timezone: 'UTC', dateFormat: 'MM/DD/YYYY', features: [] },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

describe('EmployeePulse accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === `/engagement/surveys/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: { value: '00000000-0000-4000-8000-000000000702' },
            title: 'Weekly pulse check',
            surveyType: 'PULSE',
            status: 'ACTIVE',
            anonymous: false,
            questions: [{ code: 'mood', label: 'How is your week going?' }],
          },
        ]);
      }
      return apiResponse([]);
    });
  });

  it('renders without accessibility violations', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <MemoryRouter>
            <EmployeePulse />
          </MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Pulse' })).toBeInTheDocument();
    expect(await screen.findByText('Weekly pulse check')).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
