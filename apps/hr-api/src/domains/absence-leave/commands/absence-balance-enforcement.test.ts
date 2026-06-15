import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { DEFAULT_HCM_SETUP } from '../../hcm-setup/hcm-setup.defaults.js';
import { AbsenceAccrualBalance } from '../aggregates/absence-accrual-balance.aggregate.js';
import { AbsenceRequest } from '../aggregates/absence-request.aggregate.js';
import { LeavePolicyService } from '../services/leave-policy.service.js';
import { CreateAbsenceRequestHandler } from './create-absence-request.handler.js';
import { ApproveAbsenceRequestHandler } from './approve-absence-request.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('00000000-0000-0000-0000-000000000201');
const actorId = new Uuid('00000000-0000-0000-0000-000000000202');

function command(payload: Record<string, unknown>, overrides: Partial<HrCommandEnvelope<unknown>> = {}): HrCommandEnvelope<unknown> {
  return {
    commandId: Uuid.generate(),
    commandName: 'CreateAbsenceRequest',
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId,
      roles: ['EMPLOYEE'],
      permissions: [],
      mfaAuthenticated: true,
    },
    aggregateType: 'AbsenceRequest',
    idempotencyKey: 'absence-balance-test',
    correlationId: Uuid.generate(),
    reason: 'test',
    payload,
    metadata: { requestHash: 'hash', clientType: 'EMPLOYEE_PORTAL' },
    ...overrides,
  };
}

function balance(balanceHours: number) {
  return new AbsenceAccrualBalance({
    id: Uuid.generate(),
    tenantId,
    workerId,
    leaveType: 'VACATION',
    balanceHours,
    accruedHours: balanceHours,
    usedHours: 0,
    carriedOverHours: 0,
    effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
    status: 'ACTIVE',
  });
}

function futureWorkingDate(offsetWorkingDays: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  let remaining = offsetWorkingDays;

  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if ([0, 1, 2, 3, 4].includes(date.getUTCDay())) {
      remaining -= 1;
    }
  }

  return new Date(date);
}

describe('absence balance enforcement', () => {
  it('blocks create when requested leave exceeds the active balance', async () => {
    const startDate = futureWorkingDate(3);
    const endDate = futureWorkingDate(4);
    const repo = {
      findOverlappingByWorker: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
    };
    const handler = new CreateAbsenceRequestHandler(
      repo as never,
      { findByWorker: vi.fn().mockResolvedValue([balance(8)]) } as never,
      { getAllowedActionsFromState: vi.fn().mockReturnValue([]) } as never,
      { publishFromAggregate: vi.fn() } as never,
      { getSetup: vi.fn().mockResolvedValue(DEFAULT_HCM_SETUP) } as never,
      new LeavePolicyService(),
    );

    await expect(handler.handle(command({
      workerId,
      absenceType: 'VACATION',
      startDate,
      endDate,
    }))).rejects.toThrow(/available balance/);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('returns leave policy approval and document decisions when creating a request', async () => {
    const setup = {
      ...DEFAULT_HCM_SETUP,
      leavePolicies: DEFAULT_HCM_SETUP.leavePolicies.map((policy) => (
        policy.code === 'VACATION'
          ? {
              ...policy,
              maxPerRequest: 10,
              approvalRules: [{
                code: 'LONG_LEAVE_HR_REVIEW',
                label: 'Long leave HR review',
                active: true,
                conditions: [{ field: 'durationAmount', operator: 'GTE' as const, value: 5 }],
                outcomes: [{
                  action: 'REQUIRE_APPROVAL' as const,
                  value: { workflow: 'MANAGER_THEN_HR' },
                  reason: 'Five or more days require HR review.',
                }],
              }],
              documentRules: [{
                code: 'VACATION_HANDOVER_PLAN',
                label: 'Vacation handover plan',
                active: true,
                conditions: [{ field: 'durationAmount', operator: 'GTE' as const, value: 5 }],
                outcomes: [{
                  action: 'REQUIRE_DOCUMENT' as const,
                  value: { documentCode: 'HANDOVER_PLAN' },
                  reason: 'Long leave requires a handover plan.',
                }],
              }],
            }
          : policy
      )),
    };
    const handler = new CreateAbsenceRequestHandler(
      {
        findOverlappingByWorker: vi.fn().mockResolvedValue([]),
        findByWorker: vi.fn().mockResolvedValue([]),
        save: vi.fn(),
      } as never,
      { findByWorker: vi.fn().mockResolvedValue([]) } as never,
      { getAllowedActionsFromState: vi.fn().mockReturnValue(['Approve']) } as never,
      { publishFromAggregate: vi.fn() } as never,
      { getSetup: vi.fn().mockResolvedValue(setup) } as never,
      new LeavePolicyService(),
    );

    const result = await handler.handle(command({
      workerId,
      absenceType: 'VACATION',
      startDate: new Date('2026-07-05T00:00:00.000Z'),
      endDate: new Date('2026-07-09T00:00:00.000Z'),
    }));

    expect(result.data).toMatchObject({
      approvalWorkflow: 'MANAGER_THEN_HR',
      requiredDocumentCodes: ['HANDOVER_PLAN'],
      policyDecision: {
        policyCode: 'VACATION',
        matchedRuleCodes: ['LONG_LEAVE_HR_REVIEW', 'VACATION_HANDOVER_PLAN'],
      },
    });
  });

  it('blocks approval when current balance no longer covers the pending request', async () => {
    const request = AbsenceRequest.create({
      id: Uuid.generate(),
      tenantId,
      workerId,
      absenceType: 'VACATION',
      policyCode: 'VACATION',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-06-02T00:00:00.000Z'),
      durationUnit: 'DAYS',
      durationAmount: 2,
      calendarDays: 2,
      workingDays: 2,
      paid: true,
      deductFromBalance: true,
      payrollImpact: 'PAID_LEAVE',
    }, Uuid.generate());
    request.submit(Uuid.generate());
    const repo = {
      findById: vi.fn().mockResolvedValue(request),
      save: vi.fn(),
    };
    const balanceRepo = {
      findByWorker: vi.fn().mockResolvedValue([balance(8)]),
      save: vi.fn(),
    };
    const handler = new ApproveAbsenceRequestHandler(
      repo as never,
      balanceRepo as never,
      { getAllowedActionsFromState: vi.fn().mockReturnValue([]) } as never,
      { publishFromAggregate: vi.fn() } as never,
      { getSetup: vi.fn().mockResolvedValue(DEFAULT_HCM_SETUP) } as never,
      new LeavePolicyService(),
    );

    await expect(handler.handle(command({
      absenceRequestId: request.id,
      approvedBy: actorId,
    }, {
      commandName: 'ApproveAbsenceRequest',
      aggregateId: request.id,
      expectedState: request.status,
      expectedVersion: request.aggregateVersion,
    }))).rejects.toThrow(/available balance/);
    expect(repo.save).not.toHaveBeenCalled();
    expect(balanceRepo.save).not.toHaveBeenCalled();
  });

  it('returns approved leave context required by notifications and payroll input sagas', async () => {
    const request = AbsenceRequest.create({
      id: Uuid.generate(),
      tenantId,
      workerId,
      absenceType: 'VACATION',
      policyCode: 'VACATION',
      startDate: new Date('2026-06-08T00:00:00.000Z'),
      endDate: new Date('2026-06-08T00:00:00.000Z'),
      durationUnit: 'DAYS',
      durationAmount: 1,
      calendarDays: 1,
      workingDays: 1,
      paid: true,
      deductFromBalance: true,
      payrollImpact: 'PAID_LEAVE',
    }, Uuid.generate());
    request.submit(Uuid.generate());
    const tenantSetup = {
      ...DEFAULT_HCM_SETUP,
      locations: DEFAULT_HCM_SETUP.locations.map((location, index) => ({
        ...location,
        active: index === 0,
        currency: index === 0 ? 'USD' : location.currency,
      })),
    };
    const handler = new ApproveAbsenceRequestHandler(
      { findById: vi.fn().mockResolvedValue(request), save: vi.fn() } as never,
      { findByWorker: vi.fn().mockResolvedValue([balance(8)]), save: vi.fn() } as never,
      { getAllowedActionsFromState: vi.fn().mockReturnValue([]) } as never,
      { publishFromAggregate: vi.fn() } as never,
      { getSetup: vi.fn().mockResolvedValue(tenantSetup) } as never,
      new LeavePolicyService(),
    );

    const result = await handler.handle(command({
      absenceRequestId: request.id,
      approvedBy: actorId,
    }, {
      commandName: 'ApproveAbsenceRequest',
      aggregateId: request.id,
      expectedState: request.status,
      expectedVersion: request.aggregateVersion,
    }));

    expect(result.data).toMatchObject({
      absenceRequestId: request.id.value,
      workerId: workerId.value,
      approvedBy: actorId.value,
      durationAmount: 1,
      durationUnit: 'DAYS',
      payrollImpact: 'PAID_LEAVE',
      currency: 'USD',
    });
  });
});
