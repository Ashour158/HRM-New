import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeProfile } from './profile';

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

vi.mock('@/hooks/use-field-access', () => ({
  useFieldAccess: () => ({
    data: { decision: 'VISIBLE' },
    isLoading: false,
  }),
}));

vi.mock('@/components/common/allowed-actions', () => ({
  AllowedActions: () => <div data-testid="allowed-actions" />,
}));

const profile = {
  id: '00000000-0000-0000-0000-000000000020',
  employeeId: 'E-020',
  firstName: 'Amina',
  lastName: 'Nour',
  email: 'amina@example.com',
  hireDate: '2025-01-01',
  employmentType: 'FULL_TIME',
  status: 'ACTIVE',
  department: 'Design',
  jobTitle: 'Product Designer',
  manager: 'David Chen',
  legalEntity: 'Enterprise HR',
  documents: [],
};

const performanceImpact = {
  actionPlan: {
    workerId: profile.id,
    employeeName: 'Amina Nour',
    riskLevel: 'LOW',
    currentPerformance: {
      latestRating: 4.4,
      averageGoalProgress: 82,
      peerAverageRating: 4.6,
      activeGoalCount: 3,
      openDevelopmentPlan: false,
    },
    progressTrend: 'Improving',
    checkInCadence: 'Monthly performance conversation',
    recommendedActions: ['Keep current peer feedback rhythm.'],
  },
  feedbackSummary: {
    averageRating: 4.6,
    responseCount: 4,
    anonymousResponseCount: 2,
    conciseFeedback: 'Trusted partner with strong collaboration.',
    dimensionAverages: { communication: 4.7, teamwork: 4.5 },
  },
  nineBox: {
    performanceScore: 88,
    potentialScore: 84,
    performanceBand: 'HIGH',
    potentialBand: 'HIGH',
    box: 'Star',
  },
  goals: {
    total: 4,
    active: 3,
    achieved: 1,
    atRisk: 0,
    averageProgress: 82,
  },
};

describe('EmployeeProfile', () => {
  beforeEach(() => {
    addNotificationMock.mockReset();
    useApiMutationMock.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ caseNumber: 'HR-20260609-ABCD1234' }),
      isPending: false,
    });
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'employee-profile') {
        return { data: profile, isLoading: false, error: null, refetch: vi.fn() };
      }
      if (key === 'employee-profile-performance') {
        return { data: performanceImpact, isLoading: false, error: null, refetch: vi.fn() };
      }
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
  });

  it('shows performance impact on the employee profile', async () => {
    render(<EmployeeProfile />);

    await userEvent.click(screen.getByRole('tab', { name: 'Performance' }));

    expect(screen.getByText('Performance Impact')).toBeInTheDocument();
    expect(screen.getByText('Star')).toBeInTheDocument();
    expect(screen.getByText('4 peer responses')).toBeInTheDocument();
    expect(screen.getByText('Trusted partner with strong collaboration.')).toBeInTheDocument();
  });

  it('shows a loading state while performance impact is loading', async () => {
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'employee-profile') {
        return { data: profile, isLoading: false, error: null, refetch: vi.fn() };
      }
      if (key === 'employee-profile-performance') {
        return { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
      }
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    const { container } = render(<EmployeeProfile />);

    await userEvent.click(screen.getByRole('tab', { name: 'Performance' }));

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows an empty state when no performance signal exists', async () => {
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'employee-profile') {
        return { data: profile, isLoading: false, error: null, refetch: vi.fn() };
      }
      if (key === 'employee-profile-performance') {
        return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
      }
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    render(<EmployeeProfile />);

    await userEvent.click(screen.getByRole('tab', { name: 'Performance' }));

    expect(screen.getByText('No performance signal yet')).toBeInTheDocument();
  });

  it('shows an error state when performance impact cannot load', async () => {
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'employee-profile') {
        return { data: profile, isLoading: false, error: null, refetch: vi.fn() };
      }
      if (key === 'employee-profile-performance') {
        return { data: undefined, isLoading: false, error: new Error('Performance unavailable'), refetch: vi.fn() };
      }
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    render(<EmployeeProfile />);

    await userEvent.click(screen.getByRole('tab', { name: 'Performance' }));

    expect(screen.getByText('Performance data could not be loaded')).toBeInTheDocument();
  });

  it('opens a profile data change service case from self service', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ caseNumber: 'HR-20260609-ABCD1234' });
    useApiMutationMock.mockReturnValue({ mutateAsync, isPending: false });
    render(<EmployeeProfile />);

    await userEvent.selectOptions(screen.getByLabelText('What needs changing'), 'PHONE');
    await userEvent.type(screen.getByLabelText('Details'), 'Please update my mobile number to +20 100 000 0000.');
    await userEvent.click(screen.getByRole('button', { name: 'Submit change request' }));

    expect(useApiMutationMock).toHaveBeenCalledWith(
      '/hr-service-delivery/cases',
      'post',
      [['employee-services-cases']],
    );
    expect(mutateAsync).toHaveBeenCalledWith({
      caseType: 'PROFILE_DATA_CHANGE',
      priority: 'MEDIUM',
      description: expect.stringContaining('Phone'),
    });
    expect(mutateAsync.mock.calls[0][0].description).toContain('Please update my mobile number');
    expect(addNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Profile change requested',
      type: 'success',
    }));
  });

  it('opens an employee document request from the documents tab', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ caseNumber: 'HR-20260609-DCBA4321' });
    useApiMutationMock.mockReturnValue({ mutateAsync, isPending: false });
    render(<EmployeeProfile />);

    await userEvent.click(screen.getByRole('tab', { name: 'Documents' }));
    await userEvent.selectOptions(screen.getByLabelText('Document type'), 'PASSPORT');
    await userEvent.type(screen.getByLabelText('Document details'), 'I need to upload a renewed passport expiring in July.');
    await userEvent.click(screen.getByRole('button', { name: 'Submit document request' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      caseType: 'EMPLOYEE_DOCUMENT_UPDATE',
      priority: 'MEDIUM',
      description: expect.stringContaining('Passport'),
    });
    expect(mutateAsync.mock.calls[0][0].description).toContain('renewed passport');
    expect(addNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Document request submitted',
      type: 'success',
    }));
  });
});
