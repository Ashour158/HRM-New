import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Umbrella } from 'lucide-react';
import { ReportCard } from './report-card';

describe('ReportCard', () => {
  it('renders the title, description, and badge', () => {
    render(
      <ReportCard
        icon={Umbrella}
        title="Time-Off Balance & History"
        description="Your accrual balances and leave request history."
        badge="LEAVE"
        actionLabel="View report"
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText('Time-Off Balance & History')).toBeInTheDocument();
    expect(screen.getByText('Your accrual balances and leave request history.')).toBeInTheDocument();
    expect(screen.getByText('LEAVE')).toBeInTheDocument();
  });

  it('invokes onAction when the button is clicked', async () => {
    const onAction = vi.fn();
    render(
      <ReportCard
        icon={Umbrella}
        title="Time-Off Balance & History"
        description="Your accrual balances and leave request history."
        actionLabel="View report"
        onAction={onAction}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'View report' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('disables the action button while loading', () => {
    render(
      <ReportCard
        icon={Umbrella}
        title="Time-Off Balance & History"
        description="Your accrual balances and leave request history."
        actionLabel="View report"
        onAction={vi.fn()}
        isLoading
      />,
    );
    expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();
  });
});
