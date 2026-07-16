import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { EmployeeTimeOff } from './time-off';

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

function isoDateDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function setupQueries() {
  useApiQueryMock.mockImplementation((key: unknown[]) => {
    const queryKey = key[0];
    if (queryKey === 'employee-absences') {
      return { data: [], isLoading: false, error: null };
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
          publicHolidays: [],
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
    reset: vi.fn(),
    mutateAsync: vi.fn(async () => ({ status: 'PENDING', approvalWorkflow: 'MANAGER' })),
  });
}

function renderTimeOff() {
  setupQueries();
  return render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <EmployeeTimeOff />
    </MemoryRouter>,
  );
}

describe('EmployeeTimeOff guided request', () => {
  it('walks through policy, dates, and review steps', async () => {
    const user = userEvent.setup();
    renderTimeOff();

    await user.click(screen.getByRole('button', { name: 'New leave request' }));

    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Policy')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: /leave type/i }));
    await user.click(screen.getByRole('option', { name: /annual leave/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/start date/i), isoDateDaysFromNow(1));
    await user.type(screen.getByLabelText(/end date/i), isoDateDaysFromNow(2));
    await user.click(screen.getByRole('button', { name: /continue/i }));

    const summary = screen.getByText('Request Summary').closest('div');
    expect(summary).not.toBeNull();
    expect(within(summary as HTMLElement).getByText(/annual leave/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit request/i })).toBeEnabled();
  });
});
