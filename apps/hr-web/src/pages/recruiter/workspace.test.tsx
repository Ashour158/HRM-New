import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('RecruiterWorkspace', () => {
  beforeEach(() => {
    addNotificationMock.mockReset();
    useApiQueryMock.mockReset();
    useApiMutationMock.mockReset();
    useApiMutationMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    useApiQueryMock.mockImplementation((queryKey: unknown, url: string) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'recruiter-requisitions') return { data: [requisition], isLoading: false, isError: false, refetch: vi.fn() };
      if (key === 'recruiter-candidates') return { data: candidates, isLoading: false, isError: false, refetch: vi.fn() };
      if (key === 'recruiter-offers') return { data: [], isLoading: false, isError: false, refetch: vi.fn() };
      if (key === 'recruiter-requisition-detail') return { data: requisition, isLoading: false, isError: false, refetch: vi.fn() };
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
});
