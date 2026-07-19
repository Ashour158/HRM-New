import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminLearning } from './learning';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

const tenantId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000099';
const courseId = '00000000-0000-4000-8000-000000000101';
const assigneeWorkerId = '00000000-0000-4000-8000-000000000302';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: apiClientPostMock,
  },
}));

vi.mock('@/hooks/use-tenant', () => ({
  useTenant: () => ({
    tenantId,
    tenantName: 'Acme Health',
    tenantConfig: {
      currency: 'AED',
      dateFormat: 'DD/MM/YYYY',
      timezone: 'Asia/Dubai',
      features: [],
    },
  }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: actorId,
      roles: [{ id: 'role-1', name: 'HR_ADMIN' }],
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

function renderLearning() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminLearning />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminLearning', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === `/learning/courses/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: { value: courseId },
            title: 'Clinical onboarding essentials',
            contentType: 'VIDEO',
            durationMinutes: 45,
            status: 'DRAFT',
          },
        ]);
      }
      if (url === `/learning/assignments/course/${courseId}`) {
        return apiResponse([
          {
            id: { value: '00000000-0000-4000-8000-000000000201' },
            workerId: '00000000-0000-4000-8000-000000000301',
            courseId,
            status: 'ASSIGNED',
            dueDate: '2026-07-01T00:00:00.000Z',
          },
        ]);
      }
      if (url === `/learning/assignments/tenant/${tenantId}`) return apiResponse([]);
      if (url === `/learning/certifications/tenant/${tenantId}`) return apiResponse([]);
      if (url === '/hr/core/workers/directory-search?search=priya&pageSize=10') {
        return apiResponse([
          {
            id: assigneeWorkerId,
            employeeId: 'EMP-3002',
            firstName: 'Priya',
            lastName: 'Shah',
            email: 'priya.shah@example.com',
            hireDate: '2025-03-01T00:00:00.000Z',
            status: 'ACTIVE',
            jobTitle: 'Clinical Nurse',
          },
        ]);
      }
      if (url === `/learning/content-packages/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: { value: '00000000-0000-4000-8000-000000000401' },
            title: 'Safety SCORM package',
            packageType: 'SCORM_2004',
            version: '1.0',
            status: 'UPLOADED',
          },
        ]);
      }
      return apiResponse({});
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: { allowedNextActions: [] } } });
  });

  it('renders courses, content catalog, assignment overview, and creates a course', async () => {
    renderLearning();

    expect(await screen.findByRole('heading', { name: 'Learning' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Courses' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Content Catalog' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Assignment Overview' })).toBeInTheDocument();
    expect(await screen.findByText('Clinical onboarding essentials')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Content Catalog' }));
    expect(await screen.findByText('Safety SCORM package')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Courses' }));

    await userEvent.click(screen.getByRole('button', { name: 'Create Course' }));
    await userEvent.clear(screen.getByLabelText('Course title'));
    await userEvent.type(screen.getByLabelText('Course title'), 'Infection control basics');
    await userEvent.click(screen.getByRole('button', { name: 'Save Course' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/learning/courses',
      expect.objectContaining({
        title: 'Infection control basics',
        contentType: 'VIDEO',
      }),
    ));
  });

  it('publishes a course and assigns a worker through real learning commands', async () => {
    renderLearning();

    expect(await screen.findByText('Clinical onboarding essentials')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Publish Clinical onboarding essentials' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/learning/courses/${courseId}/commands/publish`,
      {},
    ));

    await userEvent.click(screen.getByRole('tab', { name: 'Assignment Overview' }));
    await userEvent.click(screen.getByRole('button', { name: 'Assign Course' }));
    await userEvent.type(screen.getByLabelText('Select worker'), 'priya');
    await userEvent.click(await screen.findByText('Priya Shah', {}, { timeout: 5000 }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Assignment' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/learning/assignments',
      expect.objectContaining({
        workerId: assigneeWorkerId,
        courseId,
        assignedBy: actorId,
      }),
    ));
  });
});
