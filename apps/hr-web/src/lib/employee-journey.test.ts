import { describe, expect, it } from 'vitest';
import { buildEmployeeJourneyItems } from './employee-journey';

describe('buildEmployeeJourneyItems', () => {
  const byLabel = (items: ReturnType<typeof buildEmployeeJourneyItems>, label: string) => {
    const item = items.find((candidate) => candidate.label === label);
    expect(item).toBeDefined();
    return item!;
  };

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

  it('shows check-out as the next attendance action while a shift is open', () => {
    const attendance = byLabel(buildEmployeeJourneyItems({
      attendance: { canCheckOut: true, statusLabel: 'Clocked in', workedTodayMinutes: 240 },
    }), 'Attendance');

    expect(attendance).toEqual(expect.objectContaining({
      actionLabel: 'Check out',
      status: 'In progress',
      tone: 'success',
    }));
  });

  it('falls back to the current attendance ledger when no punch action is available', () => {
    const attendance = byLabel(buildEmployeeJourneyItems({
      attendance: { canCheckIn: false, canCheckOut: false, statusLabel: 'Closed for today' },
    }), 'Attendance');

    expect(attendance).toEqual(expect.objectContaining({
      actionLabel: 'View ledger',
      status: 'Closed for today',
      tone: 'default',
    }));
  });

  it('warns when leave balances are missing or exhausted', () => {
    const missingLeave = byLabel(buildEmployeeJourneyItems({ leaveBalances: [] }), 'Leave');
    const zeroLeave = byLabel(buildEmployeeJourneyItems({
      leaveBalances: [{ type: 'Annual leave', balance: 0, unit: 'days' }],
    }), 'Leave');

    expect(missingLeave).toEqual(expect.objectContaining({
      status: 'Not configured',
      tone: 'warning',
    }));
    expect(zeroLeave).toEqual(expect.objectContaining({
      status: '0 days',
      tone: 'warning',
    }));
  });

  it('flags incomplete profile and missing payslip signals', () => {
    const items = buildEmployeeJourneyItems({
      profileComplete: false,
      hasRecentPayslip: false,
    });

    expect(byLabel(items, 'Profile')).toEqual(expect.objectContaining({
      status: 'Needs review',
      tone: 'warning',
    }));
    expect(byLabel(items, 'Payslips')).toEqual(expect.objectContaining({
      status: 'No current slip',
      tone: 'default',
    }));
  });

  it('selects paid leave without matching unpaid leave substrings', () => {
    const leave = byLabel(buildEmployeeJourneyItems({
      leaveBalances: [
        { type: 'Unpaid leave', balance: 30, unit: 'days' },
        { type: 'Annual leave', balance: 12, unit: 'days' },
      ],
    }), 'Leave');

    expect(leave).toEqual(expect.objectContaining({
      status: '12 days',
      tone: 'success',
    }));
  });
});
