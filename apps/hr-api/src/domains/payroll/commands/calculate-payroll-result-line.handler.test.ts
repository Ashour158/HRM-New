import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { DEFAULT_HCM_SETUP } from '../../hcm-setup/hcm-setup.defaults.js';
import { CalculatePayrollResultLineHandler } from './calculate-payroll-result-line.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('00000000-0000-0000-0000-000000000201');
const payrollCycleId = new Uuid('00000000-0000-0000-0000-000000000301');
const calculationRunId = new Uuid('00000000-0000-0000-0000-000000000302');

function command(payload: Record<string, unknown>): HrCommandEnvelope<unknown> {
  return {
    commandId: Uuid.generate(),
    commandName: 'CalculatePayrollResultLine',
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId: new Uuid('00000000-0000-0000-0000-000000000202'),
      roles: ['PAYROLL_ADMIN'],
      permissions: ['PAYROLL_ADMIN'],
      mfaAuthenticated: true,
    },
    aggregateType: 'PayrollResultLine',
    idempotencyKey: 'calculate-payroll-result-line-test',
    correlationId: Uuid.generate(),
    reason: 'test',
    payload,
    metadata: { requestHash: 'hash', clientType: 'ADMIN_PORTAL' },
  };
}

function handler(save = vi.fn()) {
  return new CalculatePayrollResultLineHandler(
    { save } as never,
    { getAllowedActionsFromState: vi.fn().mockReturnValue([]) } as never,
    { publishFromAggregate: vi.fn() } as never,
    { getSetup: vi.fn().mockResolvedValue(DEFAULT_HCM_SETUP) } as never,
  );
}

describe('CalculatePayrollResultLineHandler policy enforcement', () => {
  it('rejects arbitrary payroll lines without calculator snapshot evidence', async () => {
    await expect(handler().handle(command({
      workerId,
      payrollCycleId,
      calculationRunId,
      lineType: 'GROSS',
      description: 'Manual arbitrary amount',
      amount: 100000,
      currency: 'EGP',
    }))).rejects.toThrow(/input snapshot/);
  });

  it('accepts calculator-backed payroll lines and returns applied policy evidence', async () => {
    const result = await handler().handle(command({
      workerId,
      payrollCycleId,
      calculationRunId,
      lineType: 'NET',
      description: 'Policy calculated net salary',
      amount: 7600,
      currency: 'EGP',
      ruleSetId: 'EG_2026',
      calculationStep: 'NET_AFTER_POLICY_DEDUCTIONS',
      inputSnapshotHash: 'a'.repeat(64),
    }));

    expect(result.data).toMatchObject({
      status: 'CALCULATED',
      policyEvidence: {
        engine: 'PayrollPolicyCalculationGate',
        inputSnapshotHash: 'a'.repeat(64),
      },
    });
  });
});
