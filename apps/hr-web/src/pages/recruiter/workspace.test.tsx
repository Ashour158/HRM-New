import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecruiterWorkspace } from './workspace';

const useApiQueryMock = vi.fn();
const useApiMutationMock = vi.fn();
const addNotificationMock = vi.fn();
const mutateAsyncMock = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
  useApiMutation: (...args: unknown[]) => useApiMutationMock(...args),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
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

const requisition = {
  id: '00000000-0000-0000-0000-000000000501',
  requisitionNumber: 'REQ-2026-001',
  title: 'Senior Product Designer',
  status: 'OPEN',
  positionId: '00000000-0000-0000-0000-000000000601',
  version: 3,
};

const candidates = [
  {
    id: '00000000-0000-0000-0000-000000000701',
    firstName: 'Maya',
    lastName: 'Saleh',
    email: 'maya@example.com',
    status: 'NEW',
    requisitionId: requisition.id,
    version: 1,
  },
  {
    id: '00000000-0000-0000-0000-000000000702',
    firstName: 'Omar',
    lastName: 'Hassan',
    email: 'omar@example.com',
    status: 'INTERVIEW',
    requisitionId: requisition.id,
    version: 2,
  },
  {
    id: '00000000-0000-0000-0000-000000000703',
    firstName: 'Sara',
    lastName: 'Youssef',
    email: 'sara@example.com',
    status: 'SCREENING',
    requisitionId: requisition.id,
    version: 1,
  },
];

const interviewerWorker = {
  id: '00000000-0000-0000-0000-000000000901',
  employeeId: 'EMP-901',
  firstName: 'Dana',
  lastName: 'Iqbal',
  email: 'dana.iqbal@example.com',
  hireDate: '2020-01-01',
  status: 'ACTIVE',
};

describe('RecruiterWorkspace', () => {
  beforeEach(() => {
    addNotificationMock.mockReset();
    useApiQueryMock.mockReset();
    useApiMutationMock.mockReset();
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockResolvedValue({ newState: 'SCHEDULED', allowedNextActions: [] });
    useApiMutationMock.mockReturnValue({ mutateAsync: mutateAsyncMock, isPending: false });
    useApiQueryMock.mockImplementation((queryKey: unknown, url: string) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'recruiter-requisitions') return { data: [requisition], isLoading: false, isError: false, refetch: vi.fn() };
      if (key === 'recruiter-candidates') return { data: candidates, isLoading: false, isError: false, refetch: vi.fn() };
      if (key === 'recruiter-offers') return { data: [], isLoading: false, isError: false, refetch: vi.fn() };
      if (key === 'recruiter-requisition-detail') return { data: requisition, isLoading: false, isError: false, refetch: vi.fn() };
      if (key === 'recruiter-interviewer-search') return { data: [interviewerWorker], isLoading: false, isError: false, refetch: vi.fn() };
      throw new Error(`Unexpected query ${String(key)} ${url}`);
    });
  });

  it('renders requisitions, pipeline funnel, and uses real recruiting API paths', async () => {
    render(<RecruiterWorkspace />);

    expect(screen.getByRole('heading', { name: 'Recruiting Workspace' })).toBeInTheDocument();
    expect(screen.getByText('Senior Product Designer')).toBeInTheDocument();
    expect(screen.getByText('Pipeline funnel')).toBeInTheDocument();
    expect(screen.getByText('NEW')).toBeInTheDocument();
    expect(screen.getByText('INTERVIEW')).toBeInTheDocument();
    expect(useApiQueryMock).toHaveBeenCalledWith(expect.arrayContaining(['recruiter-requisitions']), '/hr/recruiting/requisitions/open', expect.any(Object));
    expect(useApiQueryMock).toHaveBeenCalledWith(expect.arrayContaining(['recruiter-candidates']), `/hr/recruiting/candidates?requisition=${requisition.id}`, expect.any(Object));

    await userEvent.click(screen.getByRole('button', { name: /screen candidate/i }));
    expect(useApiMutationMock).toHaveBeenCalledWith(
      expect.any(Function),
      'post',
      expect.any(Array),
      expect.any(Object),
    );
  });

  it('requires a searched interviewer before scheduling and sends the selected interviewer and chosen time (not the previous hardcoded values)', async () => {
    const user = userEvent.setup();
    render(<RecruiterWorkspace />);

    await user.click(screen.getByRole('button', { name: 'Schedule interview' }));
    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Schedule interview' });

    // Cannot be submitted until a real interviewer has been searched and selected.
    expect(confirmButton).toBeDisabled();

    await user.type(within(dialog).getByLabelText('Interviewers'), 'Dana');
    await user.click(within(dialog).getByText('Dana Iqbal'));

    expect(confirmButton).toBeEnabled();

    const datetimeInput = within(dialog).getByLabelText(/date & time/i);
    fireEvent.change(datetimeInput, { target: { value: '2026-08-01T10:30' } });

    await user.click(confirmButton);

    expect(mutateAsyncMock).toHaveBeenCalledWith(expect.objectContaining({
      command: 'schedule-interview',
      candidateId: candidates[2].id,
      interviewerWorkerIds: [interviewerWorker.id],
      scheduledAt: new Date('2026-08-01T10:30').toISOString(),
      format: 'VIDEO',
    }));
    expect(mutateAsyncMock).not.toHaveBeenCalledWith(expect.objectContaining({
      interviewerWorkerIds: ['00000000-0000-0000-0000-000000000001'],
    }));
  });

  it('sends user-edited start date, currency, and benefits when creating an offer (not the previous hardcoded literals)', async () => {
    const user = userEvent.setup();
    render(<RecruiterWorkspace />);

    await user.click(screen.getByRole('button', { name: 'Create offer' }));
    const dialog = await screen.findByRole('dialog');

    await user.clear(within(dialog).getByLabelText('Proposed salary'));
    await user.type(within(dialog).getByLabelText('Proposed salary'), '150000');

    const startDateInput = within(dialog).getByLabelText('Start date');
    fireEvent.change(startDateInput, { target: { value: '2026-09-15' } });

    await user.click(within(dialog).getByRole('combobox', { name: 'Currency' }));
    await user.click(screen.getByRole('option', { name: 'EUR' }));

    await user.type(within(dialog).getByLabelText('Benefits summary'), 'Health, dental, 25 PTO days');

    await user.click(within(dialog).getByRole('button', { name: 'Create offer' }));

    expect(mutateAsyncMock).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: candidates[1].id,
      proposedSalary: 150000,
      currency: 'EUR',
      startDate: '2026-09-15',
      benefitsPackage: { summary: 'Health, dental, 25 PTO days' },
    }));
    expect(mutateAsyncMock).not.toHaveBeenCalledWith(expect.objectContaining({
      benefitsPackage: 'Standard employment benefits',
    }));
    expect(mutateAsyncMock).not.toHaveBeenCalledWith(expect.objectContaining({
      candidateId: candidates[1].id,
    }));
  });
});
