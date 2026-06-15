import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PreviewPanel, RuleRow, WorkflowStepBuilder } from '.';

describe('builder primitives', () => {
  it('edits workflow step routing and move controls', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onMove = vi.fn();

    render(
      <WorkflowStepBuilder
        index={0}
        code="HR_REVIEW"
        label="HR review"
        order={1}
        mode="SEQUENTIAL"
        approverType="ROLE"
        approverRole="HR_ADMIN"
        slaHours={24}
        escalationAfterHours={48}
        escalationApproverRole="LEGAL"
        onChange={onChange}
        onMove={onMove}
        onRemove={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Mode'), 'PARALLEL');
    expect(onChange).toHaveBeenCalledWith({ mode: 'PARALLEL' });

    await user.click(screen.getByRole('button', { name: 'Move down' }));
    expect(onMove).toHaveBeenCalledWith('down');
  });

  it('renders readable rule rows and preview metrics', () => {
    render(
      <div>
        <RuleRow code="LATE_GRACE" label="Late arrival grace" outcome="Deduct" detail="Monthly cap 3" />
        <PreviewPanel items={[{ label: 'Steps', value: 2 }, { label: 'Total SLA', value: '48h' }]} />
      </div>,
    );

    expect(screen.getByText('Late arrival grace')).toBeInTheDocument();
    expect(screen.getByText('Monthly cap 3')).toBeInTheDocument();
    expect(screen.getByText('Total SLA')).toBeInTheDocument();
  });
});
