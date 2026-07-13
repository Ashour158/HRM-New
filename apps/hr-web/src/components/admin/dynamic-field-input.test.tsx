import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DynamicFieldInput } from './dynamic-field-input';
import type { FieldRule } from '@/types';

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

function rule(overrides: Partial<FieldRule>): FieldRule {
  return {
    fieldKey: 'badgeColor',
    label: 'Badge Color',
    section: 'Custom',
    required: false,
    active: true,
    ...overrides,
  };
}

describe('DynamicFieldInput', () => {
  it('renders a text input and reports typed values for a TEXT rule', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DynamicFieldInput rule={rule({ fieldType: 'TEXT' })} value={undefined} onChange={onChange} />);

    const input = screen.getByLabelText('Badge Color');
    await user.type(input, 'Blue');

    expect(onChange).toHaveBeenLastCalledWith('e');
  });

  it('renders a number input and coerces the value to a number', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DynamicFieldInput rule={rule({ fieldKey: 'shiftCount', label: 'Shift Count', fieldType: 'NUMBER' })} value={undefined} onChange={onChange} />);

    const input = screen.getByLabelText('Shift Count');
    await user.type(input, '3');

    expect(onChange).toHaveBeenLastCalledWith(3);
  });

  it('renders a date input', () => {
    render(<DynamicFieldInput rule={rule({ fieldKey: 'startDate', label: 'Start Date', fieldType: 'DATE' })} value="2026-07-01" onChange={vi.fn()} />);
    const input = screen.getByLabelText('Start Date') as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.value).toBe('2026-07-01');
  });

  it('renders a Yes/No dropdown for a BOOLEAN rule and reports the selected option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DynamicFieldInput rule={rule({ fieldKey: 'isRemote', label: 'Is Remote', fieldType: 'BOOLEAN' })} value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Is Remote' }));
    await user.click(screen.getByRole('option', { name: 'Yes' }));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders configured options for a SELECT rule and reports the chosen value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DynamicFieldInput
        rule={rule({ fieldKey: 'shirtSize', label: 'Shirt Size', fieldType: 'SELECT', options: ['S', 'M', 'L'] })}
        value={undefined}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Shirt Size' }));
    await user.click(screen.getByRole('option', { name: 'M' }));

    expect(onChange).toHaveBeenCalledWith('M');
  });

  it('shows the required marker when the rule is required', () => {
    render(<DynamicFieldInput rule={rule({ required: true })} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });
});
