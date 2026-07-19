import { describe, expect, it } from 'vitest';
import { computeUpcomingTeamEvents, type TeamActivityWorker } from './team-activity';

function worker(overrides: Partial<TeamActivityWorker> & { id: string }): TeamActivityWorker {
  return {
    firstName: 'First',
    lastName: 'Last',
    hireDate: undefined,
    ...overrides,
  };
}

describe('computeUpcomingTeamEvents', () => {
  it('returns empty results for an empty roster', () => {
    const result = computeUpcomingTeamEvents([], new Date('2026-07-12T12:00:00.000Z'));
    expect(result.upcomingAnniversaries).toEqual([]);
    expect(result.recentJoins).toEqual([]);
  });

  it('ignores workers with no hire date', () => {
    const roster = [worker({ id: 'w1', hireDate: undefined })];
    const result = computeUpcomingTeamEvents(roster, new Date('2026-07-12T00:00:00.000Z'));
    expect(result.upcomingAnniversaries).toEqual([]);
    expect(result.recentJoins).toEqual([]);
  });

  it('ignores workers with an unparseable hire date', () => {
    const roster = [worker({ id: 'w1', hireDate: 'not-a-date' })];
    const result = computeUpcomingTeamEvents(roster, new Date('2026-07-12T00:00:00.000Z'));
    expect(result.upcomingAnniversaries).toEqual([]);
    expect(result.recentJoins).toEqual([]);
  });

  describe('upcoming anniversaries', () => {
    it('includes a worker whose anniversary falls within the next 30 days, with years of tenure reached', () => {
      const today = new Date('2026-07-12T00:00:00.000Z');
      const roster = [
        worker({ id: 'w1', firstName: 'Mona', lastName: 'Saleh', hireDate: '2022-07-20T00:00:00.000Z' }),
      ];
      const result = computeUpcomingTeamEvents(roster, today);
      expect(result.upcomingAnniversaries).toHaveLength(1);
      expect(result.upcomingAnniversaries[0]).toMatchObject({
        workerId: 'w1',
        name: 'Mona Saleh',
        daysUntil: 8,
        yearsOfTenure: 4,
      });
    });

    it('excludes anniversaries further than 30 days out', () => {
      const today = new Date('2026-07-12T00:00:00.000Z');
      const roster = [worker({ id: 'w1', hireDate: '2020-12-01T00:00:00.000Z' })];
      const result = computeUpcomingTeamEvents(roster, today);
      expect(result.upcomingAnniversaries).toEqual([]);
    });

    it('treats an anniversary that is exactly today as 0 days until, at 1+ years tenure', () => {
      const today = new Date('2026-07-12T00:00:00.000Z');
      const roster = [worker({ id: 'w1', hireDate: '2023-07-12T00:00:00.000Z' })];
      const result = computeUpcomingTeamEvents(roster, today);
      expect(result.upcomingAnniversaries).toHaveLength(1);
      expect(result.upcomingAnniversaries[0]).toMatchObject({ daysUntil: 0, yearsOfTenure: 3 });
    });

    it('includes an anniversary exactly 30 days out (inclusive boundary)', () => {
      const today = new Date('2026-07-12T00:00:00.000Z');
      const roster = [worker({ id: 'w1', hireDate: '2021-08-11T00:00:00.000Z' })];
      const result = computeUpcomingTeamEvents(roster, today);
      expect(result.upcomingAnniversaries).toHaveLength(1);
      expect(result.upcomingAnniversaries[0]).toMatchObject({ daysUntil: 30, yearsOfTenure: 5 });
    });

    it('excludes an anniversary at 31 days out (just past the boundary)', () => {
      const today = new Date('2026-07-12T00:00:00.000Z');
      const roster = [worker({ id: 'w1', hireDate: '2021-08-12T00:00:00.000Z' })];
      const result = computeUpcomingTeamEvents(roster, today);
      expect(result.upcomingAnniversaries).toEqual([]);
    });

    it('does not report an anniversary with 0 years of tenure (hired today)', () => {
      // Hired today — belongs in "recent joins" only; 0 completed years isn't an anniversary.
      const today = new Date('2026-07-12T00:00:00.000Z');
      const roster = [worker({ id: 'w1', hireDate: '2026-07-12T00:00:00.000Z' })];
      const result = computeUpcomingTeamEvents(roster, today);
      expect(result.upcomingAnniversaries).toEqual([]);
      expect(result.recentJoins).toHaveLength(1);
      expect(result.recentJoins[0].daysSinceHire).toBe(0);
    });

    it('wraps a Dec-anniversary "today" around into January of next year', () => {
      const today = new Date('2026-12-20T00:00:00.000Z');
      const roster = [worker({ id: 'w1', firstName: 'Jan', lastName: 'Wrap', hireDate: '2020-01-05T00:00:00.000Z' })];
      const result = computeUpcomingTeamEvents(roster, today);
      expect(result.upcomingAnniversaries).toHaveLength(1);
      expect(result.upcomingAnniversaries[0]).toMatchObject({ daysUntil: 16, yearsOfTenure: 7 });
      expect(result.upcomingAnniversaries[0].anniversaryDate.getUTCFullYear()).toBe(2027);
    });

    it('resolves a Feb 29 leap-year hire date to Feb 28 in a non-leap anniversary year', () => {
      // 2024 is a leap year (Feb 29 exists); 2026 is not.
      const today = new Date('2026-02-20T00:00:00.000Z');
      const roster = [worker({ id: 'w1', hireDate: '2024-02-29T00:00:00.000Z' })];
      const result = computeUpcomingTeamEvents(roster, today);
      expect(result.upcomingAnniversaries).toHaveLength(1);
      const anniversary = result.upcomingAnniversaries[0];
      expect(anniversary.yearsOfTenure).toBe(2);
      expect(anniversary.anniversaryDate.getUTCMonth()).toBe(1); // February
      expect(anniversary.anniversaryDate.getUTCDate()).toBe(28);
      expect(anniversary.daysUntil).toBe(8);
    });

    it('lands a Feb 29 hire date on Feb 29 itself when the target year is also a leap year', () => {
      const today = new Date('2028-02-20T00:00:00.000Z'); // 2028 is a leap year
      const roster = [worker({ id: 'w1', hireDate: '2024-02-29T00:00:00.000Z' })];
      const result = computeUpcomingTeamEvents(roster, today);
      expect(result.upcomingAnniversaries).toHaveLength(1);
      const anniversary = result.upcomingAnniversaries[0];
      expect(anniversary.anniversaryDate.getUTCMonth()).toBe(1);
      expect(anniversary.anniversaryDate.getUTCDate()).toBe(29);
    });

    it('sorts multiple anniversaries soonest-first', () => {
      const today = new Date('2026-07-12T00:00:00.000Z');
      const roster = [
        worker({ id: 'w-far', firstName: 'Far', lastName: 'Off', hireDate: '2021-08-05T00:00:00.000Z' }), // 24 days out
        worker({ id: 'w-near', firstName: 'Near', lastName: 'Soon', hireDate: '2019-07-15T00:00:00.000Z' }), // 3 days out
        worker({ id: 'w-mid', firstName: 'Mid', lastName: 'Range', hireDate: '2020-07-25T00:00:00.000Z' }), // 13 days out
      ];
      const result = computeUpcomingTeamEvents(roster, today);
      expect(result.upcomingAnniversaries.map((a) => a.workerId)).toEqual(['w-near', 'w-mid', 'w-far']);
    });
  });

  describe('recent joins', () => {
    it('includes a worker hired within the last 30 days', () => {
      const today = new Date('2026-07-12T00:00:00.000Z');
      const roster = [worker({ id: 'w1', firstName: 'New', lastName: 'Hire', hireDate: '2026-07-01T00:00:00.000Z' })];
      const result = computeUpcomingTeamEvents(roster, today);
      expect(result.recentJoins).toHaveLength(1);
      expect(result.recentJoins[0]).toMatchObject({ workerId: 'w1', name: 'New Hire', daysSinceHire: 11 });
    });

    it('includes a hire from exactly 30 days ago (inclusive boundary)', () => {
      const today = new Date('2026-07-12T00:00:00.000Z');
      const roster = [worker({ id: 'w1', hireDate: '2026-06-12T00:00:00.000Z' })];
      const result = computeUpcomingTeamEvents(roster, today);
      expect(result.recentJoins).toHaveLength(1);
      expect(result.recentJoins[0].daysSinceHire).toBe(30);
    });

    it('excludes a hire from 31 days ago', () => {
      const today = new Date('2026-07-12T00:00:00.000Z');
      const roster = [worker({ id: 'w1', hireDate: '2026-06-11T00:00:00.000Z' })];
      const result = computeUpcomingTeamEvents(roster, today);
      expect(result.recentJoins).toEqual([]);
    });

    it('includes a worker hired today (0 days since hire)', () => {
      const today = new Date('2026-07-12T00:00:00.000Z');
      const roster = [worker({ id: 'w1', hireDate: '2026-07-12T00:00:00.000Z' })];
      const result = computeUpcomingTeamEvents(roster, today);
      expect(result.recentJoins).toHaveLength(1);
      expect(result.recentJoins[0].daysSinceHire).toBe(0);
    });

    it('excludes hires older than 30 days', () => {
      const today = new Date('2026-07-12T00:00:00.000Z');
      const roster = [worker({ id: 'w1', hireDate: '2024-01-15T00:00:00.000Z' })];
      const result = computeUpcomingTeamEvents(roster, today);
      expect(result.recentJoins).toEqual([]);
    });

    it('sorts multiple recent joins most-recent-first', () => {
      const today = new Date('2026-07-12T00:00:00.000Z');
      const roster = [
        worker({ id: 'w-old', firstName: 'Old', lastName: 'Est', hireDate: '2026-06-15T00:00:00.000Z' }), // 27 days ago
        worker({ id: 'w-new', firstName: 'New', lastName: 'Est', hireDate: '2026-07-10T00:00:00.000Z' }), // 2 days ago
        worker({ id: 'w-mid', firstName: 'Mid', lastName: 'Dle', hireDate: '2026-07-01T00:00:00.000Z' }), // 11 days ago
      ];
      const result = computeUpcomingTeamEvents(roster, today);
      expect(result.recentJoins.map((r) => r.workerId)).toEqual(['w-new', 'w-mid', 'w-old']);
    });

    it('does not treat a future hire date as a recent join', () => {
      const today = new Date('2026-07-12T00:00:00.000Z');
      const roster = [worker({ id: 'w1', hireDate: '2026-08-01T00:00:00.000Z' })];
      const result = computeUpcomingTeamEvents(roster, today);
      expect(result.recentJoins).toEqual([]);
    });
  });

  it('defaults `today` to the current date when not provided', () => {
    const roster: TeamActivityWorker[] = [];
    expect(() => computeUpcomingTeamEvents(roster)).not.toThrow();
  });
});
