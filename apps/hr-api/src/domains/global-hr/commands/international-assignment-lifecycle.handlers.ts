import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { InternationalAssignment } from '../aggregates/international-assignment.aggregate.js';
import { InternationalAssignmentRepository } from '../repositories/international-assignment.repository.js';
import { GlobalHrEventsPublisher } from '../events/global-hr-events.publisher.js';

type CreateInternationalAssignmentPayload = {
  assignmentId: string;
  workerId: string;
  homeCountry: string;
  hostCountry: string;
  legalEntityId?: string;
  startDate: Date;
  endDate: Date;
  assignmentReason: string;
};

type InternationalAssignmentPayload = {
  internationalAssignmentId: Uuid;
};

function internationalAssignmentResult(
  command: HrCommandEnvelope<unknown>,
  fsm: FsmFramework,
  assignment: Awaited<ReturnType<InternationalAssignmentRepository['findById']>>,
): CommandResult<unknown> {
  if (!assignment) throw new Error('International assignment not found');
  return {
    success: true,
    data: { internationalAssignmentId: assignment.id.value, status: assignment.status },
    commandId: command.commandId,
    correlationId: command.correlationId,
    aggregateId: assignment.id,
    newState: assignment.status,
    newVersion: assignment.aggregateVersion,
    allowedNextActions: fsm.getAllowedActionsFromState(assignment.status, 'InternationalAssignment'),
    fieldAccessDecisions: {},
    eventsEmitted: assignment.domainEvents.map((event) => event.eventName),
    auditRecordId: command.commandId,
  };
}

@CommandHandler('CreateInternationalAssignment')
@Injectable()
export class CreateInternationalAssignmentHandler {
  readonly commandName = 'CreateInternationalAssignment';

  constructor(
    private readonly repo: InternationalAssignmentRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateInternationalAssignmentPayload;
    const assignment = InternationalAssignment.create(
      {
        id: new Uuid(payload.assignmentId),
        tenantId: command.tenantId,
        workerId: new Uuid(payload.workerId),
        homeCountry: payload.homeCountry,
        hostCountry: payload.hostCountry,
        legalEntityId: payload.legalEntityId ? new Uuid(payload.legalEntityId) : undefined,
        startDate: new Date(payload.startDate),
        endDate: new Date(payload.endDate),
        assignmentReason: payload.assignmentReason,
      },
      command.correlationId,
    );

    await this.repo.save(assignment);
    await this.eventsPublisher.publishUncommitted(assignment, command.tenantId, command.correlationId);
    return internationalAssignmentResult(command, this.fsm, assignment);
  }
}

@CommandHandler('ApproveInternationalAssignment')
@Injectable()
export class ApproveInternationalAssignmentHandler {
  readonly commandName = 'ApproveInternationalAssignment';

  constructor(
    private readonly repo: InternationalAssignmentRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as InternationalAssignmentPayload;
    const assignment = await this.repo.findById(payload.internationalAssignmentId);
    if (!assignment) throw new Error('International assignment not found');
    assignment.approve(command.correlationId);
    await this.repo.save(assignment);
    await this.eventsPublisher.publishUncommitted(assignment, command.tenantId, command.correlationId);
    return internationalAssignmentResult(command, this.fsm, assignment);
  }
}

@CommandHandler('ActivateInternationalAssignment')
@Injectable()
export class ActivateInternationalAssignmentHandler {
  readonly commandName = 'ActivateInternationalAssignment';

  constructor(
    private readonly repo: InternationalAssignmentRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as InternationalAssignmentPayload;
    const assignment = await this.repo.findById(payload.internationalAssignmentId);
    if (!assignment) throw new Error('International assignment not found');
    assignment.activate(command.correlationId);
    await this.repo.save(assignment);
    await this.eventsPublisher.publishUncommitted(assignment, command.tenantId, command.correlationId);
    return internationalAssignmentResult(command, this.fsm, assignment);
  }
}

@CommandHandler('CompleteInternationalAssignment')
@Injectable()
export class CompleteInternationalAssignmentHandler {
  readonly commandName = 'CompleteInternationalAssignment';

  constructor(
    private readonly repo: InternationalAssignmentRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as InternationalAssignmentPayload;
    const assignment = await this.repo.findById(payload.internationalAssignmentId);
    if (!assignment) throw new Error('International assignment not found');
    assignment.complete(command.correlationId);
    await this.repo.save(assignment);
    await this.eventsPublisher.publishUncommitted(assignment, command.tenantId, command.correlationId);
    return internationalAssignmentResult(command, this.fsm, assignment);
  }
}

@CommandHandler('ExpireInternationalAssignment')
@Injectable()
export class ExpireInternationalAssignmentHandler {
  readonly commandName = 'ExpireInternationalAssignment';

  constructor(
    private readonly repo: InternationalAssignmentRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as InternationalAssignmentPayload;
    const assignment = await this.repo.findById(payload.internationalAssignmentId);
    if (!assignment) throw new Error('International assignment not found');
    assignment.expire(command.correlationId);
    await this.repo.save(assignment);
    await this.eventsPublisher.publishUncommitted(assignment, command.tenantId, command.correlationId);
    return internationalAssignmentResult(command, this.fsm, assignment);
  }
}

@CommandHandler('CancelInternationalAssignment')
@Injectable()
export class CancelInternationalAssignmentHandler {
  readonly commandName = 'CancelInternationalAssignment';

  constructor(
    private readonly repo: InternationalAssignmentRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as InternationalAssignmentPayload;
    const assignment = await this.repo.findById(payload.internationalAssignmentId);
    if (!assignment) throw new Error('International assignment not found');
    assignment.cancel(command.correlationId);
    await this.repo.save(assignment);
    await this.eventsPublisher.publishUncommitted(assignment, command.tenantId, command.correlationId);
    return internationalAssignmentResult(command, this.fsm, assignment);
  }
}
