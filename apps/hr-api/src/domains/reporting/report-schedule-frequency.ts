import { ValidationError } from '@hcm/shared-kernel';

export type ReportScheduleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export function isReportScheduleFrequency(value: string): value is ReportScheduleFrequency {
  return value === 'DAILY' || value === 'WEEKLY' || value === 'MONTHLY';
}

/**
 * Computes the next run time from the schedule's own previous `nextRunAt` (not
 * from "now"), so a late-firing job doesn't push every subsequent run later.
 */
export function nextReportRunAfter(from: Date, frequency: string): Date {
  if (!isReportScheduleFrequency(frequency)) {
    throw new ValidationError(`Unsupported report schedule frequency: ${frequency}`);
  }
  const next = new Date(from.getTime());
  if (frequency === 'DAILY') next.setUTCDate(next.getUTCDate() + 1);
  if (frequency === 'WEEKLY') next.setUTCDate(next.getUTCDate() + 7);
  if (frequency === 'MONTHLY') {
    // setUTCMonth overflows into the following month when the target month is
    // shorter than the current day-of-month (e.g. Jan 31 -> Mar 3, skipping
    // Feb entirely). Clamp back to the target month's last day instead.
    const day = next.getUTCDate();
    next.setUTCMonth(next.getUTCMonth() + 1);
    if (next.getUTCDate() !== day) {
      next.setUTCDate(0);
    }
  }
  return next;
}
