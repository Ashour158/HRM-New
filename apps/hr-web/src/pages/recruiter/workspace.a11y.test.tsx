import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecruiterWorkspace } from './workspace';

const useApiQueryMock = vi.fn();
const useApiMutationMock = vi.fn();
const addNotificationMock = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
  useApiMutation: (...args: unknown[]) => useApiMutationMock(...args),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: typeof addNotificationMock }) => unknown) => selector({ addNotification: addNotificationMock }),
}));

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
];

const offers = [
  {
    id: '00000000-0000-0000-0000-000000000801',
    candidateId: candidates[1].id,
    requisitionId: requisition.id,
    proposedSalary: 145000,
    currency: 'USD',
    startDate: '2026-08-10',
    status: 'SENT',
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

describe('RecruiterWorkspace accessibility', () => {
  beforeEach(() => {
    addNotificationMock.mockReset();
    useApiQueryMock.mockReset();
    useApiMutationMock.mockReset();
    useApiMutationMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    useApiQueryMock.mockImplementation((queryKey: unknown, url: string) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'recruiter-requisitions') return { data: [requisition], isLoading: false, isError: false, refetch: vi.fn() };
      if (key === 'recruiter-candidates') return { data: candidates, isLoading: false, isError: false, refetch: vi.fn() };
      if (key === 'recruiter-offers') return { data: offers, isLoading: false, isError: false, refetch: vi.fn() };
      if (key === 'recruiter-requisition-detail') return { data: requisition, isLoading: false, isError: false, refetch: vi.fn() };
      if (key === 'recruiter-interviewer-search') return { data: [interviewerWorker], isLoading: false, isError: false, refetch: vi.fn() };
      throw new Error(`Unexpected query ${String(key)} ${url}`);
    });
  });

  it('renders without accessibility violations', async () => {
    const { container } = render(<RecruiterWorkspace />);

    expect(screen.getByRole('heading', { name: 'Recruiting Workspace' })).toBeInTheDocument();
    expect(screen.getByText('Senior Product Designer')).toBeInTheDocument();
    expect(screen.getByText('Pipeline funnel')).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
