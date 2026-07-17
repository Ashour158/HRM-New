import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { I9CitizenshipStatus, I9DocumentType } from '../aggregates/i9-case.aggregate.js';
import { I9CaseRepository } from '../repositories/i9-case.repository.js';
import { I9EverifyEventsPublisher } from '../events/i9-everify-events.publisher.js';
import { coerceUuid } from './coerce-uuid.js';

export interface CompleteI9CaseSection1Payload {
  i9CaseId: string | Uuid;
  citizenshipStatus: I9CitizenshipStatus;
  section1CompletedAt?: Date;
}

export interface CompleteI9CaseSection2Payload {
  i9CaseId: string | Uuid;
  documentType: I9DocumentType;
  documentDescriptions?: string[];
  documentExpirationDate?: Date;
  reviewerId: string | Uuid;
  section2CompletedAt?: Date;
}

export interface RejectI9CasePayload {
  i9CaseId: string | Uuid;
  reason: string;
}

function i9CaseResult(
  command: HrCommandEnvelope<unknown>,
  fsm: FsmFramework,
  i9Case: Awaited<ReturnType<I9CaseRepository['findById']>>,
): CommandResult<unknown> {
  if (!i9Case) throw new ValidationError('I9 case not found');
  return {
    success: true,
    data: {
      i9CaseId: i9Case.id.value,
      status: i9Case.status,
      section1LateFlag: i9Case.section1LateFlag,
      section2LateFlag: i9Case.section2LateFlag,
      section2DueDate: i9Case.section2DueDate.toISOString(),
    },
    commandId: command.commandId,
    correlationId: command.correlationId,
    aggregateId: i9Case.id,
    newState: i9Case.status,
    newVersion: i9Case.aggregateVersion,
    allowedNextActions: fsm.getAllowedActionsFromState(i9Case.status, 'I9Case'),
    fieldAccessDecisions: {},
    eventsEmitted: i9Case.domainEvents.map((event) => event.eventName),
    auditRecordId: command.commandId,
  };
}

@CommandHandler('CompleteI9CaseSection1')
@Injectable()
export class CompleteI9CaseSection1Handler {
  readonly commandName = 'CompleteI9CaseSection1';

  constructor(
    private readonly repo: I9CaseRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: I9EverifyEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CompleteI9CaseSection1Payload;
    const i9Case = await this.repo.findById(coerceUuid(payload.i9CaseId));
    if (!i9Case) throw new ValidationError('I9 case not found');
    i9Case.completeSection1(command.correlationId, {
      citizenshipStatus: payload.citizenshipStatus,
      section1CompletedAt: payload.section1CompletedAt ? new Date(payload.section1CompletedAt) : undefined,
    });
    await this.repo.save(i9Case);
    await this.eventsPublisher.publishUncommitted(i9Case, command.tenantId, command.correlationId);
    return i9CaseResult(command, this.fsm, i9Case);
  }
}

@CommandHandler('CompleteI9CaseSection2')
@Injectable()
export class CompleteI9CaseSection2Handler {
  readonly commandName = 'CompleteI9CaseSection2';

  constructor(
    private readonly repo: I9CaseRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: I9EverifyEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CompleteI9CaseSection2Payload;
    const i9Case = await this.repo.findById(coerceUuid(payload.i9CaseId));
    if (!i9Case) throw new ValidationError('I9 case not found');
    i9Case.completeSection2(command.correlationId, {
      documentType: payload.documentType,
      documentDescriptions: payload.documentDescriptions ?? [],
      documentExpirationDate: payload.documentExpirationDate ? new Date(payload.documentExpirationDate) : undefined,
      reviewerId: coerceUuid(payload.reviewerId),
      section2CompletedAt: payload.section2CompletedAt ? new Date(payload.section2CompletedAt) : undefined,
    });
    await this.repo.save(i9Case);
    await this.eventsPublisher.publishUncommitted(i9Case, command.tenantId, command.correlationId);
    return i9CaseResult(command, this.fsm, i9Case);
  }
}

@CommandHandler('RejectI9Case')
@Injectable()
export class RejectI9CaseHandler {
  readonly commandName = 'RejectI9Case';

  constructor(
    private readonly repo: I9CaseRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: I9EverifyEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as RejectI9CasePayload;
    const i9Case = await this.repo.findById(coerceUuid(payload.i9CaseId));
    if (!i9Case) throw new ValidationError('I9 case not found');
    i9Case.reject(command.correlationId, payload.reason);
    await this.repo.save(i9Case);
    await this.eventsPublisher.publishUncommitted(i9Case, command.tenantId, command.correlationId);
    return i9CaseResult(command, this.fsm, i9Case);
  }
}
