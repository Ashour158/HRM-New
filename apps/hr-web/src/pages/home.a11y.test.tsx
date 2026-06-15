import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/i18n-provider';
import { HomePage } from './home';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: vi.fn(),
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

describe('HomePage accessibility', () => {
  it('renders the proactive feed without accessibility violations', async () => {
    apiClientGetMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          generatedAt: '2026-06-15T10:00:00.000Z',
          sections: [
            {
              key: 'approvals',
              title: 'Approvals',
              count: 1,
              items: [
                {
                  id: 'approval-1',
                  title: 'ApproveAbsenceRequest',
                  severity: 'DUE',
                  deepLink: '/manager/approvals?chain=approval-1',
                  actions: [{ label: 'Approve', commandPath: '/approval/approve' }],
                },
              ],
            },
          ],
        },
      },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

    const { container, findByText } = render(
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>
        </QueryClientProvider>
      </I18nProvider>,
    );

    await findByText('ApproveAbsenceRequest');
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
