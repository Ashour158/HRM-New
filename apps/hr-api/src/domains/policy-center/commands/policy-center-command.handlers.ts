import { Injectable } from '@nestjs/common';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { PolicyCenterService } from '../policy-center.service.js';
import type {
  CreatePolicyRevisionInput,
  PolicyActor,
  PolicyApplyInput,
  PolicyImpactSimulationResult,
  PolicyRevisionRecord,
  PolicyRollbackInput,
  PolicyValidationResult,
  UpdatePolicyRevisionInput,
} from '../policy-center.types.js';

type IdPayload = { id: string };
type UpdatePayload = IdPayload & { input: UpdatePolicyRevisionInput };
type ApplyPayload = IdPayload & { input?: PolicyApplyInput };
type RollbackPayload = IdPayload & { input: PolicyRollbackInput };

abstract class PolicyCenterCommandHandler<TPayload, TResult> implements ICommandHandler {
  abstract readonly commandName: string;

  protected constructor(protected readonly service: PolicyCenterService) {}

  abstract execute(command: HrCommandEnvelope<TPayload>, actor: PolicyActor): Promise<TResult>;

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<TResult>> {
    const typedCommand = command as HrCommandEnvelope<TPayload>;
    const data = await this.execute(typedCommand, this.policyActor(command));
    return this.result(command, data);
  }

  protected idPayload<T extends IdPayload>(command: HrCommandEnvelope<T>): T {
    if (!command.payload?.id) {
      throw new Error(`${command.commandName} requires a policy revision id`);
    }
    return command.payload;
  }

  private policyActor(command: HrCommandEnvelope<unknown>): PolicyActor {
    return {
      actorId: command.actor.actorId.value,
      actorName: command.actor.email,
    };
  }

  private result(command: HrCommandEnvelope<unknown>, data: TResult): CommandResult<TResult> {
    const record = this.recordLike(data);
    const state = typeof record.status === 'string' ? record.status : this.stateFromCommand(command.commandName);
    return {
      success: true,
      data,
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: this.aggregateId(command, record),
      newState: state,
      newVersion: this.version(record),
      allowedNextActions: this.allowedActions(state),
      fieldAccessDecisions: {},
      eventsEmitted: [this.eventName(command.commandName)],
      auditRecordId: Uuid.generate(),
    };
  }

  private recordLike(data: TResult): Record<string, unknown> {
    return typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
  }

  private aggregateId(command: HrCommandEnvelope<unknown>, record: Record<string, unknown>): Uuid {
    const id = typeof record.id === 'string'
      ? record.id
      : typeof (command.payload as Partial<IdPayload> | undefined)?.id === 'string'
        ? (command.payload as IdPayload).id
        : undefined;
    if (id && Uuid.isValid(id)) {
      return new Uuid(id);
    }
    return command.aggregateId ?? command.tenantId;
  }

  private version(record: Record<string, unknown>): number {
    const version = record.aggregateVersion;
    return typeof version === 'number' && Number.isFinite(version) ? version : 1;
  }

  private stateFromCommand(commandName: string): string {
    return commandName
      .replace(/PolicyRevision|PolicyRollbackDraft/g, '')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toUpperCase();
  }

  private eventName(commandName: string): string {
    return commandName.endsWith('PolicyRevision')
      ? `${commandName}Completed`
      : `${commandName}`;
  }

  private allowedActions(state: string): string[] {
    switch (state) {
      case 'DRAFT':
        return ['UpdatePolicyRevision', 'ValidatePolicyRevision', 'SubmitPolicyRevisionForReview'];
      case 'IN_REVIEW':
        return ['UpdatePolicyRevision', 'MarkPolicyRevisionReviewed'];
      case 'REVIEWED':
        return ['UpdatePolicyRevision', 'ApprovePolicyRevision'];
      case 'APPROVED':
        return ['PublishPolicyRevision'];
      case 'PUBLISHED':
        return ['ApplyPolicyRevision', 'CreatePolicyRollbackDraft'];
      case 'APPLIED':
        return ['CreatePolicyRollbackDraft'];
      default:
        return ['ViewPolicyRevision'];
    }
  }
}

@Injectable()
@CommandHandler('CreatePolicyRevision')
export class CreatePolicyRevisionHandler extends PolicyCenterCommandHandler<CreatePolicyRevisionInput, PolicyRevisionRecord> {
  readonly commandName = 'CreatePolicyRevision';

  constructor(service: PolicyCenterService) {
    super(service);
  }

  execute(command: HrCommandEnvelope<CreatePolicyRevisionInput>, actor: PolicyActor): Promise<PolicyRevisionRecord> {
    return this.service.createRevision(command.tenantId, command.payload, actor);
  }
}

@Injectable()
@CommandHandler('UpdatePolicyRevision')
export class UpdatePolicyRevisionHandler extends PolicyCenterCommandHandler<UpdatePayload, PolicyRevisionRecord> {
  readonly commandName = 'UpdatePolicyRevision';

  constructor(service: PolicyCenterService) {
    super(service);
  }

  execute(command: HrCommandEnvelope<UpdatePayload>, actor: PolicyActor): Promise<PolicyRevisionRecord> {
    const payload = this.idPayload(command);
    return this.service.updateRevision(command.tenantId, payload.id, payload.input, actor);
  }
}

@Injectable()
@CommandHandler('ValidatePolicyRevision')
export class ValidatePolicyRevisionHandler extends PolicyCenterCommandHandler<IdPayload, PolicyValidationResult> {
  readonly commandName = 'ValidatePolicyRevision';

  constructor(service: PolicyCenterService) {
    super(service);
  }

  execute(command: HrCommandEnvelope<IdPayload>, actor: PolicyActor): Promise<PolicyValidationResult> {
    const payload = this.idPayload(command);
    return this.service.validateRevision(command.tenantId, payload.id, actor);
  }
}

@Injectable()
@CommandHandler('SimulatePolicyRevision')
export class SimulatePolicyRevisionHandler extends PolicyCenterCommandHandler<IdPayload, PolicyImpactSimulationResult> {
  readonly commandName = 'SimulatePolicyRevision';

  constructor(service: PolicyCenterService) {
    super(service);
  }

  execute(command: HrCommandEnvelope<IdPayload>, actor: PolicyActor): Promise<PolicyImpactSimulationResult> {
    const payload = this.idPayload(command);
    return this.service.simulateRevision(command.tenantId, payload.id, actor);
  }
}

@Injectable()
@CommandHandler('SubmitPolicyRevisionForReview')
export class SubmitPolicyRevisionForReviewHandler extends PolicyCenterCommandHandler<IdPayload, PolicyRevisionRecord> {
  readonly commandName = 'SubmitPolicyRevisionForReview';

  constructor(service: PolicyCenterService) {
    super(service);
  }

  execute(command: HrCommandEnvelope<IdPayload>, actor: PolicyActor): Promise<PolicyRevisionRecord> {
    const payload = this.idPayload(command);
    return this.service.submitForReview(command.tenantId, payload.id, actor);
  }
}

@Injectable()
@CommandHandler('MarkPolicyRevisionReviewed')
export class MarkPolicyRevisionReviewedHandler extends PolicyCenterCommandHandler<IdPayload, PolicyRevisionRecord> {
  readonly commandName = 'MarkPolicyRevisionReviewed';

  constructor(service: PolicyCenterService) {
    super(service);
  }

  execute(command: HrCommandEnvelope<IdPayload>, actor: PolicyActor): Promise<PolicyRevisionRecord> {
    const payload = this.idPayload(command);
    return this.service.markReviewed(command.tenantId, payload.id, actor);
  }
}

@Injectable()
@CommandHandler('ApprovePolicyRevision')
export class ApprovePolicyRevisionHandler extends PolicyCenterCommandHandler<IdPayload, PolicyRevisionRecord> {
  readonly commandName = 'ApprovePolicyRevision';

  constructor(service: PolicyCenterService) {
    super(service);
  }

  execute(command: HrCommandEnvelope<IdPayload>, actor: PolicyActor): Promise<PolicyRevisionRecord> {
    const payload = this.idPayload(command);
    return this.service.approveRevision(command.tenantId, payload.id, actor);
  }
}

@Injectable()
@CommandHandler('PublishPolicyRevision')
export class PublishPolicyRevisionHandler extends PolicyCenterCommandHandler<IdPayload, PolicyRevisionRecord> {
  readonly commandName = 'PublishPolicyRevision';

  constructor(service: PolicyCenterService) {
    super(service);
  }

  execute(command: HrCommandEnvelope<IdPayload>, actor: PolicyActor): Promise<PolicyRevisionRecord> {
    const payload = this.idPayload(command);
    return this.service.publishRevision(command.tenantId, payload.id, actor);
  }
}

@Injectable()
@CommandHandler('ApplyPolicyRevision')
export class ApplyPolicyRevisionHandler extends PolicyCenterCommandHandler<ApplyPayload, PolicyRevisionRecord> {
  readonly commandName = 'ApplyPolicyRevision';

  constructor(service: PolicyCenterService) {
    super(service);
  }

  execute(command: HrCommandEnvelope<ApplyPayload>, actor: PolicyActor): Promise<PolicyRevisionRecord> {
    const payload = this.idPayload(command);
    return this.service.applyRevision(command.tenantId, payload.id, actor, payload.input ?? {});
  }
}

@Injectable()
@CommandHandler('CreatePolicyRollbackDraft')
export class CreatePolicyRollbackDraftHandler extends PolicyCenterCommandHandler<RollbackPayload, PolicyRevisionRecord> {
  readonly commandName = 'CreatePolicyRollbackDraft';

  constructor(service: PolicyCenterService) {
    super(service);
  }

  execute(command: HrCommandEnvelope<RollbackPayload>, actor: PolicyActor): Promise<PolicyRevisionRecord> {
    const payload = this.idPayload(command);
    return this.service.createRollbackDraft(command.tenantId, payload.id, payload.input, actor);
  }
}

export const POLICY_CENTER_COMMAND_HANDLERS = [
  CreatePolicyRevisionHandler,
  UpdatePolicyRevisionHandler,
  ValidatePolicyRevisionHandler,
  SimulatePolicyRevisionHandler,
  SubmitPolicyRevisionForReviewHandler,
  MarkPolicyRevisionReviewedHandler,
  ApprovePolicyRevisionHandler,
  PublishPolicyRevisionHandler,
  ApplyPolicyRevisionHandler,
  CreatePolicyRollbackDraftHandler,
];
