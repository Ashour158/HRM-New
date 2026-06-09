import { describe, expect, it } from 'vitest';
import { buildEmployeeJourneyItems } from './employee-journey';

describe('buildEmployeeJourneyItems', () => {
  it('turns employee workspace signals into business next actions', () => {
    const items = buildEmployeeJourneyItems({
      attendance: {
        canCheckIn: true,
        canCheckOut: false,
        statusLabel: 'Yet to check-in',
        workedTodayMinutes: 0,
      },
      leaveBalances: [{ type: 'Annual leave', balance: 14.5, unit: 'days' }],
      pendingTaskCount: 3,
      profileComplete: true,
      hasRecentPayslip: true,
    });

    expect(items.map((item) => item.label)).toEqual([
      'Attendance',
      'Leave',
      'Payslips',
      'Benefits',
      'Onboarding',
      'Performance',
      'HR Services',
      'Profile',
    ]);
    expect(items[0]).toEqual(expect.objectContaining({
      label: 'Attendance',
      status: 'Ready',
      actionLabel: 'Check in',
      href: '/employee#attendance',
    }));
    expect(items[1]).toEqual(expect.objectContaining({
      status: '14.5 days',
      actionLabel: 'Apply for leave',
    }));
    expect(items[4]).toEqual(expect.objectContaining({
      status: '3 pending',
      tone: 'warning',
    }));
    expect(items[7]).toEqual(expect.objectContaining({
      status: 'Complete',
      tone: 'success',
    }));
  });
});
