import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPerformanceOperations } from './performance-operations';

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
  useAuth: () => ({
    user: {
      id: '00000000-0000-4000-8000-000000000099',
      tenantId: '00000000-0000-4000-8000-000000000001',
      roles: [{ id: 'role-1', name: 'HR_ADMIN' }],
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

const worker1 = {
  id: '00000000-0000-4000-8000-000000000010',
  employeeId: 'EMP-010',
  firstName: 'Amina',
  lastName: 'Nour',
  email: 'amina@example.com',
  hireDate: '2024-01-01T00:00:00.000Z',
  status: 'ACTIVE',
};

const cycle1 = {
  id: '00000000-0000-4000-8000-000000000020',
  name: '2026 Annual Cycle',
  cycleYear: 2026,
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-12-31T00:00:00.000Z',
  reviewType: 'ANNUAL',
  status: 'ACTIVE',
};

const emptyAnalytics = {
  ratingDistribution: [],
  reviewCompletion: { total: 0 },
  goalMetrics: { total: 0, active: 0, achieved: 0, atRisk: 0, averageProgress: 0 },
  peerFeedback: { submitted: 0, anonymousSubmitted: 0, averageRating: null, relationshipMix: {}, dimensionAverages: {} },
  calibrationHeatmap: [],
  nineBox: [],
  recognitions: [],
  feedbackSummaries: {},
  actionPlans: [],
  scoreExplainability: {},
  biasChecks: { suppressionThreshold: 3, departmentRatingDistribution: [] },
  trendSignals: [],
  governance: {
    anonymityThreshold: 3,
    performanceFormulaVersion: 'v1',
    generatedAt: '2026-06-01T00:00:00.000Z',
    inputCounts: {},
  },
};

interface Overrides {
  reviews?: unknown[];
  pips?: unknown[];
  developmentPlans?: unknown[];
  objectives?: unknown[];
  keyResults?: unknown[];
  kpis?: unknown[];
  feedbackCycles?: unknown[];
  feedbackResponses?: unknown[];
}

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

function setupApi(overrides: Overrides = {}) {
  apiClientGetMock.mockImplementation((url: string) => {
    if (url.startsWith('/hr/core/workers?')) return apiResponse([worker1]);
    if (url.startsWith('/performance/review-cycles/tenant/')) return apiResponse([cycle1]);
    if (url === '/hr/organization/org-units/tree') return apiResponse([]);
    if (url.startsWith('/performance/reviews/worker/')) return apiResponse(overrides.reviews ?? []);
    if (url.startsWith('/performance/feedback-360-cycles/tenant/')) return apiResponse(overrides.feedbackCycles ?? []);
    if (url.startsWith('/performance/feedback-360-responses/cycle/')) return apiResponse(overrides.feedbackResponses ?? []);
    if (url.startsWith('/performance/calibration-sessions/cycle/')) return apiResponse([]);
    if (url.startsWith('/performance/analytics/cycle/')) return apiResponse(emptyAnalytics);
    if (url.startsWith('/performance/improvement-plans/worker/')) return apiResponse(overrides.pips ?? []);
    if (url.startsWith('/performance/development-plans/worker/')) return apiResponse(overrides.developmentPlans ?? []);
    if (url.startsWith('/performance/objectives/owner/')) return apiResponse(overrides.objectives ?? []);
    if (url.startsWith('/performance/key-results/objective/')) return apiResponse(overrides.keyResults ?? []);
    if (url.startsWith('/performance/kpis/department/')) return apiResponse(overrides.kpis ?? []);
    if (url.startsWith('/performance/kpi-measurements/kpi/')) return apiResponse([]);
    return apiResponse([]);
  });
  apiClientPostMock.mockResolvedValue({ data: { success: true, data: {} } });
}

function renderOps() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminPerformanceOperations />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function goToSection(name: string) {
  await userEvent.click(await screen.findByRole('button', { name }, { timeout: 5000 }));
}

describe('AdminPerformanceOperations workflow dialogs', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientPostMock.mockReset();
    addNotificationMock.mockReset();
  });

  it('collects self-review content through a required-textarea dialog', async () => {
    setupApi({
      reviews: [{ id: 'review-1', workerId: worker1.id, reviewCycleId: cycle1.id, managerId: worker1.id, status: 'DRAFT' }],
    });
    renderOps();

    await goToSection('Reviews');
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));

    const dialog = await screen.findByRole('dialog', { name: 'Self review' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit review' }));
    expect(await within(dialog).findByText('This field is required.')).toBeInTheDocument();
    expect(apiClientPostMock).not.toHaveBeenCalled();

    await userEvent.type(within(dialog).getByLabelText('Self-review content'), 'Delivered the Q2 roadmap on schedule.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit review' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/performance/reviews/review-1/commands/submit-self',
      { content: 'Delivered the Q2 roadmap on schedule.' },
    ));
  });

  it('collects a calibration rating through the rating dialog', async () => {
    setupApi({
      reviews: [{ id: 'review-2', workerId: worker1.id, reviewCycleId: cycle1.id, managerId: worker1.id, status: 'MANAGER_REVIEW' }],
    });
    renderOps();

    await goToSection('Reviews');
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));

    const dialog = await screen.findByRole('dialog', { name: 'Set calibration rating' });
    const ratingInput = within(dialog).getByLabelText('Calibration rating') as HTMLInputElement;
    expect(ratingInput.value).toBe('3');
    await userEvent.clear(ratingInput);
    await userEvent.type(ratingInput, '4.5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rating' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/performance/reviews/review-2/commands/calibrate',
      { rating: 4.5 },
    ));
  });

  it('lets a finalized review be disputed through the acknowledge/dispute choice dialog', async () => {
    setupApi({
      reviews: [{ id: 'review-3', workerId: worker1.id, reviewCycleId: cycle1.id, managerId: worker1.id, status: 'FINALIZED' }],
    });
    renderOps();

    await goToSection('Reviews');
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));

    const dialog = await screen.findByRole('dialog', { name: 'Finalized review' });
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Dispute' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/performance/reviews/review-3/commands/dispute',
      {},
    ));
  });

  it('extends an active improvement plan with a date follow-up field', async () => {
    setupApi({
      pips: [{
        id: 'pip-1',
        workerId: worker1.id,
        managerId: worker1.id,
        status: 'ACTIVE',
        endDate: '2026-08-01T00:00:00.000Z',
      }],
    });
    renderOps();

    await goToSection('PIP & Development');
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));

    const dialog = await screen.findByRole('dialog', { name: 'Improvement plan' });
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Extend' }));
    const dateField = within(dialog).getByLabelText('New end date') as HTMLInputElement;
    expect(dateField.value).toBe('2026-08-01');
    await userEvent.clear(dateField);
    await userEvent.type(dateField, '2026-09-15');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/performance/improvement-plans/pip-1/commands/extend',
      { newEndDate: '2026-09-15' },
    ));
  });

  it('cancel on the improvement-plan dialog closes it without calling any command', async () => {
    setupApi({
      pips: [{
        id: 'pip-2',
        workerId: worker1.id,
        managerId: worker1.id,
        status: 'ACTIVE',
        endDate: '2026-08-01T00:00:00.000Z',
      }],
    });
    renderOps();

    await goToSection('PIP & Development');
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));

    const dialog = await screen.findByRole('dialog', { name: 'Improvement plan' });
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Extend' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(apiClientPostMock).not.toHaveBeenCalled();
  });

  it('records a development-plan milestone using forward-slash command paths', async () => {
    setupApi({
      developmentPlans: [{
        id: 'dev-1',
        workerId: worker1.id,
        managerId: worker1.id,
        title: 'Grow into tech lead role',
        status: 'ACTIVE',
      }],
    });
    renderOps();

    await goToSection('PIP & Development');
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));

    const dialog = await screen.findByRole('dialog', { name: 'Development plan' });
    const titleField = within(dialog).getByLabelText('Milestone or objective title') as HTMLTextAreaElement;
    expect(titleField.value).toBe('Grow into tech lead role');
    await userEvent.clear(titleField);
    await userEvent.type(titleField, 'Completed architecture review');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/performance/development-plans/dev-1/commands/record-milestone',
      { objectiveTitle: 'Completed architecture review', status: 'COMPLETED' },
    ));
    const [calledUrl] = apiClientPostMock.mock.calls[0];
    expect(calledUrl).not.toContain('\\');
  });

  it('updates objective progress through a numeric follow-up field', async () => {
    setupApi({
      objectives: [{
        id: 'obj-1',
        ownerId: worker1.id,
        title: 'Ship the new onboarding flow',
        period: '2026-Q2',
        progress: 40,
        status: 'ACTIVE',
      }],
    });
    renderOps();

    await goToSection('OKR & KPI');
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));

    const dialog = await screen.findByRole('dialog', { name: 'Objective' });
    const progressField = within(dialog).getByLabelText('Progress %') as HTMLInputElement;
    expect(progressField.value).toBe('40');
    await userEvent.clear(progressField);
    await userEvent.type(progressField, '75');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/performance/objectives/obj-1/commands/update-progress',
      { progress: 75, confidenceScore: 0.8 },
    ));
  });

  it('assigns a new KPI owner through a plain validated text field', async () => {
    setupApi({
      kpis: [{
        id: 'kpi-1',
        name: 'Time to hire',
        status: 'ACTIVE',
        ownerId: worker1.id,
        actualValue: 10,
        targetValue: 20,
      }],
    });
    renderOps();

    await goToSection('OKR & KPI');
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));

    const dialog = await screen.findByRole('dialog', { name: 'KPI' });
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Assign owner' }));
    const ownerField = within(dialog).getByLabelText('New owner employee ID') as HTMLInputElement;
    expect(ownerField.value).toBe(worker1.id);
    await userEvent.clear(ownerField);
    await userEvent.type(ownerField, '00000000-0000-4000-8000-000000000099');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalledWith(
      '/performance/kpis/kpi-1/commands/assign-owner',
      { ownerId: '00000000-0000-4000-8000-000000000099' },
    ));
  });

  it('collects per-dimension 360 feedback scores instead of copying one number into every dimension', async () => {
    setupApi({
      feedbackCycles: [{
        id: 'fb-cycle-1',
        name: '2026 360',
        cycleYear: 2026,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-06-30T00:00:00.000Z',
        status: 'IN_PROGRESS',
      }],
      feedbackResponses: [{
        id: 'fb-response-1',
        cycleId: 'fb-cycle-1',
        revieweeId: worker1.id,
        reviewerId: worker1.id,
        relationshipType: 'PEER',
        status: 'PENDING',
      }],
    });
    renderOps();

    await goToSection('360 Feedback');
    await userEvent.click(await screen.findByRole('button', { name: 'Submit' }));

    const dialog = await screen.findByRole('dialog', { name: 'Submit 360 feedback' });
    const communication = within(dialog).getByLabelText('Communication') as HTMLInputElement;
    const ownership = within(dialog).getByLabelText('Ownership') as HTMLInputElement;
    expect(communication.value).toBe('4');
    await userEvent.clear(ownership);
    await userEvent.type(ownership, '2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit feedback' }));

    await waitFor(() => expect(apiClientPostMock).toHaveBeenCalled());
    const [url, body] = apiClientPostMock.mock.calls[0];
    expect(url).toBe('/performance/feedback-360-responses/fb-response-1/commands/submit');
    expect(body.dimensionScores).toMatchObject({
      communication: 4,
      professionalism: 4,
      ethics: 4,
      teamwork: 4,
      ownership: 2,
    });
    expect(body.overallRating).toBeCloseTo((4 + 4 + 4 + 4 + 2) / 5);
  });
});
