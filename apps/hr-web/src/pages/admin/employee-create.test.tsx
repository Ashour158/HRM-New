import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
  useAuth: () => ({ roles: [{ id: 'role-1', name: 'HR_ADMIN' }] }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) =>
    selector({ addNotification: addNotificationMock }),
}));

beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = vi.fn();
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

const setupWithCustomField = {
  ...DEFAULT_HCM_SETUP,
  employeeIdPolicy: { mode: 'AUTO' as const, prefix: 'EMP', nextNumber: 1 },
  documentRequirements: [],
  fieldRules: [
    ...DEFAULT_HCM_SETUP.fieldRules,
    { fieldKey: 'badgeColor', label: 'Badge Color', section: 'Custom', required: true, active: true, fieldType: 'TEXT' as const },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminEmployeeCreate />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillIdentityStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/^First Name/), 'Amina');
  await user.type(screen.getByLabelText(/^Last Name/), 'Hassan');
  await user.type(screen.getByLabelText(/^Work Email/), 'amina@example.com');
}

async function goToReviewStep(user: ReturnType<typeof userEvent.setup>) {
  // Identity -> Address
  await user.click(screen.getByRole('button', { name: /^next$/i }));
  // Address -> Organization
  await user.click(await screen.findByRole('button', { name: /^next$/i }));
}

describe('AdminEmployeeCreate custom fields', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/admin/hcm-setup') return apiResponse(setupWithCustomField);
      if (url === '/hr/organization/org-units/tree') return apiResponse([]);
      if (url.startsWith('/hr/core/workers')) return apiResponse([]);
      return apiResponse([]);
    });
    apiClientPostMock.mockImplementation((url: string) => {
      if (url === '/hr/core/workers/duplicate-check') return apiResponse({ exactMatches: [], warnings: [], canCreate: true });
      if (url === '/hr/core/workers') return apiResponse({ workerId: 'worker-1', status: 'DRAFT' });
      return apiResponse({});
    });
  });

  it('renders an admin-defined custom field as a real fillable input', async () => {
    renderPage();
    expect(await screen.findByLabelText(/^Badge Color/)).toBeInTheDocument();
  });

  it('blocks submission with a real, named error when a required custom field is left unfilled', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillIdentityStep(user);
    await goToReviewStep(user);
    // Organization -> Compensation -> Payroll -> Talent -> Benefits & Access -> Documents -> Review
    for (let i = 0; i < 6; i += 1) {
      await user.click(await screen.findByRole('button', { name: /^next$/i }));
    }

    expect(await screen.findByText(/Badge Color/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create employee/i })).toBeDisabled();
    expect(apiClientPostMock).not.toHaveBeenCalledWith('/hr/core/workers', expect.anything());
  });

  it('persists a filled custom field value when the employee is created', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillIdentityStep(user);
    await user.type(screen.getByLabelText(/^Badge Color/), 'Blue');
    await goToReviewStep(user);

    // On the Organization step: select a department from Admin Settings.
    await user.click(await screen.findByRole('combobox', { name: 'Department' }));
    await user.click(await screen.findByRole('option', { name: 'People Operations' }));

    // Organization -> Compensation -> Payroll -> Talent -> Benefits & Access -> Documents -> Review
    for (let i = 0; i < 6; i += 1) {
      await user.click(await screen.findByRole('button', { name: /^next$/i }));
    }

    await user.click(await screen.findByRole('button', { name: /create employee/i }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/hr/core/workers',
      expect.objectContaining({
        customFieldValues: { badgeColor: 'Blue' },
      }),
    ));
  });
});

describe('AdminEmployeeCreate hierarchy fields', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === '/admin/hcm-setup') return apiResponse(DEFAULT_HCM_SETUP);
      if (url === '/hr/organization/org-units/tree') return apiResponse([]);
      if (url === '/hr/core/workers?pageSize=100') return apiResponse([]);
      if (url === '/hr/core/workers/directory-search?search=morgan&pageSize=10') {
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
    renderPage();

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
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/hr/core/workers/directory-search?search=morgan&pageSize=10'), { timeout: 5000 });
  });

  it('searches the real worker directory instead of the capped 100-row static fetch', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Organization' }));
    await user.type(screen.getByLabelText('HR Business Partner'), 'morgan');

    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/hr/core/workers/directory-search?search=morgan&pageSize=10'), { timeout: 5000 });
    expect(await screen.findByText('EMP-6001 • Engineering Director', {}, { timeout: 5000 })).toBeInTheDocument();
  });
});
