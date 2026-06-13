import { describe, expect, it, vi } from 'vitest';
import { axe } from 'jest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { DateRangePicker } from './date-range-picker';
import { Combobox } from './combobox';
import { CommandPalette } from './command-palette';
import { Pagination } from './pagination';
import { Breadcrumbs } from './breadcrumbs';
import { Tooltip } from './tooltip';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './sheet';
import { ThemeToggle } from './theme-toggle';
import { BulkActionToolbar } from './bulk-action-toolbar';
import { LineChartPanel, BarChartPanel, DonutChartPanel } from './charts';

const navItems = [
  { label: 'Dashboard', path: '/employee' },
  { label: 'Reports', path: '/admin/reports' },
];

describe('design-system primitives accessibility', () => {
  it('renders keyboard-friendly form, nav, overlay, chart, and toolbar primitives without a11y violations', async () => {
    const user = userEvent.setup();
    const onThemeChange = vi.fn();
    const onBulkApprove = vi.fn();
    const onPageChange = vi.fn();

    const { container } = render(
      <BrowserRouter>
        <div>
          <ThemeToggle onThemeChange={onThemeChange} />
          <DateRangePicker
            label="Report period"
            value={{ from: '2026-06-01', to: '2026-06-30' }}
            onChange={vi.fn()}
          />
          <Combobox
            label="Choose department"
            value="people"
            options={[
              { value: 'people', label: 'People Operations' },
              { value: 'payroll', label: 'Payroll' },
            ]}
            onChange={vi.fn()}
          />
          <CommandPalette items={navItems} />
          <Breadcrumbs items={[{ label: 'Admin', href: '/admin' }, { label: 'Reports' }]} />
          <Tooltip content="Open payroll controls">
            <button type="button">Payroll hint</button>
          </Tooltip>
          <Sheet>
            <SheetTrigger asChild><button type="button">Open drawer</button></SheetTrigger>
            <SheetContent>
              <SheetTitle>Drawer title</SheetTitle>
              <p>Drawer body</p>
            </SheetContent>
          </Sheet>
          <Pagination page={2} pageCount={5} onPageChange={onPageChange} />
          <BulkActionToolbar
            selectedCount={3}
            actions={[{ label: 'Approve selected', onClick: onBulkApprove }]}
            onClearSelection={vi.fn()}
          />
          <LineChartPanel title="Attendance trend" data={[{ label: 'Mon', value: 8 }, { label: 'Tue', value: 7 }]} />
          <BarChartPanel title="Leave by type" data={[{ label: 'Annual', value: 4 }, { label: 'Sick', value: 1 }]} />
          <DonutChartPanel title="Gender distribution" data={[{ label: 'Women', value: 55 }, { label: 'Men', value: 45 }]} />
        </div>
      </BrowserRouter>,
    );

    expect(screen.getByLabelText('Report period from')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Choose department' })).toBeInTheDocument();
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Toggle color theme' }));
    expect(onThemeChange).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Approve selected' }));
    expect(onBulkApprove).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    expect(await axe(container)).toHaveNoViolations();
  });
});
