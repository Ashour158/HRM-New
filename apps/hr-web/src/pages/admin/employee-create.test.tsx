import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminEmployeeCreate } from './employee-create';
import { DEFAULT_HCM_SETUP } from '@/lib/hcm-setup-defaults';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

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
