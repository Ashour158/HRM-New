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
  if (frequency === 'MONTHLY') next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}
