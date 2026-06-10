import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { EmployeeBenefits } from './benefits';

const useApiQueryMock = vi.fn();
const useApiMutationMock = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
  useApiMutation: (...args: unknown[]) => useApiMutationMock(...args),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) =>
    selector({ addNotification: vi.fn() }),
}));

vi.mock('@/components/common/allowed-actions', () => ({
  AllowedActions: () => <div data-testid="allowed-actions" />,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderBenefits(initialPath: string) {
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
      openEnrollmentActive: false,
      lifeEvents: [],
      dependents: [],
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
  useApiMutationMock.mockReturnValue({ isPending: false, mutate: vi.fn() });

  return render(
    <MemoryRouter
      initialEntries={[initialPath]}
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <LocationProbe />
      <Routes>
        <Route path="/employee/benefits/*" element={<EmployeeBenefits />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EmployeeBenefits route sections', () => {
  it('selects the life events section from the focused subroute', () => {
    renderBenefits('/employee/benefits/life-events');

    expect(screen.getByRole('tab', { name: 'Life Events' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Coverage' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('moves between focused benefits subroutes from the section tabs', async () => {
    const user = userEvent.setup();
    renderBenefits('/employee/benefits');

    await user.click(screen.getByRole('tab', { name: 'Dependents' }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/employee/benefits/dependents',
    );
    expect(screen.getByRole('tab', { name: 'Dependents' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
