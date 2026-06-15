import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { InlineEdit } from './inline-edit';

describe('InlineEdit', () => {
  it('switches from display mode to edit mode and saves with Enter', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => undefined);

    render(<InlineEdit value="HR Specialist" label="Job title" onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Edit Job title' }));
    const input = screen.getByRole('textbox', { name: 'Job title' });
    await user.clear(input);
    await user.type(input, 'HR Manager{Enter}');

    expect(onSave).toHaveBeenCalledWith('HR Manager');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit Job title' })).toHaveTextContent('HR Manager'));
  });

  it('cancels edits with Escape and blur without saving', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => undefined);

    render(
      <div>
        <InlineEdit value="Finance" label="Department" onSave={onSave} />
        <button type="button">Outside</button>
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Edit Department' }));
    await user.clear(screen.getByRole('textbox', { name: 'Department' }));
    await user.type(screen.getByRole('textbox', { name: 'Department' }), 'Operations{Escape}');
    expect(screen.getByRole('button', { name: 'Edit Department' })).toHaveTextContent('Finance');

    await user.click(screen.getByRole('button', { name: 'Edit Department' }));
    await user.clear(screen.getByRole('textbox', { name: 'Department' }));
    await user.type(screen.getByRole('textbox', { name: 'Department' }), 'Legal');
    await user.click(screen.getByRole('button', { name: 'Outside' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit Department' })).toHaveTextContent('Finance');
  });

  it('has no obvious accessibility violations', async () => {
    const { container } = render(<InlineEdit value="Amina Hassan" label="Employee name" onSave={async () => undefined} />);

    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
