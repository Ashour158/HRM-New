import type { TenantTimezone } from '../hcm-setup/hcm-setup-currency.js';
import type { SchedulerScheduleKind } from './scheduler.types.js';

interface LocalDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function schedulerPeriodKey(now: Date, scheduleKind: SchedulerScheduleKind, timezone: TenantTimezone): string {
  const parts = tenantLocalParts(now, timezone);
  const day = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  if (scheduleKind === 'MONTHLY') return `${parts.year}-${pad(parts.month)}`;
  if (scheduleKind === 'WEEKLY') return `${parts.year}-W${pad(isoWeek(parts))}`;
  if (scheduleKind === 'ONE_OFF' || scheduleKind === 'MANUAL') {
    return `${day}T${pad(parts.hour)}:${pad(parts.minute)}`;
  }
  return day;
}

export function nextRunAfter(now: Date, scheduleKind: SchedulerScheduleKind): Date | undefined {
  const next = new Date(now.getTime());
  if (scheduleKind === 'ONE_OFF' || scheduleKind === 'MANUAL') return undefined;
  if (scheduleKind === 'DAILY') next.setUTCDate(next.getUTCDate() + 1);
  if (scheduleKind === 'WEEKLY') next.setUTCDate(next.getUTCDate() + 7);
  if (scheduleKind === 'MONTHLY') next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function tenantLocalParts(date: Date, timezone: TenantTimezone): LocalDateParts {
  if (timezone.timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    return {
      year: value('year'),
      month: value('month'),
      day: value('day'),
      hour: value('hour'),
      minute: value('minute'),
    };
  }

  const offsetDate = new Date(date.getTime() + (timezone.offsetMinutes ?? 0) * 60_000);
  return {
    year: offsetDate.getUTCFullYear(),
    month: offsetDate.getUTCMonth() + 1,
    day: offsetDate.getUTCDate(),
    hour: offsetDate.getUTCHours(),
    minute: offsetDate.getUTCMinutes(),
  };
}

function isoWeek(parts: LocalDateParts): number {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}
