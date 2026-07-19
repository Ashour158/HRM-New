/**
 * Pure date-math helpers for the manager "Team Activity" widget.
 *
 * Computes upcoming work anniversaries and recent joins from an already-fetched
 * direct-reports roster (GET /manager/team) — no additional API calls. Kept
 * dependency-free and side-effect-free so it can be unit tested directly.
 *
 * NOTE: birthdays are intentionally NOT computed here. The `Worker` roster type
 * surfaced to the manager team page (apps/hr-web/src/types/index.ts) does not
 * expose a date-of-birth field — only `EmployeeProfileData.basic.dateOfBirth`
 * has one, and that type isn't part of the `/manager/team` response this page
 * consumes. Fabricating a DOB field name would be guessing, so no birthdays
 * widget is built until a real field is exposed to this view.
 */

/** Minimal shape this module needs from a roster entry. */
export interface TeamActivityWorker {
  id: string;
  firstName: string;
  lastName: string;
  hireDate?: string;
}

export interface UpcomingAnniversary {
  workerId: string;
  name: string;
  hireDate: string;
  /** The next occurrence of the hire-date month/day (this year or next). */
  anniversaryDate: Date;
  /** Whole days from `today` until `anniversaryDate` (0 = today). */
  daysUntil: number;
  /** Years of tenure reached on `anniversaryDate`. Always >= 1. */
  yearsOfTenure: number;
}

export interface RecentJoin {
  workerId: string;
  name: string;
  hireDate: string;
  /** Whole days from `hireDate` until `today` (0 = hired today). */
  daysSinceHire: number;
}

export interface TeamActivityResult {
  upcomingAnniversaries: UpcomingAnniversary[];
  recentJoins: RecentJoin[];
}

const LOOKAHEAD_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, monthIndex: number): number {
  return isLeapYear(year) && monthIndex === 1 ? 29 : [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][monthIndex];
}

/**
 * Builds a UTC-midnight date for (year, monthIndex, day), clamping the day to
 * the last valid day of that month/year. This makes a Feb 29 hire date
 * resolve to Feb 28 in non-leap years instead of silently rolling into March.
 */
function clampedUTCDate(year: number, monthIndex: number, day: number): Date {
  const clampedDay = Math.min(day, daysInMonth(year, monthIndex));
  return new Date(Date.UTC(year, monthIndex, clampedDay));
}

/**
 * Normalizes a Date or ISO date string down to a UTC-midnight calendar date,
 * discarding time-of-day. Returns null for missing/unparseable input.
 */
function toUTCDateOnly(input: Date | string | undefined): Date | null {
  if (!input) return null;
  const parsed = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

/** Whole-day difference (b - a), assuming both are UTC-midnight dates. */
function diffInDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/**
 * The next occurrence of (monthIndex, day) on or after `today`, wrapping into
 * next year if this year's occurrence has already passed.
 */
function nextOccurrence(monthIndex: number, day: number, today: Date): Date {
  const year = today.getUTCFullYear();
  const candidate = clampedUTCDate(year, monthIndex, day);
  if (candidate.getTime() < today.getTime()) {
    return clampedUTCDate(year + 1, monthIndex, day);
  }
  return candidate;
}

function workerName(worker: TeamActivityWorker): string {
  return `${worker.firstName} ${worker.lastName}`.trim();
}

/**
 * Computes upcoming work anniversaries (next 30 days, soonest first) and
 * recent joins (hired in the last 30 days) from a direct-reports roster.
 * Pure function — no fetching, no dates other than what's passed in.
 */
export function computeUpcomingTeamEvents(
  roster: TeamActivityWorker[],
  today: Date = new Date(),
): TeamActivityResult {
  const todayUTC = toUTCDateOnly(today);
  if (!todayUTC) {
    return { upcomingAnniversaries: [], recentJoins: [] };
  }

  const upcomingAnniversaries: UpcomingAnniversary[] = [];
  const recentJoins: RecentJoin[] = [];

  for (const worker of roster) {
    const hireUTC = toUTCDateOnly(worker.hireDate);
    if (!hireUTC || !worker.hireDate) continue;

    // Recent joins: hired within the last 30 days (inclusive), never in the future.
    const daysSinceHire = diffInDays(hireUTC, todayUTC);
    if (daysSinceHire >= 0 && daysSinceHire <= LOOKAHEAD_DAYS) {
      recentJoins.push({
        workerId: worker.id,
        name: workerName(worker),
        hireDate: worker.hireDate,
        daysSinceHire,
      });
    }

    // Upcoming anniversaries: next occurrence of hire month/day within 30 days,
    // only once at least one full year of tenure has been completed.
    const anniversaryDate = nextOccurrence(hireUTC.getUTCMonth(), hireUTC.getUTCDate(), todayUTC);
    const yearsOfTenure = anniversaryDate.getUTCFullYear() - hireUTC.getUTCFullYear();
    const daysUntil = diffInDays(todayUTC, anniversaryDate);
    if (yearsOfTenure >= 1 && daysUntil >= 0 && daysUntil <= LOOKAHEAD_DAYS) {
      upcomingAnniversaries.push({
        workerId: worker.id,
        name: workerName(worker),
        hireDate: worker.hireDate,
        anniversaryDate,
        daysUntil,
        yearsOfTenure,
      });
    }
  }

  upcomingAnniversaries.sort((a, b) => a.daysUntil - b.daysUntil);
  recentJoins.sort((a, b) => a.daysSinceHire - b.daysSinceHire);

  return { upcomingAnniversaries, recentJoins };
}
