import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WorkAuthorizationCaseRepository } from '../repositories/work-authorization-case.repository.js';
import { GlobalHrEventsPublisher } from '../events/global-hr-events.publisher.js';

type WorkAuthorizationPayload = {
  workAuthorizationCaseId: Uuid;
  validFrom?: Date;
  validUntil?: Date;
  documentNumber?: string;
  newValidUntil?: Date;
};

function workAuthorizationResult(
  command: HrCommandEnvelope<unknown>,
  fsm: FsmFramework,
  authCase: Awaited<ReturnType<WorkAuthorizationCaseRepository['findById']>>,
): CommandResult<unknown> {
  if (!authCase) throw new Error('Work authorization case not found');
  return {
    success: true,
    data: { workAuthorizationCaseId: authCase.id.value, status: authCase.status },
    commandId: command.commandId,
    correlationId: command.correlationId,
    aggregateId: authCase.id,
    newState: authCase.status,
    newVersion: authCase.aggregateVersion,
    allowedNextActions: fsm.getAllowedActionsFromState(authCase.status, 'WorkAuthorizationCase'),
    fieldAccessDecisions: {},
    eventsEmitted: authCase.domainEvents.map((event) => event.eventName),
    auditRecordId: command.commandId,
  };
}

@CommandHandler('StartWorkAuthorizationReview')
@Injectable()
export class StartWorkAuthorizationReviewHandler {
  readonly commandName = 'StartWorkAuthorizationReview';

  constructor(
    private readonly repo: WorkAuthorizationCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as WorkAuthorizationPayload;
    const authCase = await this.repo.findById(payload.workAuthorizationCaseId);
    if (!authCase) throw new Error('Work authorization case not found');
    authCase.startReview(command.correlationId);
    await this.repo.save(authCase);
    await this.eventsPublisher.publishUncommitted(authCase, command.tenantId, command.correlationId);
    return workAuthorizationResult(command, this.fsm, authCase);
  }
}

@CommandHandler('ApproveWorkAuthorizationCase')
@Injectable()
export class ApproveWorkAuthorizationCaseHandler {
  readonly commandName = 'ApproveWorkAuthorizationCase';

  constructor(
    private readonly repo: WorkAuthorizationCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as WorkAuthorizationPayload;
    const authCase = await this.repo.findById(payload.workAuthorizationCaseId);
    if (!authCase) throw new Error('Work authorization case not found');
    authCase.approve(
      command.correlationId,
      payload.validFrom ?? new Date(),
      payload.validUntil ?? new Date(),
      payload.documentNumber,
    );
    await this.repo.save(authCase);
    await this.eventsPublisher.publishUncommitted(authCase, command.tenantId, command.correlationId);
    return workAuthorizationResult(command, this.fsm, authCase);
  }
}

@CommandHandler('ExpireWorkAuthorizationCase')
@Injectable()
export class ExpireWorkAuthorizationCaseHandler {
  readonly commandName = 'ExpireWorkAuthorizationCase';

  constructor(
    private readonly repo: WorkAuthorizationCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as WorkAuthorizationPayload;
    const authCase = await this.repo.findById(payload.workAuthorizationCaseId);
    if (!authCase) throw new Error('Work authorization case not found');
    authCase.expire(command.correlationId);
    await this.repo.save(authCase);
    await this.eventsPublisher.publishUncommitted(authCase, command.tenantId, command.correlationId);
    return workAuthorizationResult(command, this.fsm, authCase);
  }
}

@CommandHandler('RenewWorkAuthorizationCase')
@Injectable()
export class RenewWorkAuthorizationCaseHandler {
  readonly commandName = 'RenewWorkAuthorizationCase';

  constructor(
    private readonly repo: WorkAuthorizationCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as WorkAuthorizationPayload;
    const authCase = await this.repo.findById(payload.workAuthorizationCaseId);
    if (!authCase) throw new Error('Work authorization case not found');
    authCase.renew(command.correlationId, payload.newValidUntil ?? payload.validUntil ?? new Date());
    await this.repo.save(authCase);
    await this.eventsPublisher.publishUncommitted(authCase, command.tenantId, command.correlationId);
    return workAuthorizationResult(command, this.fsm, authCase);
  }
}

@CommandHandler('CloseWorkAuthorizationCase')
@Injectable()
export class CloseWorkAuthorizationCaseHandler {
  readonly commandName = 'CloseWorkAuthorizationCase';

  constructor(
    private readonly repo: WorkAuthorizationCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as WorkAuthorizationPayload;
    const authCase = await this.repo.findById(payload.workAuthorizationCaseId);
    if (!authCase) throw new Error('Work authorization case not found');
    authCase.close(command.correlationId);
    await this.repo.save(authCase);
    await this.eventsPublisher.publishUncommitted(authCase, command.tenantId, command.correlationId);
    return workAuthorizationResult(command, this.fsm, authCase);
  }
}

@CommandHandler('RejectWorkAuthorizationCase')
@Injectable()
export class RejectWorkAuthorizationCaseHandler {
  readonly commandName = 'RejectWorkAuthorizationCase';

  constructor(
    private readonly repo: WorkAuthorizationCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as WorkAuthorizationPayload;
    const authCase = await this.repo.findById(payload.workAuthorizationCaseId);
    if (!authCase) throw new Error('Work authorization case not found');
    authCase.reject(command.correlationId);
    await this.repo.save(authCase);
    await this.eventsPublisher.publishUncommitted(authCase, command.tenantId, command.correlationId);
    return workAuthorizationResult(command, this.fsm, authCase);
  }
}
