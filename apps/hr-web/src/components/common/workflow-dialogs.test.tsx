import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextReasonDialog } from './workflow-dialogs';

describe('TextReasonDialog', () => {
  it('does not render dialog content while closed', () => {
    render(
      <TextReasonDialog
        open={false}
        onOpenChange={vi.fn()}
        title="Suspend employee"
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps confirm disabled until a non-whitespace reason is entered, then calls onConfirm with the trimmed value', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <TextReasonDialog
        open
        onOpenChange={vi.fn()}
        title="Suspend employee"
        label="Suspension reason"
        confirmLabel="Suspend"
        onConfirm={onConfirm}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: 'Suspend' });
    expect(confirmButton).toBeDisabled();

    const textarea = screen.getByLabelText('Suspension reason');
    await user.type(textarea, '   ');
    expect(confirmButton).toBeDisabled();

    await user.type(textarea, 'Under investigation  ');
    expect(confirmButton).not.toBeDisabled();

    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledWith('Under investigation');
  });

  it('calls onOpenChange(false) when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <TextReasonDialog
        open
        onOpenChange={onOpenChange}
        title="Terminate employee"
        onConfirm={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables both actions and shows a working state while submitting', () => {
    render(
      <TextReasonDialog
        open
        onOpenChange={vi.fn()}
        title="Terminate employee"
        confirmLabel="Terminate"
        isSubmitting
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Working...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
