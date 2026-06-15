import { Injectable } from '@nestjs/common';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandHandler } from '../command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../command-bus/command-bus.js';
import { ApprovalWorkflowService } from './approval-workflow.service.js';

type ApprovalCommandPayload = Record<string, unknown>;

@Injectable()
@CommandHandler('ApproveApprovalStep')
export class ApproveApprovalStepHandler implements ICommandHandler {
  readonly commandName = 'ApproveApprovalStep';

  constructor(private readonly workflow: ApprovalWorkflowService) {}

  async handle(command: HrCommandEnvelope<ApprovalCommandPayload>): Promise<CommandResult<Record<string, unknown>>> {
    return this.workflow.approveStep(
      toUuid(command.payload.approvalChainId ?? command.aggregateId, 'approvalChainId'),
      toUuid(command.payload.stepId, 'stepId'),
      command.actor.actorId,
      stringOrUndefined(command.payload.reason),
    );
  }
}

@Injectable()
@CommandHandler('RejectApprovalStep')
export class RejectApprovalStepHandler implements ICommandHandler {
  readonly commandName = 'RejectApprovalStep';

  constructor(private readonly workflow: ApprovalWorkflowService) {}

  async handle(command: HrCommandEnvelope<ApprovalCommandPayload>): Promise<CommandResult<Record<string, unknown>>> {
    return this.workflow.rejectStep(
      toUuid(command.payload.approvalChainId ?? command.aggregateId, 'approvalChainId'),
      toUuid(command.payload.stepId, 'stepId'),
      command.actor.actorId,
      stringOrUndefined(command.payload.reason),
    );
  }
}

@Injectable()
@CommandHandler('DelegateApprovalStep')
export class DelegateApprovalStepHandler implements ICommandHandler {
  readonly commandName = 'DelegateApprovalStep';

  constructor(private readonly workflow: ApprovalWorkflowService) {}

  async handle(command: HrCommandEnvelope<ApprovalCommandPayload>): Promise<CommandResult<Record<string, unknown>>> {
    return this.workflow.delegateStep(
      toUuid(command.payload.approvalChainId ?? command.aggregateId, 'approvalChainId'),
      toUuid(command.payload.stepId, 'stepId'),
      command.actor.actorId,
      toUuid(command.payload.delegateToWorkerId, 'delegateToWorkerId'),
      stringOrUndefined(command.payload.reason) ?? 'Delegated approval step',
    );
  }
}

@Injectable()
@CommandHandler('EscalateApprovalChainOverdue')
export class EscalateApprovalChainOverdueHandler implements ICommandHandler {
  readonly commandName = 'EscalateApprovalChainOverdue';

  constructor(private readonly workflow: ApprovalWorkflowService) {}

  async handle(command: HrCommandEnvelope<ApprovalCommandPayload>): Promise<CommandResult<Record<string, unknown>>> {
    return this.workflow.escalateOverdue(
      toUuid(command.payload.approvalChainId ?? command.aggregateId, 'approvalChainId'),
      dateOrNow(command.payload.now),
      command.actor.actorId,
    );
  }
}

function toUuid(value: unknown, field: string): Uuid {
  if (value instanceof Uuid) return value;
  if (typeof value === 'string' && Uuid.isValid(value)) return new Uuid(value);
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const raw = (value as { value?: unknown }).value;
    if (typeof raw === 'string' && Uuid.isValid(raw)) return new Uuid(raw);
  }
  throw new ValidationError(`${field} must be a valid UUID`);
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function dateOrNow(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  return new Date();
}
