import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_HCM_SETUP } from '@/lib/hcm-setup-defaults';
import { AdminEmployeeCreate } from './employee-create';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

const managerId = '00000000-0000-4000-8000-000000000601';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
  },
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    roles: [{ id: 'role-1', name: 'HR_ADMIN' }],
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

function renderEmployeeCreate() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminEmployeeCreate />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminEmployeeCreate hierarchy fields', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/admin/hcm-setup') return apiResponse(DEFAULT_HCM_SETUP);
      if (url === '/hr/organization/org-units/tree') return apiResponse([]);
      if (url === '/hr/core/workers?pageSize=100') return apiResponse([]);
      if (url === '/hr/core/workers?search=morgan&pageSize=10') {
        return apiResponse([
          {
            id: managerId,
            employeeId: 'EMP-6001',
            firstName: 'Morgan',
            lastName: 'Blake',
            email: 'morgan.blake@example.com',
            hireDate: '2023-04-01T00:00:00.000Z',
            status: 'ACTIVE',
            jobTitle: 'Engineering Director',
          },
        ]);
      }
      return apiResponse([]);
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: { workerId: 'new-worker', status: 'DRAFT' } } });
  });

  it('replaces the manager/HRBP/mentor selects with a live worker search picker', async () => {
    const user = userEvent.setup();
    renderEmployeeCreate();

    expect(await screen.findByRole('button', { name: /Employees/i })).toBeInTheDocument();

    // Jump directly to the Organization step via the step navigator.
    await user.click(screen.getByRole('button', { name: 'Organization' }));

    expect(await screen.findByLabelText('Direct Manager')).toBeInTheDocument();
    expect(screen.getByLabelText('Dotted-Line Manager')).toBeInTheDocument();
    expect(screen.getByLabelText('HR Business Partner')).toBeInTheDocument();
    expect(screen.getByLabelText('Mentor / Buddy')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Direct Manager'), 'morgan');
    await user.click(await screen.findByText('Morgan Blake', {}, { timeout: 5000 }));

    expect(screen.getByLabelText('Direct Manager')).toHaveValue('Morgan Blake');
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/hr/core/workers?search=morgan&pageSize=10'), { timeout: 5000 });
  });

  it('searches the real worker directory instead of the capped 100-row static fetch', async () => {
    const user = userEvent.setup();
    renderEmployeeCreate();

    await user.click(await screen.findByRole('button', { name: 'Organization' }));
    await user.type(screen.getByLabelText('HR Business Partner'), 'morgan');

    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/hr/core/workers?search=morgan&pageSize=10'), { timeout: 5000 });
    expect(await screen.findByText('EMP-6001 • Engineering Director', {}, { timeout: 5000 })).toBeInTheDocument();
  });
});
