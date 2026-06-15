import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { CommandOutcome, HrCommandEnvelope } from '@hcm/command-contracts';
import { ApprovalChain } from './approval-chain.aggregate.js';
import type { ApprovalChainRepositoryPort } from './approval-chain.repository.js';
import { ApprovalWorkflowService } from './approval-workflow.service.js';

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
