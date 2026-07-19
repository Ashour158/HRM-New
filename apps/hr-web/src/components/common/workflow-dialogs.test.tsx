import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ActionChoiceDialog,
  DimensionRatingDialog,
  RatingDialog,
  TextReasonDialog,
} from './workflow-dialogs';

describe('TextReasonDialog', () => {
  it('does not render its content while closed', () => {
    render(
      <TextReasonDialog
        open={false}
        onOpenChange={vi.fn()}
        title="Terminate employee"
        label="Termination reason"
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens and blocks submit until the required reason is filled in', async () => {
    const onSubmit = vi.fn();
    render(
      <TextReasonDialog
        open
        onOpenChange={vi.fn()}
        title="Terminate employee"
        label="Termination reason"
        submitLabel="Terminate"
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Terminate employee' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Terminate' }));
    expect(await screen.findByText('This field is required.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Termination reason'), '  Redundancy  ');
    await userEvent.click(screen.getByRole('button', { name: 'Terminate' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('Redundancy');
  });

  it('cancel closes without calling onSubmit', async () => {
    const onSubmit = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <TextReasonDialog
        open
        onOpenChange={onOpenChange}
        title="Suspend employee"
        label="Suspension reason"
        onSubmit={onSubmit}
      />,
    );

    await userEvent.type(screen.getByLabelText('Suspension reason'), 'Investigation pending');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('RatingDialog', () => {
  it('pre-fills the default value and blocks submit for out-of-range values', async () => {
    const onSubmit = vi.fn();
    render(
      <RatingDialog
        open
        onOpenChange={vi.fn()}
        title="Set calibration rating"
        label="Calibration rating"
        min={1}
        max={5}
        defaultValue={3}
        onSubmit={onSubmit}
      />,
    );

    const input = screen.getByLabelText('Calibration rating') as HTMLInputElement;
    expect(input.value).toBe('3');

    await userEvent.clear(input);
    await userEvent.type(input, '9');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Enter a number between 1 and 5.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.clear(input);
    await userEvent.type(input, '4.5');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).toHaveBeenCalledWith(4.5);
  });

  it('cancel closes without calling onSubmit', async () => {
    const onSubmit = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <RatingDialog
        open
        onOpenChange={onOpenChange}
        title="Set final rating"
        label="Final rating"
        defaultValue={3}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('ActionChoiceDialog', () => {
  const choices = [
    { value: 'REVIEW', label: 'Enter review' },
    {
      value: 'EXTEND',
      label: 'Extend',
      field: { type: 'date' as const, label: 'New end date', defaultValue: '2026-08-01', required: true },
    },
    { value: 'TERMINATE', label: 'Terminate' },
  ];

  it('submits the default choice with no follow-up field', async () => {
    const onSubmit = vi.fn();
    render(
      <ActionChoiceDialog
        open
        onOpenChange={vi.fn()}
        title="Improvement plan"
        choices={choices}
        defaultChoice="REVIEW"
        onSubmit={onSubmit}
      />,
    );

    expect(screen.queryByLabelText('New end date')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).toHaveBeenCalledWith('REVIEW', undefined);
  });

  it('shows the inline field for a choice that needs one and blocks submit until it is filled', async () => {
    const onSubmit = vi.fn();
    render(
      <ActionChoiceDialog
        open
        onOpenChange={vi.fn()}
        title="Improvement plan"
        choices={choices}
        defaultChoice="REVIEW"
        onSubmit={onSubmit}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Extend' }));
    const dateField = screen.getByLabelText('New end date') as HTMLInputElement;
    expect(dateField.value).toBe('2026-08-01');

    await userEvent.clear(dateField);
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('This field is required.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(dateField, '2026-09-15');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).toHaveBeenCalledWith('EXTEND', '2026-09-15');
  });

  it('cancel closes without calling onSubmit', async () => {
    const onSubmit = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ActionChoiceDialog
        open
        onOpenChange={onOpenChange}
        title="Improvement plan"
        choices={choices}
        defaultChoice="TERMINATE"
        onSubmit={onSubmit}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('DimensionRatingDialog', () => {
  const dimensions = [
    { key: 'communication', label: 'Communication' },
    { key: 'teamwork', label: 'Teamwork' },
  ];

  it('pre-fills every dimension and submits per-dimension scores', async () => {
    const onSubmit = vi.fn();
    render(
      <DimensionRatingDialog
        open
        onOpenChange={vi.fn()}
        title="Submit 360 feedback"
        dimensions={dimensions}
        defaultValue={4}
        onSubmit={onSubmit}
      />,
    );

    const communication = screen.getByLabelText('Communication') as HTMLInputElement;
    const teamwork = screen.getByLabelText('Teamwork') as HTMLInputElement;
    expect(communication.value).toBe('4');
    expect(teamwork.value).toBe('4');

    await userEvent.clear(teamwork);
    await userEvent.type(teamwork, '5');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).toHaveBeenCalledWith({ communication: 4, teamwork: 5 });
  });

  it('blocks submit when a dimension is out of range', async () => {
    const onSubmit = vi.fn();
    render(
      <DimensionRatingDialog
        open
        onOpenChange={vi.fn()}
        title="Submit 360 feedback"
        dimensions={dimensions}
        min={1}
        max={5}
        defaultValue={4}
        onSubmit={onSubmit}
      />,
    );

    const communication = screen.getByLabelText('Communication') as HTMLInputElement;
    await userEvent.clear(communication);
    await userEvent.type(communication, '12');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Enter a rating between 1 and 5 for every area.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
