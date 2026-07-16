import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { EmployeeBenefits } from './benefits';

const useApiQueryMock = vi.fn();
const useApiMutationMock = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
  useApiMutation: (...args: unknown[]) => useApiMutationMock(...args),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

vi.mock('@/components/common/allowed-actions', () => ({
  AllowedActions: () => <div data-testid="allowed-actions" />,
}));

describe('EmployeeBenefits accessibility', () => {
  it('renders without accessibility violations', async () => {
    useApiQueryMock.mockReturnValue({
      data: {
        enrollments: [
          {
            id: 'ben-001',
            workerId: 'wkr-001',
            benefitType: 'HEALTH',
            planName: 'Premium Health Plan',
            coverageLevel: 'EMPLOYEE',
            effectiveDate: '2026-01-01',
            status: 'ACTIVE',
          },
        ],
        activePrograms: [
          {
            id: 'program-001',
            programName: 'Premium Health Plan',
            programType: 'HEALTH',
            status: 'ACTIVE',
          },
        ],
        openEnrollmentActive: true,
        openEnrollmentDeadline: '2026-08-01',
        lifeEvents: [
          { id: 'evt-1', type: 'MARRIAGE', date: '2026-02-01', status: 'PENDING', description: 'Recently married' },
        ],
        dependents: [
          { id: 'dep-1', name: 'Sam Nour', relationship: 'SPOUSE', dateOfBirth: '1990-05-01' },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    useApiMutationMock.mockReturnValue({ isPending: false, mutate: vi.fn(), mutateAsync: vi.fn() });

    const { container } = render(
      <MemoryRouter
        initialEntries={['/employee/benefits']}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <EmployeeBenefits />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /Benefits/i })).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
