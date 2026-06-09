export type ManagerJourneyTone = 'attention' | 'default' | 'success' | 'warning';

export interface ManagerJourneyItem {
  label: string;
  category: string;
  status: string;
  actionLabel: string;
  href: string;
  tone: ManagerJourneyTone;
}

export interface ManagerJourneySignals {
  averagePerformance?: number;
  directReportCount?: number;
  openGoals?: number;
  pendingExpenses?: number;
  pendingLeaveApprovals?: number;
  pendingTimesheets?: number;
  teamAttendanceExceptions?: number;
}

function positive(value?: number): number {
  return Math.max(value ?? 0, 0);
}

export function buildManagerJourneyItems(signals: ManagerJourneySignals): ManagerJourneyItem[] {
  const pendingLeaveApprovals = positive(signals.pendingLeaveApprovals);
  const pendingTimesheets = positive(signals.pendingTimesheets);
  const pendingExpenses = positive(signals.pendingExpenses);
  const pendingTotal = pendingLeaveApprovals + pendingTimesheets + pendingExpenses;
  const teamAttendanceExceptions = positive(signals.teamAttendanceExceptions);
  const openGoals = positive(signals.openGoals);
  const directReportCount = positive(signals.directReportCount);
  const averagePerformance = signals.averagePerformance ?? 0;

  return [
    {
      label: 'Approvals',
      category: 'Today',
      status: pendingTotal > 0 ? `${pendingTotal} waiting` : 'Clear',
      actionLabel: pendingTotal > 0 ? 'Review decisions' : 'Open approvals',
      href: '/manager/approvals',
      tone: pendingTotal > 0 ? 'attention' : 'success',
    },
    {
      label: 'Team Attendance',
      category: 'Coverage',
      status: teamAttendanceExceptions > 0 ? `${teamAttendanceExceptions} exceptions` : 'On track',
      actionLabel: teamAttendanceExceptions > 0 ? 'Check coverage' : 'View attendance',
      href: '/manager/team',
      tone: teamAttendanceExceptions > 0 ? 'warning' : 'default',
    },
    {
      label: 'Performance Coaching',
      category: 'Talent',
      status: averagePerformance > 0 ? `${averagePerformance}% average` : 'Needs data',
      actionLabel: openGoals > 0 ? 'Review goals' : 'Open team view',
      href: '/manager/team',
      tone: averagePerformance > 0 && averagePerformance < 75 ? 'warning' : 'default',
    },
    {
      label: 'Team Roster',
      category: 'People',
      status: directReportCount > 0 ? `${directReportCount} reports` : 'No reports',
      actionLabel: directReportCount > 0 ? 'Open team' : 'Check assignments',
      href: '/manager/team',
      tone: directReportCount > 0 ? 'success' : 'warning',
    },
  ];
}
