import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminSkillsTalent } from './skills-talent';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const apiClientPostMock = vi.hoisted(() => vi.fn());
const addNotificationMock = vi.hoisted(() => vi.fn());

const tenantId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000099';
const workerId = '00000000-0000-4000-8000-000000000501';
const profileId = '00000000-0000-4000-8000-000000000101';
const poolId = '00000000-0000-4000-8000-000000000201';
const careerPathId = '00000000-0000-4000-8000-000000000301';
const successionPlanId = '00000000-0000-4000-8000-000000000401';

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
      roles: [{ id: 'role-1', name: 'TALENT_ADMIN' }],
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

function renderSkillsTalent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminSkillsTalent />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminSkillsTalent', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
    apiClientGetMock.mockImplementation((url: string, options?: { params?: { aggregateType?: string } }) => {
      if (url === '/policy/allowed-actions') {
        const aggregateType = options?.params?.aggregateType;
        if (aggregateType === 'SkillProfile') {
          return apiResponse([{ id: 'validate', label: 'Validate skills profile', action: 'validate' }]);
        }
        if (aggregateType === 'TalentPool') {
          return apiResponse([{ id: 'close', label: 'Close', action: 'close' }]);
        }
        if (aggregateType === 'CareerPath') {
          return apiResponse([{ id: 'activate', label: 'Activate', action: 'activate' }]);
        }
        if (aggregateType === 'SuccessionPlan') {
          return apiResponse([{ id: 'activate', label: 'Activate succession plan', action: 'activate' }]);
        }
        return apiResponse([]);
      }
      if (url === `/skills-talent/skill-profiles/worker/${actorId}` || url === `/skills-talent/skill-profiles/worker/${workerId}`) {
        return apiResponse({
          id: { value: profileId },
          workerId,
          skills: [
            { skillId: 'clinical-leadership', proficiency: 4 },
            { skillId: 'patient-safety', proficiency: 5 },
          ],
          status: 'DRAFT',
        });
      }
      if (url === `/skills-talent/talent-pools/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: { value: poolId },
            poolName: 'Critical Roles',
            criteria: { jobFamily: 'Clinical' },
            memberIds: [workerId],
            status: 'OPEN',
          },
        ]);
      }
      if (url === `/skills-talent/career-paths/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: { value: careerPathId },
            title: 'Nurse Leader Path',
            currentRole: 'Senior Nurse',
            targetRole: 'Nursing Manager',
            requiredSkills: ['leadership', 'workforce-planning'],
            status: 'DRAFT',
          },
        ]);
      }
      if (url === `/skills-talent/succession-plans/tenant/${tenantId}`) {
        return apiResponse([
          {
            id: { value: successionPlanId },
            positionId: '00000000-0000-4000-8000-000000000701',
            incumbentWorkerId: workerId,
            successorCandidates: [{ workerId, readinessLevel: 2 }],
            status: 'DRAFT',
          },
        ]);
      }
      return apiResponse({});
    });
    apiClientPostMock.mockResolvedValue({ data: { success: true, data: { allowedNextActions: [] } } });
  });

  it('renders worker-scoped skills with tenant talent lists and creates a skill profile', async () => {
    renderSkillsTalent();

    expect(await screen.findByRole('heading', { name: 'Skills & Talent' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Skill Profiles' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Talent Pools' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Career Paths' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Succession Plans' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith(`/skills-talent/skill-profiles/worker/${actorId}`));
    expect(apiClientGetMock).not.toHaveBeenCalledWith(`/skills-talent/skill-profiles/tenant/${tenantId}`);
    expect(await screen.findByText(/clinical-leadership/)).toBeInTheDocument();

    expect(screen.getByLabelText('Worker profile lookup')).toHaveValue(actorId);

    await userEvent.click(screen.getByRole('button', { name: 'Create Skill Profile' }));
    await userEvent.clear(screen.getByLabelText('Profile worker ID'));
    await userEvent.type(screen.getByLabelText('Profile worker ID'), workerId);
    await userEvent.clear(screen.getByLabelText('Skill codes'));
    await userEvent.type(screen.getByLabelText('Skill codes'), 'infection-control, leadership');
    await userEvent.click(screen.getByRole('button', { name: 'Save Skill Profile' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/skills-talent/skill-profiles',
      expect.objectContaining({
        workerId,
        skills: [
          { skillId: 'infection-control', proficiency: 3 },
          { skillId: 'leadership', proficiency: 3 },
        ],
      }),
    ));
  });

  it('runs skill, talent pool, career path, and succession commands', async () => {
    renderSkillsTalent();

    expect(await screen.findByText(/clinical-leadership/)).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith('/policy/allowed-actions', expect.objectContaining({
      params: expect.objectContaining({ aggregateType: 'SkillProfile', aggregateId: profileId }),
    })));
    await userEvent.click(screen.getByRole('button', { name: 'Validate skills profile' }));
    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/skills-talent/skill-profiles/${profileId}/commands/validate`,
      { validatedBy: actorId },
    ));

    await userEvent.click(screen.getByRole('tab', { name: 'Talent Pools' }));
    expect(await screen.findByText('Critical Roles')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/skills-talent/talent-pools/${poolId}/commands/close`,
      {},
    ));

    await userEvent.click(screen.getByRole('tab', { name: 'Career Paths' }));
    expect(await screen.findByText('Nurse Leader Path')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Activate' }));
    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/skills-talent/career-paths/${careerPathId}/commands/activate`,
      {},
    ));

    await userEvent.click(screen.getByRole('tab', { name: 'Succession Plans' }));
    expect(await screen.findByText('00000000-0000-4000-8000-000000000701')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Activate succession plan' }));
    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      `/skills-talent/succession-plans/${successionPlanId}/commands/activate`,
      {},
    ));
  });
});
