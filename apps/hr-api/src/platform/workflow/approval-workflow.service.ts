import { Inject, Injectable, Optional } from '@nestjs/common';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import type { AccessControlDecision } from '@hcm/access-control';
import type { CommandOutcome, CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import type { HcmSetupConfig, ApprovalWorkflowRule, ApprovalWorkflowStepRule } from '../../domains/hcm-setup/hcm-setup.types.js';
import { ReminderEmitter } from '../scheduler/reminder-emitter.js';
import { ApprovalChain, type ApprovalStepDefinition } from './approval-chain.aggregate.js';
import { ApprovalChainRepository, type ApprovalChainRepositoryPort } from './approval-chain.repository.js';

export type CommandExecutor = (command: HrCommandEnvelope<unknown>) => Promise<CommandOutcome<unknown>>;

export interface ApprovalWorkflowPendingResult {
  approvalRequired: true;
  approvalChainId: string;
  status: 'PENDING_APPROVAL';
  commandName: string;
  aggregateType: string;
  aggregateId?: string;
  steps: Array<{
    id: string;
    code: string;
    label: string;
    order: number;
    state: string;
    approverRole?: string;
    approverWorkerId?: string;
    slaDueAt?: string;
  }>;
}

@Injectable()
export class ApprovalWorkflowService {
  private executor?: CommandExecutor;

  constructor(
    @Optional()
    @Inject(ApprovalChainRepository)
    private readonly repository: ApprovalChainRepositoryPort = new ApprovalChainRepository(),
    @Optional()
    @Inject(ReminderEmitter)
    private readonly reminderEmitter?: ReminderEmitter,
  ) {}

  bindCommandExecutor(executor: CommandExecutor): void {
    this.executor = executor;
  }

  async gateCommand(
    command: HrCommandEnvelope<unknown>,
    setup: HcmSetupConfig,
    accessDecision?: Pick<AccessControlDecision, 'requiresApproval'>,
  ): Promise<CommandResult<ApprovalWorkflowPendingResult> | undefined> {
    if (this.shouldSkipApprovalGate(command)) return undefined;

    const rule = this.resolveRule(command, setup, accessDecision);
    if (!rule) return undefined;

    const chain = ApprovalChain.create({
      id: Uuid.generate(),
      tenantId: command.tenantId,
      commandName: command.commandName,
      aggregateType: command.aggregateType,
      aggregateId: command.aggregateId,
      requestedBy: command.actor.actorId,
      commandEnvelope: serializeCommand(command),
      steps: this.toStepDefinitions(rule),
      correlationId: command.correlationId,
      idempotencyKey: command.idempotencyKey,
    });
    await this.repository.save(chain);

    return {
      success: true,
      data: this.serializePending(chain),
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: chain.id,
      newState: 'PENDING_APPROVAL',
      newVersion: chain.aggregateVersion,
      allowedNextActions: ['ApproveApprovalStep', 'RejectApprovalStep', 'DelegateApprovalStep'],
      fieldAccessDecisions: {},
      eventsEmitted: ['ApprovalChainRequested'],
      auditRecordId: command.commandId,
    };
  }

  async getChain(chainId: Uuid): Promise<ApprovalChain> {
    const chain = await this.repository.findById(chainId);
    if (!chain) throw new ValidationError(`Approval chain ${chainId.value} not found`);
    return chain;
  }

  async findPendingForActor(tenantId: Uuid, actorRoles: string[], actorId?: Uuid): Promise<ApprovalChain[]> {
    return this.repository.findPendingForActor(tenantId, actorRoles, actorId);
  }

  async approveStep(chainId: Uuid, stepId: Uuid, actorId: Uuid, reason?: string): Promise<CommandResult<Record<string, unknown>>> {
    const chain = await this.getChain(chainId);
    chain.approveStep(stepId, actorId, reason);
    await this.repository.save(chain);

    let committedCommandResult: CommandOutcome<unknown> | undefined;
    if (chain.status === 'APPROVED') {
      committedCommandResult = await this.replayApprovedCommand(chain);
    }

    return this.workflowResult('ApproveApprovalStep', chain, actorId, {
      approvalChainId: chain.id.value,
      stepId: stepId.value,
      status: chain.status,
      committedCommandResult,
    });
  }

  async rejectStep(chainId: Uuid, stepId: Uuid, actorId: Uuid, reason?: string): Promise<CommandResult<Record<string, unknown>>> {
    const chain = await this.getChain(chainId);
    chain.rejectStep(stepId, actorId, reason);
    await this.repository.save(chain);
    return this.workflowResult('RejectApprovalStep', chain, actorId, {
      approvalChainId: chain.id.value,
      stepId: stepId.value,
      status: chain.status,
    });
  }

  async delegateStep(chainId: Uuid, stepId: Uuid, actorId: Uuid, delegateToWorkerId: Uuid, reason: string): Promise<CommandResult<Record<string, unknown>>> {
    const chain = await this.getChain(chainId);
    chain.delegateStep(stepId, actorId, delegateToWorkerId, reason);
    await this.repository.save(chain);
    await this.repository.recordDelegation({
      tenantId: chain.tenantId,
      chainId,
      stepId,
      fromWorkerId: actorId,
      toWorkerId: delegateToWorkerId,
      actorId,
      reason,
    });
    return this.workflowResult('DelegateApprovalStep', chain, actorId, {
      approvalChainId: chain.id.value,
      stepId: stepId.value,
      delegatedToWorkerId: delegateToWorkerId.value,
      status: chain.status,
    });
  }

  async escalateOverdue(chainId: Uuid, now: Date, actorId: Uuid): Promise<CommandResult<Record<string, unknown>>> {
    const chain = await this.getChain(chainId);
    const before = new Map(chain.steps.map((step) => [step.id.value, step.state]));
    const escalated = chain.escalateOverdue(now, actorId);
    await this.repository.save(chain);
    await this.emitEscalationReminders(chain, before, now);
    return this.workflowResult('EscalateApprovalChainOverdue', chain, actorId, {
      approvalChainId: chain.id.value,
      status: chain.status,
      escalatedSteps: escalated,
    });
  }

  private async replayApprovedCommand(chain: ApprovalChain): Promise<CommandOutcome<unknown>> {
    if (!this.executor) {
      throw new ValidationError('Approval workflow command executor is not bound');
    }
    const original = rehydrateCommand(chain.commandEnvelope);
    const replay: HrCommandEnvelope<unknown> = {
      ...original,
      commandId: Uuid.generate(),
      idempotencyKey: `${original.idempotencyKey}:approval:${chain.id.value}`,
      correlationId: chain.correlationId,
      metadata: {
        ...original.metadata,
        approvalResume: true,
        approvalChainId: chain.id.value,
      } as HrCommandEnvelope<unknown>['metadata'] & Record<string, unknown>,
    };
    return this.executor(replay);
  }

  private resolveRule(
    command: HrCommandEnvelope<unknown>,
    setup: HcmSetupConfig,
    accessDecision?: Pick<AccessControlDecision, 'requiresApproval'>,
  ): ApprovalWorkflowRule | undefined {
    const explicit = (setup.approvalWorkflowRules ?? []).find((rule) => (
      rule.active !== false
      && rule.commandName === command.commandName
      && (!rule.aggregateType || rule.aggregateType === command.aggregateType)
    ));
    if (explicit) return explicit;
    if (accessDecision?.requiresApproval) {
      return {
        code: 'DEFAULT_MANAGER_APPROVAL',
        label: 'Default manager approval',
        active: true,
        commandName: command.commandName,
        aggregateType: command.aggregateType,
        steps: [{
          code: 'MANAGER_APPROVAL',
          label: 'Manager approval',
          active: true,
          order: 1,
          mode: 'SEQUENTIAL',
          approverType: 'ROLE',
          approverRole: 'MANAGER',
          slaHours: 24,
        }],
      };
    }
    return undefined;
  }

  private shouldSkipApprovalGate(command: HrCommandEnvelope<unknown>): boolean {
    const metadata = command.metadata as HrCommandEnvelope<unknown>['metadata'] & Record<string, unknown>;
    return command.aggregateType === 'ApprovalChain'
      || metadata.approvalResume === true
      || command.commandName.includes('ApprovalStep')
      || command.commandName === 'EscalateApprovalChainOverdue';
  }

  private toStepDefinitions(rule: ApprovalWorkflowRule): ApprovalStepDefinition[] {
    const now = Date.now();
    return rule.steps
      .filter((step) => step.active !== false)
      .map((step, index) => ({
        code: step.code,
        label: step.label,
        order: Number.isFinite(step.order) ? step.order : index + 1,
        mode: step.mode,
        approverType: step.approverType,
        approverRole: step.approverRole,
        approverWorkerId: step.approverWorkerId ? new Uuid(step.approverWorkerId) : undefined,
        slaDueAt: new Date(now + Math.max(0, step.slaHours ?? rule.slaHours ?? 24) * 60 * 60 * 1000),
        escalationTiers: toEscalationTiers(step),
      }));
  }

  private serializePending(chain: ApprovalChain): ApprovalWorkflowPendingResult {
    return {
      approvalRequired: true,
      approvalChainId: chain.id.value,
      status: 'PENDING_APPROVAL',
      commandName: chain.commandName,
      aggregateType: chain.aggregateType,
      aggregateId: chain.aggregateId?.value,
      steps: chain.steps.map((step) => ({
        id: step.id.value,
        code: step.code,
        label: step.label,
        order: step.order,
        state: step.state,
        approverRole: step.approverRole,
        approverWorkerId: step.approverWorkerId?.value,
        slaDueAt: step.slaDueAt?.toISOString(),
      })),
    };
  }

  private workflowResult(commandName: string, chain: ApprovalChain, actorId: Uuid, data: Record<string, unknown>): CommandResult<Record<string, unknown>> {
    return {
      success: true,
      data,
      commandId: Uuid.generate(),
      correlationId: chain.correlationId,
      aggregateId: chain.id,
      newState: chain.status,
      newVersion: chain.aggregateVersion,
      allowedNextActions: chain.status === 'IN_PROGRESS'
        ? ['ApproveApprovalStep', 'RejectApprovalStep', 'DelegateApprovalStep', 'EscalateApprovalChainOverdue']
        : [],
      fieldAccessDecisions: {},
      eventsEmitted: commandName === 'ApproveApprovalStep' && chain.status === 'APPROVED'
        ? ['ApprovalStepApproved', 'ApprovalChainCompleted']
        : [commandName.replace('ApprovalStep', 'ApprovalStep').replace('EscalateApprovalChainOverdue', 'ApprovalChainEscalated')],
      auditRecordId: actorId,
    };
  }

  private async emitEscalationReminders(chain: ApprovalChain, before: Map<string, string>, now: Date): Promise<void> {
    if (!this.reminderEmitter) return;
    const escalated = chain.steps.filter((step) => before.get(step.id.value) !== 'ESCALATED' && step.state === 'ESCALATED');
    for (const step of escalated) {
      await this.reminderEmitter.emit({
        tenantId: chain.tenantId,
        audienceWorkerIds: step.delegatedToWorkerId ? [step.delegatedToWorkerId] : [],
        reminderType: 'APPROVAL_STEP_ESCALATED',
        subject: {
          aggregateType: 'ApprovalChain',
          subjectId: chain.id,
          subjectWorkerId: step.delegatedToWorkerId,
        },
        dueDate: step.slaDueAt ?? now,
        payload: {
          approvalChainId: chain.id.value,
          stepId: step.id.value,
          commandName: chain.commandName,
          aggregateType: chain.aggregateType,
          escalationTier: step.escalationTierCode,
        },
        escalationTier: {
          code: step.escalationTierCode ?? 'APPROVAL_ESCALATED',
          label: step.escalationTierLabel ?? 'Approval escalated',
          level: 1,
        },
        now,
      });
    }
  }
}

function toEscalationTiers(step: ApprovalWorkflowStepRule): ApprovalStepDefinition['escalationTiers'] {
  return (step.escalationTiers ?? []).map((tier) => ({
    code: tier.code,
    label: tier.label,
    approverRole: tier.approverRole,
    approverWorkerId: tier.approverWorkerId ? new Uuid(tier.approverWorkerId) : undefined,
    afterHours: tier.afterHours,
  }));
}

function serializeCommand(command: HrCommandEnvelope<unknown>): unknown {
  return JSON.parse(JSON.stringify(command, (_key, value) => (value instanceof Uuid ? value.value : value)));
}

function rehydrateCommand(value: unknown): HrCommandEnvelope<unknown> {
  return rehydrateUuidStrings(value) as HrCommandEnvelope<unknown>;
}

function rehydrateUuidStrings(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => rehydrateUuidStrings(item));
  if (typeof value === 'string' && Uuid.isValid(value)) return new Uuid(value);
  if (value && typeof value === 'object') {
    const rawValue = (value as { value?: unknown }).value;
    if (typeof rawValue === 'string' && Uuid.isValid(rawValue)) {
      return new Uuid(rawValue);
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, rehydrateUuidStrings(nested)]),
    );
  }
  return value;
}
