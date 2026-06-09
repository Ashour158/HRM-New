import { describe, expect, it } from 'vitest';
import { buildAdminJourneyItems } from './admin-journey';

describe('buildAdminJourneyItems', () => {
  it('prioritizes setup, people, policy, payroll, reporting, and employee preview actions', () => {
    const items = buildAdminJourneyItems({
      alertsCount: 2,
      headcount: 120,
      highSeverityAlerts: 1,
      newHiresThisMonth: 4,
      openPositions: 9,
    });

    expect(items.map((item) => item.label)).toEqual([
      'System Console',
      'Organization Setup',
      'Create Employee',
      'Policy Controls',
      'Payroll Readiness',
      'HR Reports',
    ]);
    expect(items[0]).toMatchObject({ status: '2 alerts', href: '/admin/system-console', tone: 'attention' });
    expect(items[1]).toMatchObject({ status: '120 workers', href: '/admin/organization', tone: 'success' });
    expect(items[2]).toMatchObject({ status: '9 open roles', href: '/admin/employees/new', tone: 'attention' });
    expect(items[3]).toMatchObject({ href: '/admin/system-console/policies' });
    expect(items[5]).toMatchObject({ href: '/admin/reports' });
  });

  it('shows clear setup states when the admin workspace is stable', () => {
    const items = buildAdminJourneyItems({
      headcount: 0,
      openPositions: 0,
    });

    expect(items[0]).toMatchObject({ status: 'Ready', tone: 'success' });
    expect(items[1]).toMatchObject({ status: 'Start setup', actionLabel: 'Create structure', tone: 'warning' });
    expect(items[2]).toMatchObject({ status: 'Roster ready', actionLabel: 'Open employee list', tone: 'default' });
  });
});
