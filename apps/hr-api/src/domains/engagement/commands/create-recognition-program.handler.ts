import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { RecognitionProgram } from '../aggregates/recognition-program.aggregate.js';
import { RecognitionProgramRepository } from '../repositories/recognition-program.repository.js';
import { EngagementEventsPublisher } from '../events/engagement-events.publisher.js';

@CommandHandler('CreateRecognitionProgram')
@Injectable()
export class CreateRecognitionProgramHandler {
  constructor(
    private readonly repo: RecognitionProgramRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: EngagementEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      programName: string;
      programType: string;
      budget?: number;
      currency?: string;
    };
    const ar = RecognitionProgram.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        programName: payload.programName,
        programType: payload.programType,
        budget: payload.budget,
        currency: payload.currency,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { recognitionProgramId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'RecognitionProgram'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
