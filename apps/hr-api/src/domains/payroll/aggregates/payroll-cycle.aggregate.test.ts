import { describe, expect, it } from 'vitest';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { PayrollCycle } from './payroll-cycle.aggregate.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const cycleId = new Uuid('00000000-0000-0000-0000-000000000002');
const correlationId = new Uuid('00000000-0000-0000-0000-000000000003');
const preparerId = new Uuid('00000000-0000-0000-0000-000000000004');
const approverId = new Uuid('00000000-0000-0000-0000-000000000005');

function cycleInReview(createdBy?: Uuid) {
  return new PayrollCycle({
    id: cycleId,
    tenantId,
    cycleName: 'May 2026 Payroll',
    payPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
    payPeriodEnd: new Date('2026-05-31T00:00:00.000Z'),
    status: 'REVIEW',
    createdBy,
    aggregateVersion: 5,
  });
}

describe('PayrollCycle preparer/approver segregation of duties (HCM-P0-5b)', () => {
  it('blocks the preparer who created the cycle from also approving it', () => {
    const cycle = cycleInReview(preparerId);

    expect(() => cycle.approve(preparerId, correlationId)).toThrow(ValidationError);
    expect(() => cycle.approve(preparerId, correlationId)).toThrow(/Segregation of duties/);
    expect(cycle.status).toBe('REVIEW');
  });

  it('allows a different actor to approve the cycle', () => {
    const cycle = cycleInReview(preparerId);

    cycle.approve(approverId, correlationId);

    expect(cycle.status).toBe('APPROVED');
    expect(cycle.approvedBy).toBe(approverId);
  });

  it('allows approval when no preparer was recorded (backward compatibility with pre-existing cycles)', () => {
    const cycle = cycleInReview(undefined);

    cycle.approve(preparerId, correlationId);

    expect(cycle.status).toBe('APPROVED');
  });
});
