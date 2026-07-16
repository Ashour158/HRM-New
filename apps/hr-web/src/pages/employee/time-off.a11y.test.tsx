import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { EmployeeTimeOff } from './time-off';

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
  AllowedActions: ({ onAction }: { onAction: () => void }) => (
    <button type="button" onClick={onAction}>New leave request</button>
  ),
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

describe('EmployeeTimeOff accessibility', () => {
  it('renders without accessibility violations', async () => {
    useApiQueryMock.mockImplementation((key: unknown[]) => {
      const queryKey = key[0];
      if (queryKey === 'employee-absences') {
        return {
          data: [
            {
              id: 'req-1',
              type: 'ANNUAL',
              startDate: '2026-07-20',
              endDate: '2026-07-22',
              status: 'PENDING',
              durationAmount: 3,
              durationUnit: 'DAYS',
              paid: true,
              reason: 'Family trip',
              requestedAt: '2026-07-10T00:00:00.000Z',
            },
          ],
          isLoading: false,
          error: null,
        };
      }
      if (queryKey === 'employee-absence-balance') {
        return {
          data: [{ type: 'ANNUAL', label: 'Annual Leave', total: 21, used: 2, remaining: 19, unit: 'DAYS' }],
          isLoading: false,
          error: null,
        };
      }
      if (queryKey === 'employee-absence-policies') {
        return {
          data: {
            policies: [{
              code: 'ANNUAL',
              label: 'Annual Leave',
              unit: 'DAYS',
              approvalWorkflow: 'MANAGER',
              maxPerRequest: 15,
              minNoticeDays: 0,
              deductFromBalance: true,
              payrollImpact: 'PAID_LEAVE',
              paid: true,
            }],
            publicHolidays: [{ date: '2026-12-25', name: 'Holiday', countryCode: 'US' }],
            standardDailyMinutes: 480,
            workDays: [1, 2, 3, 4, 5],
          },
          isLoading: false,
          error: null,
        };
      }
      return { data: undefined, isLoading: false, error: null };
    });
    useApiMutationMock.mockReturnValue({
      isPending: false,
      error: null,
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      reset: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <EmployeeTimeOff />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /Time Off/i })).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
