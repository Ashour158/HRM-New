import { describe, expect, it } from 'vitest';
import { AbsenceRequestRepository } from './absence-request.repository.js';
import type { AbsenceRequest } from '../aggregates/absence-request.aggregate.js';

describe('AbsenceRequestRepository date-only mapping', () => {
  const repo = Object.create(AbsenceRequestRepository.prototype) as {
    toAggregate(row: Record<string, unknown>): AbsenceRequest;
  };

  it('normalizes Postgres date columns that hydrate as local-midnight Date objects', () => {
    const now = new Date('2026-06-03T09:00:00.000Z');
    const aggregate = repo.toAggregate({
      id: '00000000-0000-0000-0000-000000000801',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      worker_id: '00000000-0000-0000-0000-000000000012',
      absence_type: 'VACATION',
      policy_code: 'VACATION',
      // node-pg hydrates a Postgres `date` as local midnight of that calendar
      // day. Build that local-midnight instant so the test is TZ-independent.
      start_date: new Date(2026, 6, 20),
      end_date: new Date(2026, 6, 20),
      duration_unit: 'DAYS',
      duration_amount: 1,
      start_time: null,
      end_time: null,
      paid: true,
      deduct_from_balance: true,
      payroll_impact: 'PAID_LEAVE',
      calendar_days: 1,
      working_days: 1,
      excluded_holiday_dates: '[]',
      reason: 'Date normalization',
      status: 'PENDING_APPROVAL',
      submitted_at: now,
      approved_by: null,
      approved_at: null,
      aggregate_version: 1,
      created_at: now,
      updated_at: now,
    });

    expect(aggregate.startDate.toISOString()).toBe('2026-07-20T00:00:00.000Z');
    expect(aggregate.endDate.toISOString()).toBe('2026-07-20T00:00:00.000Z');
  });
});

describe('AbsenceRequestRepository numeric column mapping', () => {
  const repo = Object.create(AbsenceRequestRepository.prototype) as {
    toAggregate(row: Record<string, unknown>): AbsenceRequest;
  };

  const baseRow = {
    id: '00000000-0000-0000-0000-000000000801',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    worker_id: '00000000-0000-0000-0000-000000000012',
    absence_type: 'VACATION',
    policy_code: 'VACATION',
    start_date: new Date(2026, 6, 20),
    end_date: new Date(2026, 6, 20),
    duration_unit: 'DAYS',
    start_time: null,
    end_time: null,
    paid: true,
    deduct_from_balance: true,
    payroll_impact: 'PAID_LEAVE',
    calendar_days: 1,
    excluded_holiday_dates: '[]',
    reason: 'Numeric column mapping',
    status: 'PENDING_APPROVAL',
    submitted_at: new Date('2026-06-03T09:00:00.000Z'),
    approved_by: null,
    approved_at: null,
    aggregate_version: 1,
    created_at: new Date('2026-06-03T09:00:00.000Z'),
    updated_at: new Date('2026-06-03T09:00:00.000Z'),
  };

  it('parses duration_amount and working_days when Postgres returns them as NUMERIC strings', () => {
    // node-postgres returns NUMERIC columns as strings, not numbers. A raw
    // `Number()` cast happens to work here, but parseNumeric is what the
    // codebase's other absence-leave repositories standardized on, and it
    // additionally guards against a garbage/NaN value silently corrupting
    // the absence duration (see the next test).
    const aggregate = repo.toAggregate({
      ...baseRow,
      duration_amount: '1.50',
      working_days: '1.5',
    });

    expect(aggregate.durationAmount).toBe(1.5);
    expect(typeof aggregate.durationAmount).toBe('number');
    expect(aggregate.workingDays).toBe(1.5);
    expect(typeof aggregate.workingDays).toBe('number');
  });

  it('throws instead of silently turning a corrupt duration_amount into NaN', () => {
    // Previously: Number('not-a-number') is NaN, which would flow silently
    // into every downstream balance/payroll calculation for this request
    // instead of failing loudly at the read boundary.
    expect(() =>
      repo.toAggregate({
        ...baseRow,
        duration_amount: 'not-a-number',
        working_days: 1,
      }),
    ).toThrow(/Expected a numeric value/);
  });
});
