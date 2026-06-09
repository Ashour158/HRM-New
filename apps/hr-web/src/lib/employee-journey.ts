export type EmployeeJourneyTone = 'attention' | 'default' | 'success' | 'warning';

export interface EmployeeJourneyItem {
  actionLabel: string;
  category: string;
  href: string;
  label: string;
  status: string;
  tone: EmployeeJourneyTone;
}

interface LeaveBalanceSignal {
  balance: number;
  type: string;
  unit: string;
}

export interface EmployeeJourneySignals {
  attendance?: {
    canCheckIn?: boolean;
    canCheckOut?: boolean;
    statusLabel?: string;
    workedTodayMinutes?: number;
  };
  hasRecentPayslip?: boolean;
  leaveBalances?: LeaveBalanceSignal[];
  pendingTaskCount?: number;
  profileComplete?: boolean;
}

function formatLeaveBalance(balance?: LeaveBalanceSignal): string {
  if (!balance) return 'Not configured';
  const rounded = Math.round(balance.balance * 10) / 10;
  return `${rounded} ${balance.unit}`;
}

function attendanceJourney(signals: EmployeeJourneySignals): EmployeeJourneyItem {
  const attendance = signals.attendance;

  if (attendance?.canCheckOut) {
    return {
      actionLabel: 'Check out',
      category: 'Workforce',
      href: '/employee#attendance',
      label: 'Attendance',
      status: 'In progress',
      tone: 'success',
    };
  }

  if (attendance?.canCheckIn) {
    return {
      actionLabel: 'Check in',
      category: 'Workforce',
      href: '/employee#attendance',
      label: 'Attendance',
      status: 'Ready',
      tone: 'attention',
    };
  }

  return {
    actionLabel: 'View ledger',
    category: 'Workforce',
    href: '/employee#attendance',
    label: 'Attendance',
    status: attendance?.statusLabel ?? 'Current',
    tone: 'default',
  };
}

export function buildEmployeeJourneyItems(signals: EmployeeJourneySignals): EmployeeJourneyItem[] {
  const annualLeave = signals.leaveBalances?.find((balance) => /annual|paid|pto/i.test(balance.type)) ?? signals.leaveBalances?.[0];
  const pendingTaskCount = signals.pendingTaskCount ?? 0;

  return [
    attendanceJourney(signals),
    {
      actionLabel: 'Apply for leave',
      category: 'Workforce',
      href: '/employee/time-off',
      label: 'Leave',
      status: formatLeaveBalance(annualLeave),
      tone: annualLeave && annualLeave.balance > 0 ? 'success' : 'warning',
    },
    {
      actionLabel: 'View payslip',
      category: 'Reward',
      href: '/employee/payslip',
      label: 'Payslips',
      status: signals.hasRecentPayslip ? 'Available' : 'No current slip',
      tone: signals.hasRecentPayslip ? 'success' : 'default',
    },
    {
      actionLabel: 'Review coverage',
      category: 'Reward',
      href: '/employee/benefits',
      label: 'Benefits',
      status: 'Active',
      tone: 'success',
    },
    {
      actionLabel: 'Open tasks',
      category: 'Talent',
      href: '/employee/onboarding',
      label: 'Onboarding',
      status: pendingTaskCount > 0 ? `${pendingTaskCount} pending` : 'Clear',
      tone: pendingTaskCount > 0 ? 'warning' : 'success',
    },
    {
      actionLabel: 'Review goals',
      category: 'Talent',
      href: '/employee/performance',
      label: 'Performance',
      status: 'In cycle',
      tone: 'default',
    },
    {
      actionLabel: 'Ask HR',
      category: 'Support',
      href: '/employee/services',
      label: 'HR Services',
      status: 'Open',
      tone: 'default',
    },
    {
      actionLabel: 'View profile',
      category: 'People',
      href: '/employee/profile',
      label: 'Profile',
      status: signals.profileComplete ? 'Complete' : 'Needs review',
      tone: signals.profileComplete ? 'success' : 'warning',
    },
  ];
}
