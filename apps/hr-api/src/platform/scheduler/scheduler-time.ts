import type { TenantTimezone } from '../../domains/hcm-setup/hcm-setup-currency.js';

interface LocalTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
}

export function schedulerPeriodKey(now: Date, timezone: TenantTimezone | string): string {
  const label = typeof timezone === 'string' ? timezone : timezone.label;
  const parts = localTimeParts(now, timezone);
  return [
    parts.year.toString().padStart(4, '0'),
    parts.month.toString().padStart(2, '0'),
    parts.day.toString().padStart(2, '0'),
    'T',
    parts.hour.toString().padStart(2, '0'),
    ':',
    parts.minute.toString().padStart(2, '0'),
    '@',
    label,
  ].join('');
}

export function isCronDue(cron: string, now: Date, timezone: TenantTimezone | string): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Scheduler cron "${cron}" must have five fields`);
  }
  const local = localTimeParts(now, timezone);
  return (
    cronPartMatches(parts[0] ?? '*', local.minute, 0, 59) &&
    cronPartMatches(parts[1] ?? '*', local.hour, 0, 23) &&
    cronPartMatches(parts[2] ?? '*', local.day, 1, 31) &&
    cronPartMatches(parts[3] ?? '*', local.month, 1, 12) &&
    cronPartMatches(parts[4] ?? '*', local.dayOfWeek, 0, 6)
  );
}

function cronPartMatches(part: string, value: number, min: number, max: number): boolean {
  if (part === '*') return true;
  return part.split(',').some((token) => cronTokenMatches(token.trim(), value, min, max));
}

function cronTokenMatches(token: string, value: number, min: number, max: number): boolean {
  if (!token) return false;
  const stepMatch = token.match(/^(\*|\d+)-?(\d+)?\/(\d+)$/);
  if (stepMatch) {
    const start = stepMatch[1] === '*' ? min : Number(stepMatch[1]);
    const end = stepMatch[2] === undefined ? max : Number(stepMatch[2]);
    const step = Number(stepMatch[3]);
    if (!Number.isInteger(start) || !Number.isInteger(end) || !Number.isInteger(step) || step <= 0) return false;
    return value >= start && value <= end && (value - start) % step === 0;
  }
  const rangeMatch = token.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    return value >= start && value <= end;
  }
  const number = Number(token);
  return Number.isInteger(number) && number >= min && number <= max && value === number;
}

function localTimeParts(now: Date, timezone: TenantTimezone | string): LocalTimeParts {
  if (typeof timezone !== 'string' && timezone.offsetMinutes !== undefined && !timezone.timeZone) {
    return offsetTimeParts(now, timezone.offsetMinutes);
  }
  const timeZone = typeof timezone === 'string' ? timezone : timezone.timeZone;
  if (!timeZone) return offsetTimeParts(now, 0);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const values = new Map(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  return {
    year: Number(values.get('year')),
    month: Number(values.get('month')),
    day: Number(values.get('day')),
    hour: Number(values.get('hour')),
    minute: Number(values.get('minute')),
    dayOfWeek: weekdayIndex(values.get('weekday') ?? 'Sun'),
  };
}

function offsetTimeParts(now: Date, offsetMinutes: number): LocalTimeParts {
  const adjusted = new Date(now.getTime() + offsetMinutes * 60_000);
  return {
    year: adjusted.getUTCFullYear(),
    month: adjusted.getUTCMonth() + 1,
    day: adjusted.getUTCDate(),
    hour: adjusted.getUTCHours(),
    minute: adjusted.getUTCMinutes(),
    dayOfWeek: adjusted.getUTCDay(),
  };
}

function weekdayIndex(weekday: string): number {
  const normalized = weekday.slice(0, 3).toLowerCase();
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(normalized);
}
