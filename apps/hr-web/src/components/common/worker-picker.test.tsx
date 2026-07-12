import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkerPicker } from './worker-picker';

const apiClientGetMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
  },
}));

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

// Matches the minimal shape returned by GET /hr/core/workers/directory-search
// (no email/status/hireDate — those stay on the full HR-core admin payload).
const alice = {
  id: '00000000-0000-4000-8000-000000000101',
  employeeId: 'EMP-1001',
  firstName: 'Alice',
  lastName: 'Nguyen',
  jobTitle: 'Senior Engineer',
};

const alan = {
  id: '00000000-0000-4000-8000-000000000102',
  employeeId: 'EMP-1002',
  firstName: 'Alan',
  lastName: 'Ortiz',
  jobTitle: 'Product Manager',
};

function renderPicker(props: Partial<React.ComponentProps<typeof WorkerPicker>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onChange = vi.fn();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <WorkerPicker value="" onChange={onChange} ariaLabel="Worker" {...props} />
    </QueryClientProvider>,
  );
  return { ...utils, onChange };
}

describe('WorkerPicker', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url.startsWith('/hr/core/workers/directory-search?search=ali')) {
        return apiResponse([alice, alan]);
      }
      if (url.startsWith('/hr/core/workers/directory-search?search=')) {
        return apiResponse([]);
      }
      return apiResponse([]);
    });
  });

  it('does not search until the user types, and collapses rapid keystrokes into one debounced request', async () => {
    const user = userEvent.setup();
    renderPicker();

    expect(apiClientGetMock).not.toHaveBeenCalled();

    const input = screen.getByRole('combobox');
    await user.type(input, 'ali');

    // Right after typing, the debounce window (300ms) has not elapsed yet.
    expect(apiClientGetMock).not.toHaveBeenCalled();

    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledTimes(1));
    expect(apiClientGetMock).toHaveBeenCalledWith('/hr/core/workers/directory-search?search=ali&pageSize=10');
  });

  it('renders matching workers with name, employee id, and job title', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.type(screen.getByRole('combobox'), 'ali');

    expect(await screen.findByText('Alice Nguyen')).toBeInTheDocument();
    expect(screen.getByText('EMP-1001 • Senior Engineer')).toBeInTheDocument();
    expect(screen.getByText('Alan Ortiz')).toBeInTheDocument();
    expect(screen.getByText('EMP-1002 • Product Manager')).toBeInTheDocument();
  });

  it('calls onChange with the worker id and label when a result is picked', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker();

    await user.type(screen.getByRole('combobox'), 'ali');
    const option = await screen.findByText('Alice Nguyen');
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith(alice.id, 'Alice Nguyen');
    expect(screen.getByRole('combobox')).toHaveValue('Alice Nguyen');
  });

  it('shows a loading state while the search request is in flight', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    apiClientGetMock.mockImplementation(
      () => new Promise((resolve) => { resolveRequest = resolve; }),
    );
    const user = userEvent.setup();
    renderPicker();

    await user.type(screen.getByRole('combobox'), 'ali');

    expect(await screen.findByText(/Searching workers/i)).toBeInTheDocument();

    resolveRequest({ data: { success: true, data: [alice] } });
    expect(await screen.findByText('Alice Nguyen')).toBeInTheDocument();
  });

  it('shows an empty state when no workers match the search', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.type(screen.getByRole('combobox'), 'zzz');

    expect(await screen.findByText(/No matching workers found/i)).toBeInTheDocument();
  });

  it('shows an error state when the search request fails', async () => {
    apiClientGetMock.mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    renderPicker();

    await user.type(screen.getByRole('combobox'), 'ali');

    expect(await screen.findByText(/Unable to search workers/i)).toBeInTheDocument();
  });

  it('shows a clear affordance for an existing selection and reports empty id/label on clear', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker({ value: alice.id });

    expect(screen.getByRole('combobox')).toHaveValue(alice.id);
    const clearButton = screen.getByRole('button', { name: /clear selected worker/i });
    await user.click(clearButton);

    expect(onChange).toHaveBeenLastCalledWith('', '');
    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('behaves as a drop-in controlled component when the parent wires value + onChange together', async () => {
    function ControlledHarness({ onSelect }: { onSelect: (id: string, label: string) => void }) {
      const [value, setValue] = React.useState('');
      return (
        <WorkerPicker
          value={value}
          ariaLabel="Worker"
          onChange={(workerId, workerLabel) => {
            setValue(workerId);
            onSelect(workerId, workerLabel);
          }}
        />
      );
    }

    const onSelect = vi.fn();
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ControlledHarness onSelect={onSelect} />
      </QueryClientProvider>,
    );

    await user.type(screen.getByRole('combobox'), 'ali');
    await user.click(await screen.findByText('Alice Nguyen'));

    expect(onSelect).toHaveBeenCalledWith(alice.id, 'Alice Nguyen');
    expect(screen.getByRole('combobox')).toHaveValue('Alice Nguyen');

    // Now that the parent's state reflects the selection, clearing should propagate through.
    await user.click(screen.getByRole('button', { name: /clear selected worker/i }));
    expect(onSelect).toHaveBeenLastCalledWith('', '');
    expect(screen.getByRole('combobox')).toHaveValue('');
  });
});
