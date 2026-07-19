import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/i18n-provider';
import { EmployeeRecognition } from './recognition';
import { EmployeePulse } from './pulse';
import { EmployeeSurveys } from './surveys';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

const tenantId = '00000000-0000-0000-0000-000000000001';
const workerId = '00000000-0000-4000-8000-000000000501';
const surveyId = '00000000-0000-4000-8000-000000000701';
const responseId = '00000000-0000-4000-8000-000000000801';
const programId = '00000000-0000-4000-8000-000000000901';
const recipientWorkerId = '00000000-0000-4000-8000-000000000777';

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
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

function renderPage(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('employee engagement pages', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === `/engagement/surveys/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: { value: surveyId },
            title: 'Quarterly engagement survey',
            surveyType: 'ENGAGEMENT',
            status: 'ACTIVE',
            anonymous: true,
            questions: [{ code: 'q1', label: 'How supported do you feel?' }],
          },
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
      if (url === `/engagement/recognition-programs/tenant/${tenantId}`) {
        return apiResponse([{ id: { value: programId }, programName: 'Values awards', status: 'ACTIVE' }]);
      }
      if (url === `/engagement/recognition-records/worker/${workerId}`) {
        return apiResponse([{ id: { value: 'record-1' }, message: 'Great teamwork', points: 25, status: 'AWARDED' }]);
      }
      if (url === '/hr/core/workers/directory-search?search=jordan&pageSize=10') {
        return apiResponse([
          {
            id: recipientWorkerId,
            employeeId: 'EMP-4004',
            firstName: 'Jordan',
            lastName: 'Lee',
            jobTitle: 'Support Specialist',
          },
        ]);
      }
      return apiResponse([]);
    });
    apiClientPostMock.mockImplementation((url: string) => {
      if (url === '/engagement/survey-responses') {
        return apiResponse({ aggregateId: responseId });
      }
      return apiResponse({ allowedNextActions: [] });
    });
  });

  it('submits an active engagement survey through the engagement response API', async () => {
    renderPage(<EmployeeSurveys />);

    expect(await screen.findByRole('heading', { name: 'Surveys' })).toBeInTheDocument();
    expect(await screen.findByText('Quarterly engagement survey')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('How supported do you feel?'), 'Very supported');
    await userEvent.click(screen.getByRole('button', { name: 'Submit Quarterly engagement survey' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith('/engagement/survey-responses', {
      surveyId,
      workerId,
      isAnonymous: true,
    }));
    expect(apiClientPostMock).toHaveBeenCalledWith(`/engagement/survey-responses/${responseId}/commands/complete`, {
      responses: { q1: 'Very supported' },
    });
    expect(apiClientPostMock).toHaveBeenCalledWith(`/engagement/survey-responses/${responseId}/commands/submit`, {});
  });

  it('renders active pulse checks from engagement survey data', async () => {
    renderPage(<EmployeePulse />);

    expect(await screen.findByRole('heading', { name: 'Pulse' })).toBeInTheDocument();
    expect(await screen.findByText('Weekly pulse check')).toBeInTheDocument();
    expect(screen.queryByText('Quarterly engagement survey')).not.toBeInTheDocument();
  });

  it('creates recognition using active recognition programs and shows received awards', async () => {
    renderPage(<EmployeeRecognition />);

    expect(await screen.findByRole('heading', { name: 'Recognition' })).toBeInTheDocument();
    expect(await screen.findByText('Great teamwork')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Recipient worker ID'), 'jordan');
    await userEvent.click(await screen.findByText('Jordan Lee', {}, { timeout: 5000 }));
    await userEvent.type(screen.getByLabelText('Message'), 'Thank you for helping the team');
    await userEvent.click(screen.getByRole('button', { name: 'Send recognition' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith('/engagement/recognition-records', {
      fromWorkerId: workerId,
      toWorkerId: recipientWorkerId,
      programId,
      points: 10,
      message: 'Thank you for helping the team',
    }));
  });
});
