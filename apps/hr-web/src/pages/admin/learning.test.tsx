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

  it('uses a searchable course picker instead of a raw course ID input when assigning a course', async () => {
    const secondCourseId = '00000000-0000-4000-8000-000000000102';
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === `/learning/courses/tenant/${tenantId}`) {
        return apiResponse([
          { id: { value: courseId }, title: 'Clinical onboarding essentials', contentType: 'VIDEO', durationMinutes: 45, status: 'DRAFT' },
          { id: { value: secondCourseId }, title: 'Advanced infection control', contentType: 'VIDEO', durationMinutes: 60, status: 'PUBLISHED' },
        ]);
      }
      if (url === `/learning/assignments/course/${courseId}` || url === `/learning/assignments/course/${secondCourseId}`) return apiResponse([]);
      if (url === `/learning/assignments/tenant/${tenantId}`) return apiResponse([]);
      if (url === `/learning/certifications/tenant/${tenantId}`) return apiResponse([]);
      if (url === `/learning/content-packages/tenant/${tenantId}`) return apiResponse([]);
      return apiResponse({});
    });

    renderLearning();
    await userEvent.click(await screen.findByRole('tab', { name: 'Assignment Overview' }));
    await userEvent.click(screen.getByRole('button', { name: 'Assign Course' }));

    // The raw free-text "Course ID" input is gone; a searchable combobox replaces it.
    expect(screen.queryByLabelText('Course ID')).not.toBeInTheDocument();
    const picker = screen.getByRole('combobox', { name: 'Course' });
    await userEvent.click(picker);
    await userEvent.type(screen.getByRole('textbox', { name: 'Course search' }), 'Advanced');
    await userEvent.click(await screen.findByRole('option', { name: /Advanced infection control/ }));

    await userEvent.clear(screen.getByLabelText('Worker ID'));
    await userEvent.type(screen.getByLabelText('Worker ID'), '00000000-0000-4000-8000-000000000303');
    await userEvent.click(screen.getByRole('button', { name: 'Save Assignment' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/learning/assignments',
      expect.objectContaining({
        workerId: '00000000-0000-4000-8000-000000000303',
        courseId: secondCourseId,
      }),
    ));
  });

  it('creates a content package and uploads its file to the new upload endpoint', async () => {
    const newPackageId = '00000000-0000-4000-8000-000000000777';
    apiClientPostMock.mockImplementation((url: string) => {
      if (url === '/learning/content-packages') {
        // Command endpoints return a CommandResult (itself `{ data, aggregateId, ... }`)
        // wrapped one more level by the global `{ success, data }` response envelope.
        return Promise.resolve({
          data: {
            success: true,
            data: {
              success: true,
              data: { learningContentPackageId: newPackageId, status: 'UPLOADED' },
              aggregateId: { value: newPackageId },
            },
          },
        });
      }
      if (url === `/learning/content-packages/${newPackageId}/upload`) {
        return Promise.resolve({ data: { success: true, data: { learningContentPackageId: newPackageId, status: 'UPLOADED', fileUrl: `local://learning-content/${newPackageId}/course.zip` } } });
      }
      return Promise.resolve({ data: { success: true, data: { allowedNextActions: [] } } });
    });

    renderLearning();
    await userEvent.click(await screen.findByRole('button', { name: 'Add Package' }));

    const file = new File(['zip-bytes'], 'course.zip', { type: 'application/zip' });
    await userEvent.upload(screen.getByLabelText('Content file (optional)'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Save Package' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/learning/content-packages',
      expect.objectContaining({ title: 'New content package', packageType: 'SCORM_2004' }),
    ));
    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/learning/content-packages/${newPackageId}/upload`,
      expect.any(FormData),
    ));
  });

  it('downloads a certificate PDF from the certification register', async () => {
    const certificationRecordId = '00000000-0000-4000-8000-000000000901';
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === `/learning/courses/tenant/${tenantId}`) return apiResponse([]);
      if (url === `/learning/assignments/tenant/${tenantId}`) return apiResponse([]);
      if (url === `/learning/content-packages/tenant/${tenantId}`) return apiResponse([]);
      if (url === `/learning/certifications/tenant/${tenantId}`) {
        return apiResponse([{
          id: { value: certificationRecordId },
          certificationName: 'Basic Life Support',
          workerId: '00000000-0000-4000-8000-000000000301',
          status: 'ACTIVE',
          expiryDate: '2027-01-10T00:00:00.000Z',
        }]);
      }
      if (url === `/learning/certifications/${certificationRecordId}/certificate.pdf`) {
        return Promise.resolve({ data: new Blob(['%PDF-1.7'], { type: 'application/pdf' }) });
      }
      return apiResponse({});
    });

    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();

    try {
      renderLearning();
      const downloadButton = await screen.findByRole('button', { name: /Download certificate for Basic Life Support/ });
      await userEvent.click(downloadButton);

      await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith(
        `/learning/certifications/${certificationRecordId}/certificate.pdf`,
        { responseType: 'blob' },
      ));
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });
});
