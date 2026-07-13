import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { CommandOutcome, HrCommandEnvelope } from '@hcm/command-contracts';
import type { ApprovalWorkflowRule, HcmSetupConfig } from '../../domains/hcm-setup/hcm-setup.types.js';
import { ApprovalChain } from './approval-chain.aggregate.js';
import type { ApprovalChainRepositoryPort } from './approval-chain.repository.js';
import { ApprovalWorkflowService } from './approval-workflow.service.js';

function baseSetup(approvalWorkflowRules: ApprovalWorkflowRule[]): HcmSetupConfig {
  return {
    genderOptions: [],
    workPhoneEnabled: false,
    locations: [],
    cities: [],
    departments: [],
    jobTitles: [],
    employeeIdPolicy: { mode: 'MANUAL_ONLY' },
    socialMediaFields: [],
    documentRequirements: [],
    fieldRules: [],
    leavePolicies: [],
    payrollCalculationPolicy: { taxRatePercent: 0, employeeInsuranceRatePercent: 0 },
    statutoryPayrollPacks: [],
    salaryCompositionPlans: [],
    attendancePolicy: { graceMinutes: 0, requireGeo: false },
    earningPolicies: [],
    deductionPolicies: [],
    payrollBlockingRules: [],
    approvalWorkflowRules,
  };
}

function buildCommand(payload: Record<string, unknown>): HrCommandEnvelope<Record<string, unknown>> {
  return {
    commandId: Uuid.generate(),
    commandName: 'ApproveCompensationChange',
    commandSchemaVersion: 1,
    tenantId: Uuid.generate(),
    actor: {
      actorId: Uuid.generate(),
      actorType: 'USER',
      roles: ['HR_ADMIN'],
      permissions: ['COMPENSATION_APPROVE'],
      mfaAuthenticated: true,
    },
    aggregateType: 'CompensationChange',
    aggregateId: Uuid.generate(),
    idempotencyKey: `compensation-change-${Uuid.generate().value}`,
    correlationId: Uuid.generate(),
    reason: 'Route conditioned approval workflow',
    payload,
    metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
  };
}

function conditionedRule(overrides: Partial<ApprovalWorkflowRule> = {}): ApprovalWorkflowRule {
  return {
    code: 'COMP_CHANGE_APPROVAL',
    label: 'Compensation change approval',
    active: true,
    commandName: 'ApproveCompensationChange',
    aggregateType: 'CompensationChange',
    steps: [
      { code: 'HR_REVIEW', label: 'HR review', active: true, order: 1, mode: 'SEQUENTIAL', approverType: 'ROLE', approverRole: 'HR_ADMIN', slaHours: 24 },
    ],
    ...overrides,
  };
}

class InMemoryApprovalChainRepository implements ApprovalChainRepositoryPort {
  readonly chains = new Map<string, ApprovalChain>();

  async save(chain: ApprovalChain): Promise<void> {
    this.chains.set(chain.id.value, chain);
  }

  async findById(id: Uuid): Promise<ApprovalChain | undefined> {
    return this.chains.get(id.value);
  }

  async findPendingForActor(): Promise<ApprovalChain[]> {
    return Array.from(this.chains.values()).filter((chain) => chain.status === 'IN_PROGRESS');
  }

  async recordDelegation(): Promise<void> {
    return undefined;
  }
}

describe('ApprovalWorkflowService', () => {
  it('gates a configured command and only replays it after final approval', async () => {
    const tenantId = Uuid.generate();
    const actorId = Uuid.generate();
    const aggregateId = Uuid.generate();
    const repository = new InMemoryApprovalChainRepository();
    const service = new ApprovalWorkflowService(repository);
    const committed: CommandOutcome<{ committed: true }> = {
      success: true,
      data: { committed: true },
      commandId: Uuid.generate(),
      correlationId: Uuid.generate(),
      aggregateId,
      newState: 'APPROVED',
      newVersion: 2,
      allowedNextActions: [],
      fieldAccessDecisions: {},
      eventsEmitted: ['DisciplinaryActionApproved'],
      auditRecordId: Uuid.generate(),
    };
    const executor = vi.fn(async () => committed);
    service.bindCommandExecutor(executor);

    const command: HrCommandEnvelope<{ disciplinaryActionId: Uuid; approvedBy: Uuid }> = {
      commandId: Uuid.generate(),
      commandName: 'ApproveDisciplinaryAction',
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorId,
        actorType: 'USER',
        roles: ['HR_ADMIN'],
        permissions: ['EMPLOYEE_RELATIONS_APPROVE'],
        mfaAuthenticated: true,
      },
      aggregateType: 'DisciplinaryAction',
      aggregateId,
      expectedState: 'DRAFT',
      expectedVersion: 1,
      idempotencyKey: 'disciplinary-approve',
      correlationId: Uuid.generate(),
      reason: 'Route approval workflow',
      payload: { disciplinaryActionId: aggregateId, approvedBy: actorId },
      metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
    };

    const pending = await service.gateCommand(command, {
      genderOptions: [],
      workPhoneEnabled: false,
      locations: [],
      cities: [],
      departments: [],
      jobTitles: [],
      employeeIdPolicy: { mode: 'MANUAL_ONLY' },
      socialMediaFields: [],
      documentRequirements: [],
      fieldRules: [],
      leavePolicies: [],
      payrollCalculationPolicy: { taxRatePercent: 0, employeeInsuranceRatePercent: 0 },
      statutoryPayrollPacks: [],
      salaryCompositionPlans: [],
      attendancePolicy: { graceMinutes: 0, requireGeo: false },
      earningPolicies: [],
      deductionPolicies: [],
      payrollBlockingRules: [],
      approvalWorkflowRules: [{
        code: 'DISCIPLINARY_APPROVAL',
        label: 'Disciplinary approval',
        active: true,
        commandName: 'ApproveDisciplinaryAction',
        aggregateType: 'DisciplinaryAction',
        steps: [
          { code: 'HR_REVIEW', label: 'HR review', active: true, order: 1, mode: 'SEQUENTIAL', approverType: 'ROLE', approverRole: 'HR_ADMIN', slaHours: 0, escalationTiers: [{ code: 'ESCALATE_HR', label: 'Escalate to HR', afterHours: 0, approverRole: 'HR_ADMIN' }] },
          { code: 'FINAL_REVIEW', label: 'Final review', active: true, order: 2, mode: 'SEQUENTIAL', approverType: 'ROLE', approverRole: 'HR_ADMIN', slaHours: 24 },
        ],
      }],
    });

    expect(pending?.success).toBe(true);
    expect(pending?.newState).toBe('PENDING_APPROVAL');
    expect(executor).not.toHaveBeenCalled();

    const chainId = (pending?.data as { approvalChainId: string }).approvalChainId;
    const chain = await repository.findById(new Uuid(chainId));
    expect(chain).toBeDefined();
    const [firstStep, secondStep] = chain!.steps;

    await service.delegateStep(new Uuid(chainId), firstStep.id, actorId, Uuid.generate(), 'Delegate for context');
    await service.escalateOverdue(new Uuid(chainId), new Date(Date.now() + 60_000), actorId);
    await service.approveStep(new Uuid(chainId), firstStep.id, actorId, 'First approval');
    expect(executor).not.toHaveBeenCalled();

    const final = await service.approveStep(new Uuid(chainId), secondStep.id, actorId, 'Final approval');
    expect(executor).toHaveBeenCalledTimes(1);
    expect(final.data).toMatchObject({ status: 'APPROVED', committedCommandResult: { success: true } });
    const replayed = executor.mock.calls[0][0] as HrCommandEnvelope<unknown>;
    expect(replayed.metadata).toMatchObject({ approvalResume: true, approvalChainId: chainId });
    expect((replayed.payload as { disciplinaryActionId: Uuid }).disciplinaryActionId).toBeInstanceOf(Uuid);
  });
});

describe('ApprovalWorkflowService field-level condition routing', () => {
  it('does not intercept an unconditioned rule differently than before (regression)', async () => {
    const repository = new InMemoryApprovalChainRepository();
    const service = new ApprovalWorkflowService(repository);
    const setup = baseSetup([conditionedRule()]);

    const pending = await service.gateCommand(buildCommand({ newAnnualSalary: 1 }), setup);

    expect(pending?.success).toBe(true);
    expect(pending?.newState).toBe('PENDING_APPROVAL');
  });

  it.each([
    ['GREATER_THAN', 15000, 10000, true],
    ['GREATER_THAN', 5000, 10000, false],
    ['LESS_THAN', 5000, 10000, true],
    ['LESS_THAN', 15000, 10000, false],
    ['GREATER_OR_EQUAL', 10000, 10000, true],
    ['GREATER_OR_EQUAL', 9999, 10000, false],
    ['LESS_OR_EQUAL', 10000, 10000, true],
    ['LESS_OR_EQUAL', 10001, 10000, false],
  ] as const)('applies the %s operator (actual=%s, expected=%s -> intercept=%s)', async (operator, actual, expected, shouldIntercept) => {
    const repository = new InMemoryApprovalChainRepository();
    const service = new ApprovalWorkflowService(repository);
    const setup = baseSetup([conditionedRule({
      conditions: [{ field: 'newAnnualSalary', operator, value: expected }],
    })]);

    const pending = await service.gateCommand(buildCommand({ newAnnualSalary: actual }), setup);

    if (shouldIntercept) {
      expect(pending?.success).toBe(true);
      expect(pending?.newState).toBe('PENDING_APPROVAL');
    } else {
      expect(pending).toBeUndefined();
    }
  });

  it.each([
    ['EQUALS', 'PROMOTION', 'PROMOTION', true],
    ['EQUALS', 'MERIT', 'PROMOTION', false],
    ['NOT_EQUALS', 'MERIT', 'PROMOTION', true],
    ['NOT_EQUALS', 'PROMOTION', 'PROMOTION', false],
  ] as const)('applies the %s operator on string fields (actual=%s, expected=%s -> intercept=%s)', async (operator, actual, expected, shouldIntercept) => {
    const repository = new InMemoryApprovalChainRepository();
    const service = new ApprovalWorkflowService(repository);
    const setup = baseSetup([conditionedRule({
      conditions: [{ field: 'changeType', operator, value: expected }],
    })]);

    const pending = await service.gateCommand(buildCommand({ changeType: actual }), setup);

    if (shouldIntercept) {
      expect(pending?.success).toBe(true);
    } else {
      expect(pending).toBeUndefined();
    }
  });

  it('applies the CONTAINS operator against array fields', async () => {
    const repository = new InMemoryApprovalChainRepository();
    const service = new ApprovalWorkflowService(repository);
    const setup = baseSetup([conditionedRule({
      conditions: [{ field: 'tags', operator: 'CONTAINS', value: 'URGENT' }],
    })]);

    const matching = await service.gateCommand(buildCommand({ tags: ['ROUTINE', 'URGENT'] }), setup);
    expect(matching?.success).toBe(true);

    const nonMatching = await service.gateCommand(buildCommand({ tags: ['ROUTINE'] }), setup);
    expect(nonMatching).toBeUndefined();
  });

  it('applies the CONTAINS operator against string fields (substring match)', async () => {
    const repository = new InMemoryApprovalChainRepository();
    const service = new ApprovalWorkflowService(repository);
    const setup = baseSetup([conditionedRule({
      conditions: [{ field: 'justification', operator: 'CONTAINS', value: 'retention' }],
    })]);

    const matching = await service.gateCommand(buildCommand({ justification: 'Counter-offer retention case' }), setup);
    expect(matching?.success).toBe(true);

    const nonMatching = await service.gateCommand(buildCommand({ justification: 'Standard merit increase' }), setup);
    expect(nonMatching).toBeUndefined();
  });

  it('resolves dot-separated nested field paths within the payload', async () => {
    const repository = new InMemoryApprovalChainRepository();
    const service = new ApprovalWorkflowService(repository);
    const setup = baseSetup([conditionedRule({
      conditions: [{ field: 'compensationChange.newAnnualSalary', operator: 'GREATER_THAN', value: 10000 }],
    })]);

    const matching = await service.gateCommand(
      buildCommand({ compensationChange: { newAnnualSalary: 25000 } }),
      setup,
    );
    expect(matching?.success).toBe(true);

    const nonMatching = await service.gateCommand(
      buildCommand({ compensationChange: { newAnnualSalary: 2000 } }),
      setup,
    );
    expect(nonMatching).toBeUndefined();
  });

  it('combines multiple conditions with ALL (AND) logic by default', async () => {
    const repository = new InMemoryApprovalChainRepository();
    const service = new ApprovalWorkflowService(repository);
    const setup = baseSetup([conditionedRule({
      conditions: [
        { field: 'newAnnualSalary', operator: 'GREATER_THAN', value: 10000 },
        { field: 'changeType', operator: 'EQUALS', value: 'PROMOTION' },
      ],
    })]);

    const bothMatch = await service.gateCommand(buildCommand({ newAnnualSalary: 20000, changeType: 'PROMOTION' }), setup);
    expect(bothMatch?.success).toBe(true);

    const onlyAmountMatches = await service.gateCommand(buildCommand({ newAnnualSalary: 20000, changeType: 'MERIT' }), setup);
    expect(onlyAmountMatches).toBeUndefined();

    const onlyTypeMatches = await service.gateCommand(buildCommand({ newAnnualSalary: 1000, changeType: 'PROMOTION' }), setup);
    expect(onlyTypeMatches).toBeUndefined();

    const neitherMatches = await service.gateCommand(buildCommand({ newAnnualSalary: 1000, changeType: 'MERIT' }), setup);
    expect(neitherMatches).toBeUndefined();
  });

  it('combines multiple conditions with ANY (OR) logic when configured', async () => {
    const repository = new InMemoryApprovalChainRepository();
    const service = new ApprovalWorkflowService(repository);
    const setup = baseSetup([conditionedRule({
      conditionLogic: 'ANY',
      conditions: [
        { field: 'newAnnualSalary', operator: 'GREATER_THAN', value: 10000 },
        { field: 'changeType', operator: 'EQUALS', value: 'PROMOTION' },
      ],
    })]);

    const onlyAmountMatches = await service.gateCommand(buildCommand({ newAnnualSalary: 20000, changeType: 'MERIT' }), setup);
    expect(onlyAmountMatches?.success).toBe(true);

    const onlyTypeMatches = await service.gateCommand(buildCommand({ newAnnualSalary: 1000, changeType: 'PROMOTION' }), setup);
    expect(onlyTypeMatches?.success).toBe(true);

    const neitherMatches = await service.gateCommand(buildCommand({ newAnnualSalary: 1000, changeType: 'MERIT' }), setup);
    expect(neitherMatches).toBeUndefined();
  });

  it('falls through to the next candidate rule for the same command when an earlier rule\'s conditions do not match', async () => {
    const repository = new InMemoryApprovalChainRepository();
    const service = new ApprovalWorkflowService(repository);
    const setup = baseSetup([
      conditionedRule({
        code: 'HIGH_VALUE_COMP_CHANGE',
        conditions: [{ field: 'newAnnualSalary', operator: 'GREATER_THAN', value: 100000 }],
        steps: [{ code: 'EXEC_REVIEW', label: 'Executive review', active: true, order: 1, mode: 'SEQUENTIAL', approverType: 'ROLE', approverRole: 'EXECUTIVE', slaHours: 8 }],
      }),
      conditionedRule({
        code: 'STANDARD_COMP_CHANGE',
      }),
    ]);

    const pending = await service.gateCommand(buildCommand({ newAnnualSalary: 20000 }), setup);

    expect(pending?.success).toBe(true);
    const chainId = (pending?.data as { approvalChainId: string }).approvalChainId;
    const chain = await repository.findById(new Uuid(chainId));
    expect(chain?.steps[0].code).toBe('HR_REVIEW');
  });

  it('regression: a rule with no conditions still matches purely on commandName/aggregateType even when other conditioned rules exist', async () => {
    const repository = new InMemoryApprovalChainRepository();
    const service = new ApprovalWorkflowService(repository);
    const setup = baseSetup([conditionedRule()]);

    const pendingHighValue = await service.gateCommand(buildCommand({ newAnnualSalary: 999999 }), setup);
    const pendingLowValue = await service.gateCommand(buildCommand({ newAnnualSalary: 1 }), setup);

    expect(pendingHighValue?.success).toBe(true);
    expect(pendingLowValue?.success).toBe(true);
  });
});
