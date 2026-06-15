import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/i18n-provider';
import { NotificationCenter } from './notification-center';

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: getMock, post: postMock },
}));

function renderCenter() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NotificationCenter />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe('NotificationCenter', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    postMock.mockResolvedValue({ data: { data: {} } });
  });

  it('shows the unread count and lists notifications, and marks all read', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          { id: 'n1', title: 'Leave approved', body: 'Your leave was approved', category: 'ABSENCE', createdAt: '2026-06-01T10:00:00Z' },
          { id: 'n2', title: 'Read one', body: 'Already read', category: 'SYSTEM', createdAt: '2026-06-01T09:00:00Z', readAt: '2026-06-01T09:30:00Z' },
        ],
      },
    });

    renderCenter();

    // Accessible name reflects the single unread notification once the query resolves.
    const bell = await screen.findByRole('button', { name: 'Open notifications (1 unread)' });

    await userEvent.click(bell);
    expect(await screen.findByText('Leave approved')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/notifications/commands/read-all', {}));
  });

  it('renders an empty state when there are no notifications', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderCenter();
    const bell = await screen.findByRole('button', { name: /unread/i });
    await userEvent.click(bell);
    expect(await screen.findByText('No notifications')).toBeInTheDocument();
  });
});
