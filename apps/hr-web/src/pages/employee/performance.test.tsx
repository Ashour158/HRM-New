import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmployeePerformance } from './performance';

const useApiQueryMock = vi.fn();

const worker = {
  id: '00000000-0000-0000-0000-000000000020',
  firstName: 'Regular',
  lastName: 'Employee',
  email: 'employee@example.com',
};

const eligibleReviewees = [
  {
    id: '00000000-0000-0000-0000-000000000011',
    firstName: 'Line',
    lastName: 'Manager',
    relationshipType: 'DIRECT_REPORT',
  },
];

const feedbackCycles = [
  {
    id: { value: '00000000-0000-0000-0000-000000000201' },
    name: 'Smoke Test',
    status: 'ACTIVE',
  },
  {
    id: { value: '00000000-0000-0000-0000-000000000202' },
    name: 'QA 360 Audit',
    status: 'ACTIVE',
  },
];

const emptyArray: unknown[] = [];

vi.mock('@/hooks/use-api', () => ({
  useApiQuery: (...args: unknown[]) => useApiQueryMock(...args),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      email: 'employee@example.com',
      firstName: 'Regular',
      lastName: 'Employee',
    },
  }),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: vi.fn() },
}));

describe('EmployeePerformance', () => {
  it('renders object-shaped cycle ids as stable select values', () => {
    useApiQueryMock.mockImplementation((queryKey: unknown) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'employee-performance-worker') {
        return { data: worker };
      }
      if (key === 'employee-performance-eligible-feedback-reviewees') {
        return { data: eligibleReviewees };
      }
      if (key === 'employee-performance-feedback-cycles') {
        return { data: feedbackCycles };
      }
      if (key === 'employee-performance-action-plan') return { data: undefined };
      return { data: emptyArray };
    });

    render(<EmployeePerformance />);

    const cycleSelect = screen.getByLabelText('Cycle') as HTMLSelectElement;
    const values = Array.from(cycleSelect.options).map((option) => option.value);
    expect(values).toEqual([
      '00000000-0000-0000-0000-000000000201',
      '00000000-0000-0000-0000-000000000202',
    ]);
    expect(values).not.toContain('[object Object]');
  });
});
