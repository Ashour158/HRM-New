import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { RecognitionRecord } from '../aggregates/recognition-record.aggregate.js';
import { RecognitionRecordRepository } from '../repositories/recognition-record.repository.js';
import { EngagementEventsPublisher } from '../events/engagement-events.publisher.js';

@CommandHandler('CreateRecognitionRecord')
@Injectable()
export class CreateRecognitionRecordHandler {
  constructor(
    private readonly repo: RecognitionRecordRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: EngagementEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      fromWorkerId: Uuid;
      toWorkerId: Uuid;
      programId: Uuid;
      points?: number;
      message?: string;
    };
    const ar = RecognitionRecord.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        fromWorkerId: payload.fromWorkerId,
        toWorkerId: payload.toWorkerId,
        programId: payload.programId,
        points: payload.points,
        message: payload.message,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { recognitionRecordId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'RecognitionRecord'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
