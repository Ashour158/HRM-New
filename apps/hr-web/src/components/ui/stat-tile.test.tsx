import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Users } from 'lucide-react';
import { StatTile } from './stat-tile';

describe('StatTile', () => {
  it('renders a label and value with an icon in the default (card, trailing) layout', () => {
    render(<StatTile icon={Users} label="Direct Reports" value={12} />);

    expect(screen.getByText('Direct Reports')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders without an icon when none is provided', () => {
    const { container } = render(<StatTile label="Checklist" value="4 tasks" />);

    expect(screen.getByText('Checklist')).toBeInTheDocument();
    expect(screen.getByText('4 tasks')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renders helper text under the value when provided', () => {
    render(<StatTile icon={Users} label="Live Records" value={7} helperText="Persisted operational records in this workspace" />);

    expect(screen.getByText('Persisted operational records in this workspace')).toBeInTheDocument();
  });

  it('does not render a helper paragraph when helperText is omitted', () => {
    render(<StatTile label="Jobs" value={2} />);

    expect(screen.queryByText(/persisted/i)).not.toBeInTheDocument();
  });

  it('places the icon before the label/value for iconPosition="leading"', () => {
    const { container } = render(<StatTile icon={Users} iconPosition="leading" label="Active plans" value={3} />);
    const row = screen.getByText('Active plans').closest('div')?.parentElement;

    expect(row?.firstElementChild?.tagName).toBe('SPAN');
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('places the icon after the label/value for iconPosition="trailing" (default when an icon is given)', () => {
    render(<StatTile icon={Users} label="Assignments" value={5} />);
    const row = screen.getByText('Assignments').closest('div')?.parentElement;

    // the text block comes first, the icon wrapper second, for trailing layout
    expect(row?.lastElementChild?.tagName).toBe('SPAN');
  });

  it('renders the icon inline with the label for iconPosition="inline"', () => {
    render(<StatTile icon={Users} iconPosition="inline" label="Owner groups" value={2} />);

    // inline mode renders label and icon inside the same flex row, no separate icon box wrapper
    expect(screen.getByText('Owner groups')).toBeInTheDocument();
  });

  it.each([
    ['default', 'bg-accent'],
    ['alert', 'bg-rose-50'],
    ['success', 'bg-emerald-50'],
    ['primary', 'bg-primary/10'],
    ['secondary', 'bg-secondary/10'],
    ['info', 'bg-info/10'],
  ] as const)('applies the %s tone to the icon box', (tone, expectedClass) => {
    const { container } = render(<StatTile icon={Users} tone={tone} label="Metric" value={1} />);
    const iconBox = container.querySelector('span');

    expect(iconBox?.className).toContain(expectedClass);
  });

  it('lets iconBoxClassName fully override the computed tone classes', () => {
    const { container } = render(
      <StatTile icon={Users} tone="alert" label="Metric" value={1} iconBoxClassName="custom-icon-box" />,
    );
    const iconBox = container.querySelector('span');

    expect(iconBox?.className).toBe('custom-icon-box');
  });

  it('renders the glass variant with the fusion-glass treatment and hover lift by default', () => {
    const { container } = render(<StatTile variant="glass" label="Review Cycles" value={4} />);
    const root = container.firstElementChild;

    expect(root?.className).toContain('fusion-glass');
    expect(root?.className).toContain('fusion-hover');
  });

  it('omits the hover lift on the glass variant when hover is false', () => {
    const { container } = render(<StatTile variant="glass" hover={false} label="Checklist" value="4 tasks" />);
    const root = container.firstElementChild;

    expect(root?.className).toContain('fusion-glass');
    expect(root?.className).not.toContain('fusion-hover');
  });

  it('renders the plain variant with a bordered box instead of a Card', () => {
    const { container } = render(<StatTile variant="plain" label="Payable" value="8h" />);
    const root = container.firstElementChild;

    expect(root?.className).toContain('border');
    expect(root?.className).not.toContain('fusion-glass');
  });

  it('renders the strip variant with divider classes for the given breakpoint', () => {
    const { container } = render(<StatTile variant="strip" stripBreakpoint="md" label="Total Modules" value={9} />);
    const root = container.firstElementChild;

    expect(root?.className).toContain('md:border-r');
    expect(root?.className).toContain('min-h-[88px]');
  });

  it('renders a gradient top accent bar when topAccent is set on the card variant', () => {
    const { container } = render(<StatTile variant="card" topAccent label="Live Records" value={1} />);

    expect(container.querySelector('.bg-gradient-to-r')).toBeInTheDocument();
  });

  it('applies size-driven value classes (sm/md/lg) when valueClassName is not provided', () => {
    const { rerender } = render(<StatTile label="Value" value={1} size="sm" />);
    expect(screen.getByText('1').className).toContain('text-xl');

    rerender(<StatTile label="Value" value={1} size="lg" />);
    expect(screen.getByText('1').className).toContain('text-3xl');
  });

  it('lets valueClassName override the computed size/tone classes', () => {
    render(<StatTile label="Value" value={1} valueClassName="custom-value-class" />);

    const valueEl = screen.getByText('1');
    expect(valueEl.className).toContain('custom-value-class');
    expect(valueEl.className).not.toContain('text-2xl');
  });

  it('lets labelClassName override the computed label classes', () => {
    render(<StatTile label="Custom label" value={1} labelClassName="custom-label-class" />);

    expect(screen.getByText('Custom label').className).toBe('custom-label-class');
  });

  it('lets helperClassName override the default helper text classes', () => {
    render(<StatTile label="Value" value={1} helperText="detail" helperClassName="custom-helper-class" />);

    expect(screen.getByText('detail').className).toBe('custom-helper-class');
  });

  it('forwards data-testid to the outer container', () => {
    render(<StatTile label="Value" value={1} data-testid="my-stat-tile" />);

    expect(screen.getByTestId('my-stat-tile')).toBeInTheDocument();
  });

  it('renders numeric and string values as-is', () => {
    render(<StatTile label="Count" value={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
