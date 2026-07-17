import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { EverifyAdapter } from '../../../integrations/adapters/everify.adapter.js';
import { EverifyCase } from '../aggregates/everify-case.aggregate.js';
import type { EverifyResult } from '../aggregates/i9-case.aggregate.js';
import { I9CaseRepository } from '../repositories/i9-case.repository.js';
import { EverifyCaseRepository } from '../repositories/everify-case.repository.js';
import { I9EverifyEventsPublisher } from '../events/i9-everify-events.publisher.js';
import { coerceUuid } from './coerce-uuid.js';

export interface SubmitEverifyCasePayload {
  i9CaseId: string | Uuid;
  everifyCaseId?: string | Uuid;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
}

export interface RecordEverifyResultPayload {
  everifyCaseId: string | Uuid;
  result?: EverifyResult;
  recordedBy?: string | Uuid;
}

export interface ContestEverifyTentativeNonconfirmationPayload {
  everifyCaseId: string | Uuid;
}

function everifyResult(
  command: HrCommandEnvelope<unknown>,
  fsm: FsmFramework,
  i9Case: { id: Uuid; status: string; aggregateVersion: number; domainEvents: Array<{ eventName: string }> },
  everifyCase: EverifyCase,
): CommandResult<unknown> {
  return {
    success: true,
    data: {
      i9CaseId: i9Case.id.value,
      i9CaseStatus: i9Case.status,
      everifyCaseId: everifyCase.id.value,
      everifyCaseStatus: everifyCase.status,
      caseNumber: everifyCase.caseNumber,
      simulatedDetermination: everifyCase.simulatedDetermination,
      result: everifyCase.result,
    },
    commandId: command.commandId,
    correlationId: command.correlationId,
    aggregateId: i9Case.id,
    newState: i9Case.status,
    newVersion: i9Case.aggregateVersion,
    allowedNextActions: fsm.getAllowedActionsFromState(i9Case.status, 'I9Case'),
    fieldAccessDecisions: {},
    eventsEmitted: [...i9Case.domainEvents, ...everifyCase.domainEvents].map((event) => event.eventName),
    auditRecordId: command.commandId,
  };
}

@CommandHandler('SubmitEverifyCase')
@Injectable()
export class SubmitEverifyCaseHandler {
  readonly commandName = 'SubmitEverifyCase';

  constructor(
    private readonly i9CaseRepo: I9CaseRepository,
    private readonly everifyCaseRepo: EverifyCaseRepository,
    private readonly everifyAdapter: EverifyAdapter,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: I9EverifyEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as SubmitEverifyCasePayload;
    const i9Case = await this.i9CaseRepo.findById(coerceUuid(payload.i9CaseId));
    if (!i9Case) throw new ValidationError('I9 case not found');

    const everifyCaseId = payload.everifyCaseId ? coerceUuid(payload.everifyCaseId) : Uuid.generate();
    const everifyCase = EverifyCase.create(
      {
        id: everifyCaseId,
        tenantId: command.tenantId,
        workerId: i9Case.workerId,
        i9CaseId: i9Case.id,
      },
      command.correlationId,
    );

    const submission = await this.everifyAdapter.submitCase({
      workerId: i9Case.workerId,
      i9CaseId: i9Case.id,
      firstName: payload.firstName,
      lastName: payload.lastName,
      dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : undefined,
      documentType: i9Case.documentType ?? 'UNKNOWN',
    });
    if (!submission.success) {
      throw new Error(`E-Verify submission failed: ${submission.error ?? 'unknown error'}`);
    }

    everifyCase.submit(command.correlationId, {
      caseNumber: submission.caseNumber,
      simulatedDetermination: submission.determination,
    });
    i9Case.submitEverify(command.correlationId, everifyCase.id);

    await this.everifyCaseRepo.save(everifyCase);
    await this.i9CaseRepo.save(i9Case);
    await this.eventsPublisher.publishUncommitted(i9Case, command.tenantId, command.correlationId);
    await this.eventsPublisher.publishUncommitted(everifyCase, command.tenantId, command.correlationId);

    return everifyResult(command, this.fsm, i9Case, everifyCase);
  }
}

@CommandHandler('RecordEverifyResult')
@Injectable()
export class RecordEverifyResultHandler {
  readonly commandName = 'RecordEverifyResult';

  constructor(
    private readonly i9CaseRepo: I9CaseRepository,
    private readonly everifyCaseRepo: EverifyCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: I9EverifyEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as RecordEverifyResultPayload;
    const everifyCase = await this.everifyCaseRepo.findById(coerceUuid(payload.everifyCaseId));
    if (!everifyCase) throw new ValidationError('E-Verify case not found');
    const i9Case = await this.i9CaseRepo.findById(everifyCase.i9CaseId);
    if (!i9Case) throw new ValidationError('I9 case not found');

    const result = payload.result ?? everifyCase.simulatedDetermination;
    if (!result) {
      throw new ValidationError('An E-Verify result must be provided (no simulated determination is on file)');
    }

    everifyCase.recordResult(command.correlationId, result, payload.recordedBy ? coerceUuid(payload.recordedBy) : undefined);
    i9Case.recordEverifyResult(command.correlationId, result);

    await this.everifyCaseRepo.save(everifyCase);
    await this.i9CaseRepo.save(i9Case);
    await this.eventsPublisher.publishUncommitted(i9Case, command.tenantId, command.correlationId);
    await this.eventsPublisher.publishUncommitted(everifyCase, command.tenantId, command.correlationId);

    return everifyResult(command, this.fsm, i9Case, everifyCase);
  }
}

@CommandHandler('ContestEverifyTentativeNonconfirmation')
@Injectable()
export class ContestEverifyTentativeNonconfirmationHandler {
  readonly commandName = 'ContestEverifyTentativeNonconfirmation';

  constructor(
    private readonly i9CaseRepo: I9CaseRepository,
    private readonly everifyCaseRepo: EverifyCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: I9EverifyEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ContestEverifyTentativeNonconfirmationPayload;
    const everifyCase = await this.everifyCaseRepo.findById(coerceUuid(payload.everifyCaseId));
    if (!everifyCase) throw new ValidationError('E-Verify case not found');
    const i9Case = await this.i9CaseRepo.findById(everifyCase.i9CaseId);
    if (!i9Case) throw new ValidationError('I9 case not found');

    everifyCase.contest(command.correlationId);
    i9Case.contestTnc(command.correlationId);

    await this.everifyCaseRepo.save(everifyCase);
    await this.i9CaseRepo.save(i9Case);
    await this.eventsPublisher.publishUncommitted(i9Case, command.tenantId, command.correlationId);
    await this.eventsPublisher.publishUncommitted(everifyCase, command.tenantId, command.correlationId);

    return everifyResult(command, this.fsm, i9Case, everifyCase);
  }
}
