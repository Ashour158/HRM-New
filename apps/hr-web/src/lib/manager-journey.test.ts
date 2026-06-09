import { describe, expect, it } from 'vitest';
import { buildManagerJourneyItems } from './manager-journey';

describe('buildManagerJourneyItems', () => {
  it('prioritizes manager work from approvals, attendance, performance, and roster signals', () => {
    const items = buildManagerJourneyItems({
      averagePerformance: 72,
      directReportCount: 8,
      openGoals: 5,
      pendingExpenses: 1,
      pendingLeaveApprovals: 2,
      pendingTimesheets: 3,
      teamAttendanceExceptions: 4,
    });

    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({
      label: 'Approvals',
      status: '6 waiting',
      actionLabel: 'Review decisions',
      href: '/manager/approvals',
      tone: 'attention',
    });
    expect(items[1]).toMatchObject({
      label: 'Team Attendance',
      status: '4 exceptions',
      tone: 'warning',
    });
    expect(items[2]).toMatchObject({
      label: 'Performance Coaching',
      status: '72% average',
      tone: 'warning',
    });
    expect(items[3]).toMatchObject({
      label: 'Team Roster',
      status: '8 reports',
      tone: 'success',
    });
  });

  it('shows clear states when manager work is up to date', () => {
    const items = buildManagerJourneyItems({
      averagePerformance: 88,
      directReportCount: 0,
    });

    expect(items[0]).toMatchObject({ status: 'Clear', tone: 'success' });
    expect(items[1]).toMatchObject({ status: 'On track', tone: 'default' });
    expect(items[2]).toMatchObject({ status: '88% average', tone: 'default' });
    expect(items[3]).toMatchObject({ status: 'No reports', actionLabel: 'Check assignments', tone: 'warning' });
  });
});
