import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/i18n-provider';
import { CommandPalette, type CommandPaletteItem } from './command-palette';

const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: apiClientPostMock,
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

const items: CommandPaletteItem[] = [
  { id: 'nav:employee', kind: 'navigate', label: 'Employee home', group: 'Navigate', path: '/employee', keywords: ['home'] },
  {
    id: 'command:approve',
    kind: 'command',
    label: 'Approve leave request',
    group: 'Approvals',
    commandPath: '/platform/workflow/approval-chains/chain-1/steps/step-1/commands/approve',
    body: { reason: 'Approved from command palette' },
    keywords: ['approval'],
  },
];

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.hash}</div>;
}

function renderPalette(customItems = items) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  apiClientPostMock.mockResolvedValue({ data: { success: true, data: { status: 'APPROVED' } } });

  const view = render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CommandPalette items={customItems} />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
  return { ...view, queryClient, invalidateSpy };
}

describe('CommandPalette', () => {
  beforeEach(() => {
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    window.localStorage.clear();
  });

  it('executes command actions through the API and records recents', async () => {
    const { invalidateSpy } = renderPalette();

    await userEvent.keyboard('{Control>}k{/Control}');
    const input = screen.getByRole('combobox', { name: 'Command search' });
    expect(input).toHaveAttribute('aria-activedescendant');
    await userEvent.type(input, 'approve');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/platform/workflow/approval-chains/chain-1/steps/step-1/commands/approve',
      { reason: 'Approved from command palette' },
    ));
    expect(addNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Command completed',
      type: 'success',
    }));
    expect(invalidateSpy).toHaveBeenCalled();
    expect(window.localStorage.getItem('hrm-command-palette-recents')).toContain('command:approve');
  });

  it('maintains a real active descendant option while navigating results', async () => {
    renderPalette();

    await userEvent.keyboard('{Control>}k{/Control}');
    const input = screen.getByRole('combobox', { name: 'Command search' });
    await userEvent.type(input, 'approve');

    const activeId = input.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    const activeOption = document.getElementById(activeId ?? '');
    expect(activeOption).toHaveAttribute('role', 'option');
    expect(activeOption).toHaveTextContent('Approve leave request');

    await userEvent.keyboard('{ArrowDown}');
    expect(input.getAttribute('aria-activedescendant')).toBe(activeId);
  });

  it('surfaces command failures inline without closing the palette', async () => {
    apiClientPostMock.mockRejectedValueOnce(new Error('Denied'));
    renderPalette();

    await userEvent.keyboard('{Control>}k{/Control}');
    const input = screen.getByRole('combobox', { name: 'Command search' });
    await userEvent.type(input, 'approve');
    await userEvent.keyboard('{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('The command could not be completed.');
    expect(screen.getByRole('combobox', { name: 'Command search' })).toBeInTheDocument();
  });

  it('resolves search actions into deep links and navigates from Enter', async () => {
    const searchResolver = vi.fn(async () => [{
      id: 'search:leave-policy',
      label: 'Leave policy record',
      group: 'Search',
      path: '/admin/system-console/policies',
      keywords: ['policy'],
    }]);
    renderPalette([{
      id: 'search:portal',
      kind: 'search',
      label: 'Search records',
      group: 'Search',
      resolver: searchResolver,
    }]);

    await userEvent.keyboard('{Control>}k{/Control}');
    const input = screen.getByRole('combobox', { name: 'Command search' });
    await userEvent.type(input, 'policy');

    expect(await screen.findByText('Leave policy record')).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');

    expect(searchResolver).toHaveBeenCalledWith('policy');
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/system-console/policies');
  });
});
