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
      start_date: new Date('2026-07-19T21:00:00.000Z'),
      end_date: new Date('2026-07-19T21:00:00.000Z'),
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
